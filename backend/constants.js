// Shared vocabulary for roles, ticket state and SLA policy. The frontend reads
// the same lists from GET /api/meta so the two can never drift.

const ROLES = { HOMEOWNER: 'homeowner', STAFF: 'staff', MANAGEMENT: 'management' };

const STAFF_ROLES = [ROLES.STAFF, ROLES.MANAGEMENT];

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

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

// Hours a ticket has to be resolved, by priority.
const SLA_HOURS = { urgent: 4, high: 24, medium: 72, low: 168 };

const PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
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
  SLA_HOURS,
  PRIORITY_LABELS,
  STATUS_LABELS,
};
