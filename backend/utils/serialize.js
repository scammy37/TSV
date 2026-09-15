const { isOverdue } = require('./sla');

const publicUser = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: [row.first_name, row.last_name].filter(Boolean).join(' '),
    role: row.role,
    unitNumber: row.unit_number ?? null,
    phone: row.phone ?? null,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
};

// Builds a nested {id, fullName, ...} object from the `prefix_`-aliased columns
// a joined ticket query returns, or null when the join found no row.
const nestedUser = (row, prefix) => {
  const id = row[`${prefix}_id`];
  if (!id) return null;
  return {
    id,
    firstName: row[`${prefix}_first_name`],
    lastName: row[`${prefix}_last_name`],
    fullName: [row[`${prefix}_first_name`], row[`${prefix}_last_name`]].filter(Boolean).join(' '),
    email: row[`${prefix}_email`],
    unitNumber: row[`${prefix}_unit_number`] ?? null,
    phone: row[`${prefix}_phone`] ?? null,
  };
};

const ticket = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    title: row.title,
    description: row.description,
    category: row.category,
    categoryName: row.category_name ?? row.category,
    priority: row.priority,
    status: row.status,
    locationDetails: row.location_details ?? null,
    unitNumber: row.unit_number ?? null,
    homeowner: nestedUser(row, 'homeowner'),
    assignee: nestedUser(row, 'assignee'),
    slaDeadline: row.sla_deadline ?? null,
    isOverdue: isOverdue(row),
    firstResponseAt: row.first_response_at ?? null,
    resolvedAt: row.resolved_at ?? null,
    closedAt: row.closed_at ?? null,
    resolutionNotes: row.resolution_notes ?? null,
    commentCount: row.comment_count === undefined ? undefined : Number(row.comment_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const comment = (row) => ({
  id: row.id,
  ticketId: row.ticket_id,
  comment: row.comment,
  isInternal: row.is_internal,
  author: nestedUser(row, 'author'),
  authorRole: row.author_role ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const activity = (row) => ({
  id: row.id,
  ticketId: row.ticket_id,
  action: row.action,
  field: row.field ?? null,
  oldValue: row.old_value ?? null,
  newValue: row.new_value ?? null,
  actor: nestedUser(row, 'actor'),
  createdAt: row.created_at,
});

module.exports = { publicUser, nestedUser, ticket, comment, activity };
