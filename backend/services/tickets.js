const db = require('../db/connection');
const AppError = require('../utils/AppError');
const { isStaff } = require('../middleware/auth');
const { ROLES, TERMINAL_STATUSES, STATUS_TRANSITIONS } = require('../constants');

// Every ticket read goes through this projection so list and detail responses
// have the same shape.
const TICKET_SELECT = `
  SELECT t.*,
         c.name AS category_name,
         h.id AS homeowner_id, h.first_name AS homeowner_first_name,
         h.last_name AS homeowner_last_name, h.email AS homeowner_email,
         h.unit_number AS homeowner_unit_number, h.phone AS homeowner_phone,
         a.id AS assignee_id, a.first_name AS assignee_first_name,
         a.last_name AS assignee_last_name, a.email AS assignee_email
  FROM tickets t
  JOIN users h ON h.id = t.homeowner_id
  LEFT JOIN users a ON a.id = t.assigned_to
  LEFT JOIN categories c ON c.slug = t.category`;

// Ordering by priority needs severity order, not alphabetical.
const PRIORITY_ORDER = `CASE t.priority
  WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END`;

const SORT_COLUMNS = {
  created_at: 't.created_at',
  updated_at: 't.updated_at',
  sla_deadline: 't.sla_deadline',
  status: 't.status',
  priority: PRIORITY_ORDER,
};

const nextTicketNumber = async (client = db) => {
  const { rows } = await client.query("SELECT nextval('ticket_number_seq') AS n");
  const year = new Date().getFullYear();
  return `TSV-${year}-${String(rows[0].n).padStart(5, '0')}`;
};

const findById = async (id, client = db) => {
  const { rows } = await client.query(`${TICKET_SELECT} WHERE t.id = $1`, [id]);
  return rows[0] || null;
};

/**
 * Homeowners only ever see their own tickets; staff and management see all.
 * Called after every fetch so no route can forget the check.
 */
const assertCanView = (ticket, user) => {
  if (!ticket) throw AppError.notFound('Ticket not found');
  if (isStaff(user)) return ticket;
  if (ticket.homeowner_id !== user.id) throw AppError.notFound('Ticket not found');
  return ticket;
};

/**
 * Which fields this user may change on this ticket.
 * Homeowners can correct the details of their own ticket while it is still
 * open, and may cancel it -- but never touch priority, assignment or status.
 */
const allowedUpdateFields = (ticket, user) => {
  if (isStaff(user)) {
    return ['title', 'description', 'category', 'locationDetails', 'priority',
      'status', 'assignedTo', 'resolutionNotes'];
  }
  if (ticket.homeowner_id !== user.id) return [];
  if (TERMINAL_STATUSES.includes(ticket.status)) return [];
  return ['title', 'description', 'category', 'locationDetails'];
};

const assertValidTransition = (from, to) => {
  if (from === to) return;
  const allowed = STATUS_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw AppError.badRequest(
      `Cannot move a ticket from "${from}" to "${to}"`,
      { allowed },
    );
  }
};

const assertAssignable = async (assignedTo, client = db) => {
  if (assignedTo === null || assignedTo === undefined) return;
  const { rows } = await client.query(
    'SELECT id, role, is_active FROM users WHERE id = $1',
    [assignedTo],
  );
  const user = rows[0];
  if (!user) throw AppError.badRequest('Assignee does not exist');
  if (!user.is_active) throw AppError.badRequest('Cannot assign to a deactivated account');
  if (user.role === ROLES.HOMEOWNER) {
    throw AppError.badRequest('Tickets can only be assigned to staff or management');
  }
};

const assertCategoryExists = async (slug, client = db) => {
  const { rows } = await client.query(
    'SELECT slug FROM categories WHERE slug = $1 AND is_active',
    [slug],
  );
  if (!rows[0]) throw AppError.badRequest(`Unknown category "${slug}"`);
};

/**
 * Builds the WHERE clause for GET /api/tickets from validated query params,
 * forcing homeowners down to their own rows regardless of what they asked for.
 */
const buildListQuery = (filters, user) => {
  const where = [];
  const values = [];
  const add = (sql, value) => {
    values.push(value);
    where.push(sql.replace('?', `$${values.length}`));
  };

  if (!isStaff(user)) {
    add('t.homeowner_id = ?', user.id);
  } else if (filters.homeownerId) {
    add('t.homeowner_id = ?', filters.homeownerId);
  }

  if (filters.status?.length) add('t.status = ANY(?)', filters.status);
  if (filters.priority?.length) add('t.priority = ANY(?)', filters.priority);
  if (filters.category) add('t.category = ?', filters.category);

  if (filters.assignedTo === 'unassigned') {
    where.push('t.assigned_to IS NULL');
  } else if (filters.assignedTo === 'me') {
    add('t.assigned_to = ?', user.id);
  } else if (filters.assignedTo) {
    add('t.assigned_to = ?', filters.assignedTo);
  }

  if (filters.open === true) {
    where.push(`t.status NOT IN ('resolved', 'closed', 'cancelled')`);
  } else if (filters.open === false) {
    where.push(`t.status IN ('resolved', 'closed', 'cancelled')`);
  }

  if (filters.overdue) {
    where.push(`t.sla_deadline < now() AND t.status NOT IN ('resolved', 'closed', 'cancelled')`);
  }

  if (filters.q) {
    // One bound value, matched against three columns.
    values.push(`%${filters.q}%`);
    const p = `$${values.length}`;
    where.push(`(t.title ILIKE ${p} OR t.description ILIKE ${p} OR t.ticket_number ILIKE ${p})`);
  }

  return {
    clause: where.length ? `WHERE ${where.join(' AND ')}` : '',
    values,
  };
};

const list = async (filters, user) => {
  const { clause, values } = buildListQuery(filters, user);
  const sortColumn = SORT_COLUMNS[filters.sort] || SORT_COLUMNS.created_at;
  const order = filters.order === 'asc' ? 'ASC' : 'DESC';
  const offset = (filters.page - 1) * filters.limit;

  const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM tickets t ${clause}`, values);
  const total = countResult.rows[0].total;

  const { rows } = await db.query(
    `${TICKET_SELECT} ${clause}
     ORDER BY ${sortColumn} ${order}, t.id DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, filters.limit, offset],
  );

  return {
    tickets: rows,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.limit)),
    },
  };
};

module.exports = {
  TICKET_SELECT,
  nextTicketNumber,
  findById,
  assertCanView,
  assertValidTransition,
  assertAssignable,
  assertCategoryExists,
  allowedUpdateFields,
  list,
};
