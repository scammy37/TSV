// Shared vocabulary for roles and ticket state. The frontend reads the same
// lists from GET /api/meta so the two can never drift.

const ROLES = { HOMEOWNER: 'homeowner', STAFF: 'staff', MANAGEMENT: 'management' };

const STAFF_ROLES = [ROLES.STAFF, ROLES.MANAGEMENT];

const PRIORITIES = ['low', 'medium', 'high'];

const STATUSES = ['open', 'in_progress', 'on_hold', 'resolved', 'closed', 'cancelled'];

// Statuses that take a ticket out of the active queue.
const TERMINAL_STATUSES = ['resolved', 'closed', 'cancelled'];

// Which status a ticket may move to next. Enforced in the ticket service so the
// audit trail can never contain a nonsensical jump.
const STATUS_TRANSITIONS = {
  open: ['in_progress', 'on_hold', 'resolved', 'cancelled'],
  in_progress: ['on_hold', 'resolved', 'cancelled'],
  on_hold: ['in_progress', 'resolved', 'cancelled'],
  resolved: ['closed', 'in_progress'],
  closed: ['in_progress'],
  cancelled: ['open'],
};

// How long an open ticket may sit before management should be looking at it.
// Without SLA deadlines this is the only "needs attention" threshold there is,
// so it lives here and is published through GET /api/meta rather than being
// written into each query and each component.
const AGING_DAYS = 7;

const PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  resolved: 'Resolved',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

module.exports = {
  ROLES,
  STAFF_ROLES,
  PRIORITIES,
  STATUSES,
  TERMINAL_STATUSES,
  STATUS_TRANSITIONS,
  AGING_DAYS,
  PRIORITY_LABELS,
  STATUS_LABELS,
};
