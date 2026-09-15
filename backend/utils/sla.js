const { SLA_HOURS, TERMINAL_STATUSES } = require('../constants');

// A ticket's SLA deadline is measured from when it was filed, so re-prioritising
// an old ticket tightens the clock rather than restarting it.
const slaDeadline = (priority, from = new Date()) => {
  const hours = SLA_HOURS[priority] ?? SLA_HOURS.medium;
  return new Date(new Date(from).getTime() + hours * 60 * 60 * 1000);
};

const isOverdue = (ticket, now = new Date()) => {
  if (!ticket || !ticket.sla_deadline) return false;
  if (TERMINAL_STATUSES.includes(ticket.status)) return false;
  return new Date(ticket.sla_deadline) < now;
};

module.exports = { slaDeadline, isOverdue };
