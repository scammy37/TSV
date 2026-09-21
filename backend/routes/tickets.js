const express = require('express');

const db = require('../db/connection');
const schemas = require('../validators');
const validate = require('../middleware/validate');
const { authenticate, isStaff, isManagement } = require('../middleware/auth');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const serialize = require('../utils/serialize');
const activity = require('../services/activity');
const email = require('../services/email');
const tickets = require('../services/tickets');
const { TERMINAL_STATUSES } = require('../constants');

const router = express.Router();

router.use(authenticate);

// Loads req.params.id into req.ticket and enforces read access once, so every
// /:id route below can assume the ticket exists and is visible.
const loadTicket = asyncHandler(async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw AppError.notFound('Ticket not found');

  const ticket = await tickets.findById(id);
  req.ticket = tickets.assertCanView(ticket, req.user);
  next();
});

/**
 * GET /api/tickets
 * Homeowners get their own tickets; staff and management get everything, with
 * filters for status, priority, category, assignee and free text.
 */
router.get('/', validate(schemas.listTickets, 'query'), asyncHandler(async (req, res) => {
  const result = await tickets.list(req.query, req.user);
  res.json({
    tickets: result.tickets.map(serialize.ticket),
    pagination: result.pagination,
  });
}));

/**
 * POST /api/tickets
 * Homeowners file for themselves. Staff may file on a homeowner's behalf by
 * passing homeownerId (for walk-ins and phone calls).
 */
router.post('/', validate(schemas.createTicket), asyncHandler(async (req, res) => {
  const { title, description, category, priority, locationDetails, unitNumber, homeownerId } = req.body;

  let ownerId = req.user.id;
  if (isStaff(req.user) && homeownerId) ownerId = homeownerId;
  else if (!isStaff(req.user) && homeownerId && homeownerId !== req.user.id) {
    throw AppError.forbidden('You can only file tickets for your own unit');
  }

  await tickets.assertCategoryExists(category);

  const owner = ownerId === req.user.id
    ? req.user
    : (await db.query('SELECT * FROM users WHERE id = $1', [ownerId])).rows[0];
  if (!owner) throw AppError.badRequest('Homeowner does not exist');

  const created = await db.transaction(async (client) => {
    const ticketNumber = await tickets.nextTicketNumber(client);
    const { rows } = await client.query(
      `INSERT INTO tickets (ticket_number, homeowner_id, created_by, category, priority,
                            title, description, location_details, unit_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [ticketNumber, ownerId, req.user.id, category, priority, title, description,
        locationDetails || null, unitNumber || owner.unit_number || null],
    );

    await activity.record({
      ticketId: rows[0].id, userId: req.user.id, action: 'created', newValue: ticketNumber,
    }, client);

    return tickets.findById(rows[0].id, client);
  });

  // Notify the homeowner and everyone in management, without blocking the response.
  email.notify('ticket_created', owner.email, { ticket: created });
  email.notifyManagement('ticket_created_internal', { ticket: created, actor: req.user },
    { exclude: [owner.email] });

  res.status(201).json({ ticket: serialize.ticket(created) });
}));

/** GET /api/tickets/:id */
router.get('/:id', loadTicket, (req, res) => {
  res.json({ ticket: serialize.ticket(req.ticket) });
});

/**
 * PATCH /api/tickets/:id
 * One endpoint for triage: status, priority, category, assignment and the
 * ticket's text. Which of those the caller may touch is decided by
 * tickets.allowedUpdateFields, and every change lands in the audit trail.
 */
router.patch('/:id', loadTicket, validate(schemas.updateTicket), asyncHandler(async (req, res) => {
  const before = req.ticket;
  const allowed = tickets.allowedUpdateFields(before, req.user);

  const rejected = Object.keys(req.body).filter((field) => !allowed.includes(field));
  if (rejected.length) {
    throw AppError.forbidden(
      TERMINAL_STATUSES.includes(before.status) && !isStaff(req.user)
        ? 'This ticket is closed and can no longer be edited'
        : `You cannot change: ${rejected.join(', ')}`,
      { allowed },
    );
  }

  const columns = {
    title: 'title',
    description: 'description',
    category: 'category',
    locationDetails: 'location_details',
    priority: 'priority',
    status: 'status',
    assignedTo: 'assigned_to',
    resolutionNotes: 'resolution_notes',
  };

  if (req.body.category !== undefined) await tickets.assertCategoryExists(req.body.category);
  if (req.body.assignedTo !== undefined) await tickets.assertAssignable(req.body.assignedTo);
  if (req.body.status !== undefined) tickets.assertValidTransition(before.status, req.body.status);

  const sets = [];
  const values = [];
  const changes = [];

  for (const [field, column] of Object.entries(columns)) {
    if (req.body[field] === undefined) continue;
    const next = req.body[field] === '' ? null : req.body[field];
    const current = before[column] ?? null;
    if (String(current ?? '') === String(next ?? '')) continue;

    values.push(next);
    sets.push(`${column} = $${values.length}`);
    changes.push({ field: column, oldValue: current, newValue: next });
  }

  if (!sets.length) {
    return res.json({ ticket: serialize.ticket(before), changed: [] });
  }

  const nextStatus = req.body.status;
  if (nextStatus === 'resolved' && !before.resolved_at) sets.push('resolved_at = now()');
  if (nextStatus === 'closed') sets.push('closed_at = now()');
  // Reopening clears the resolution timestamps so reporting stays honest.
  if (nextStatus && !TERMINAL_STATUSES.includes(nextStatus)) {
    sets.push('resolved_at = NULL', 'closed_at = NULL');
  }
  // First staff touch counts as the first response.
  if (isStaff(req.user) && !before.first_response_at) sets.push('first_response_at = now()');

  const updated = await db.transaction(async (client) => {
    values.push(before.id);
    await client.query(`UPDATE tickets SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
    await activity.recordChanges({ ticketId: before.id, userId: req.user.id, changes }, client);
    return tickets.findById(before.id, client);
  });

  const statusChanged = changes.some((c) => c.field === 'status');
  const assigneeChanged = changes.some((c) => c.field === 'assigned_to');

  if (statusChanged) {
    const template = updated.status === 'resolved' ? 'ticket_resolved' : 'ticket_status_changed';
    email.notify(template, updated.homeowner_email, { ticket: updated, oldStatus: before.status });
  }
  if (assigneeChanged && updated.assigned_to) {
    email.notify('ticket_assigned', updated.assignee_email, {
      ticket: updated,
      assignee: { first_name: updated.assignee_first_name },
    });
  }

  return res.json({
    ticket: serialize.ticket(updated),
    changed: changes.map((c) => c.field),
  });
}));

/**
 * DELETE /api/tickets/:id
 * Removes a ticket and everything hanging off it. Management only, and a last
 * resort: cancelling a ticket keeps the record and the reason, which is what
 * the resident and the audit trail want in almost every case. This is for the
 * test row and the duplicate submission, which should never have existed.
 *
 * The comments and the audit trail go with it (ON DELETE CASCADE). The
 * email_logs entry for each notification already sent survives without its
 * ticket, so the record of what was sent to whom is not rewritten by this.
 */
router.delete('/:id', loadTicket, asyncHandler(async (req, res) => {
  if (!isManagement(req.user)) throw AppError.forbidden('Only management can delete tickets');

  await db.query('DELETE FROM tickets WHERE id = $1', [req.ticket.id]);
  res.status(204).end();
}));

/**
 * POST /api/tickets/:id/assign
 * Convenience wrapper over PATCH for the management dashboard. Pass
 * assignedTo: null to return the ticket to the unassigned queue.
 */
router.post('/:id/assign', loadTicket, validate(schemas.assignTicket), asyncHandler(async (req, res) => {
  if (!isStaff(req.user)) throw AppError.forbidden('Only staff can assign tickets');

  const { assignedTo } = req.body;
  await tickets.assertAssignable(assignedTo);

  if ((req.ticket.assigned_to ?? null) === (assignedTo ?? null)) {
    return res.json({ ticket: serialize.ticket(req.ticket), changed: [] });
  }

  const updated = await db.transaction(async (client) => {
    await client.query(
      `UPDATE tickets
       SET assigned_to = $1,
           first_response_at = COALESCE(first_response_at, now())
       WHERE id = $2`,
      [assignedTo, req.ticket.id],
    );
    await activity.record({
      ticketId: req.ticket.id,
      userId: req.user.id,
      action: assignedTo ? 'assigned' : 'unassigned',
      field: 'assigned_to',
      oldValue: req.ticket.assigned_to,
      newValue: assignedTo,
    }, client);
    return tickets.findById(req.ticket.id, client);
  });

  if (assignedTo) {
    email.notify('ticket_assigned', updated.assignee_email, {
      ticket: updated,
      assignee: { first_name: updated.assignee_first_name },
    });
  }

  return res.json({ ticket: serialize.ticket(updated), changed: ['assigned_to'] });
}));

/**
 * GET /api/tickets/:id/comments
 * Internal notes are filtered out for homeowners.
 */
router.get('/:id/comments', loadTicket, asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT c.*,
            u.id AS author_id, u.first_name AS author_first_name,
            u.last_name AS author_last_name, u.email AS author_email,
            u.role AS author_role
     FROM ticket_comments c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE c.ticket_id = $1 ${isStaff(req.user) ? '' : 'AND c.is_internal = false'}
     ORDER BY c.created_at ASC, c.id ASC`,
    [req.ticket.id],
  );

  res.json({ comments: rows.map(serialize.comment) });
}));

/** POST /api/tickets/:id/comments */
router.post('/:id/comments', loadTicket, validate(schemas.createComment), asyncHandler(async (req, res) => {
  const isInternal = isStaff(req.user) ? req.body.isInternal : false;

  if (!isStaff(req.user) && TERMINAL_STATUSES.includes(req.ticket.status) && req.ticket.status !== 'resolved') {
    throw AppError.forbidden('This ticket is closed; open a new request instead');
  }

  const created = await db.transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO ticket_comments (ticket_id, user_id, comment, is_internal)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.ticket.id, req.user.id, req.body.comment, isInternal],
    );

    // A staff reply is a response to the homeowner; record it as such.
    if (isStaff(req.user) && !isInternal && !req.ticket.first_response_at) {
      await client.query('UPDATE tickets SET first_response_at = now() WHERE id = $1', [req.ticket.id]);
    }

    await activity.record({
      ticketId: req.ticket.id,
      userId: req.user.id,
      action: isInternal ? 'commented_internal' : 'commented',
    }, client);

    return rows[0];
  });

  // Internal notes stay internal -- the homeowner is never emailed about them.
  if (!isInternal) {
    if (isStaff(req.user)) {
      email.notify('ticket_comment', req.ticket.homeowner_email, {
        ticket: req.ticket, comment: created, author: req.user,
      });
    } else {
      const context = { ticket: req.ticket, comment: created, author: req.user };
      // Goes to whoever owns the ticket, or to the whole desk if nobody does.
      if (req.ticket.assignee_email) {
        email.notify('ticket_comment', req.ticket.assignee_email, context);
      } else {
        email.notifyManagement('ticket_comment', context);
      }
    }
  }

  res.status(201).json({
    comment: serialize.comment({
      ...created,
      author_id: req.user.id,
      author_first_name: req.user.first_name,
      author_last_name: req.user.last_name,
      author_email: req.user.email,
      author_role: req.user.role,
    }),
  });
}));

/**
 * GET /api/tickets/:id/activity -- the audit trail for one ticket.
 * Internal-note entries are withheld from the homeowner: an internal note the
 * homeowner can see the existence of is not internal.
 */
router.get('/:id/activity', loadTicket, asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT a.*,
            u.id AS actor_id, u.first_name AS actor_first_name,
            u.last_name AS actor_last_name, u.email AS actor_email
     FROM ticket_activity a
     LEFT JOIN users u ON u.id = a.user_id
     WHERE a.ticket_id = $1
       ${isStaff(req.user) ? '' : "AND a.action <> 'commented_internal'"}
     ORDER BY a.created_at ASC, a.id ASC`,
    [req.ticket.id],
  );

  res.json({ activity: rows.map(serialize.activity) });
}));

module.exports = router;
