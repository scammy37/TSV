const nodemailer = require('nodemailer');

const config = require('../config');
const db = require('../db/connection');
const { PRIORITY_LABELS, STATUS_LABELS } = require('../constants');

let transporter;
let warnedUnconfigured = false;

// Built lazily so importing this module never opens a connection, and so tests
// can run without any SMTP configuration at all.
const getTransporter = () => {
  if (!config.smtp.host || !config.smtp.user) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return transporter;
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const ticketUrl = (ticket) => `${config.frontendUrl}/tickets/${ticket.id}`;

const layout = (heading, bodyHtml, ticket) => `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
              max-width:560px;margin:0 auto;color:#1f2430;line-height:1.5">
    <h2 style="margin:0 0 4px">${escapeHtml(heading)}</h2>
    <p style="margin:0 0 20px;color:#67707f;font-size:14px">
      ${escapeHtml(config.appName)}
    </p>
    ${bodyHtml}
    ${ticket ? `
      <p style="margin:24px 0 0">
        <a href="${ticketUrl(ticket)}"
           style="background:#2f6fed;color:#fff;text-decoration:none;
                  padding:10px 18px;border-radius:6px;display:inline-block">
          View ticket ${escapeHtml(ticket.ticket_number)}
        </a>
      </p>` : ''}
    <p style="margin:28px 0 0;font-size:12px;color:#8a94a6">
      This is an automated message; replies to this address are not monitored.
    </p>
  </div>`;

const detailRows = (ticket) => `
  <table style="border-collapse:collapse;font-size:14px">
    <tr><td style="padding:3px 16px 3px 0;color:#67707f">Ticket</td>
        <td><strong>${escapeHtml(ticket.ticket_number)}</strong></td></tr>
    <tr><td style="padding:3px 16px 3px 0;color:#67707f">Subject</td>
        <td>${escapeHtml(ticket.title)}</td></tr>
    <tr><td style="padding:3px 16px 3px 0;color:#67707f">Priority</td>
        <td>${escapeHtml(PRIORITY_LABELS[ticket.priority] || ticket.priority)}</td></tr>
    <tr><td style="padding:3px 16px 3px 0;color:#67707f">Status</td>
        <td>${escapeHtml(STATUS_LABELS[ticket.status] || ticket.status)}</td></tr>
  </table>`;

// Each template returns { subject, html } for a given ticket + context.
const templates = {
  ticket_created: ({ ticket }) => ({
    subject: `[${ticket.ticket_number}] Request received: ${ticket.title}`,
    html: layout('We received your request', `
      <p>Your service request has been logged and is waiting for review by the
         management team.</p>
      ${detailRows(ticket)}
      ${ticket.sla_deadline ? `<p style="font-size:14px;color:#67707f">
        Target resolution: ${new Date(ticket.sla_deadline).toLocaleString()}</p>` : ''}`, ticket),
  }),

  ticket_created_internal: ({ ticket, actor }) => ({
    subject: `[${ticket.ticket_number}] New ${ticket.priority} ticket: ${ticket.title}`,
    html: layout('New ticket submitted', `
      <p>${escapeHtml(actor ? `${actor.first_name} ${actor.last_name}` : 'A homeowner')}
         submitted a new request${ticket.unit_number ? ` for unit ${escapeHtml(ticket.unit_number)}` : ''}.</p>
      ${detailRows(ticket)}
      <p style="font-size:14px;white-space:pre-wrap">${escapeHtml(ticket.description)}</p>`, ticket),
  }),

  ticket_assigned: ({ ticket, assignee }) => ({
    subject: `[${ticket.ticket_number}] Assigned to you: ${ticket.title}`,
    html: layout('A ticket was assigned to you', `
      <p>Hi ${escapeHtml(assignee?.first_name || 'there')}, this request is now yours.</p>
      ${detailRows(ticket)}`, ticket),
  }),

  ticket_status_changed: ({ ticket, oldStatus }) => ({
    subject: `[${ticket.ticket_number}] Status: ${STATUS_LABELS[ticket.status] || ticket.status}`,
    html: layout('Your ticket was updated', `
      <p>Status changed from
         <strong>${escapeHtml(STATUS_LABELS[oldStatus] || oldStatus)}</strong> to
         <strong>${escapeHtml(STATUS_LABELS[ticket.status] || ticket.status)}</strong>.</p>
      ${detailRows(ticket)}`, ticket),
  }),

  ticket_resolved: ({ ticket }) => ({
    subject: `[${ticket.ticket_number}] Resolved: ${ticket.title}`,
    html: layout('Your ticket has been resolved', `
      <p>Management marked this request resolved.</p>
      ${ticket.resolution_notes
        ? `<p style="font-size:14px;white-space:pre-wrap"><strong>Resolution:</strong><br>
             ${escapeHtml(ticket.resolution_notes)}</p>`
        : ''}
      ${detailRows(ticket)}
      <p style="font-size:14px;color:#67707f">
        If the issue is not fixed, add a comment and we will reopen it.</p>`, ticket),
  }),

  ticket_comment: ({ ticket, comment, author }) => ({
    subject: `[${ticket.ticket_number}] New comment on ${ticket.title}`,
    html: layout('New comment on your ticket', `
      <p><strong>${escapeHtml(author ? `${author.first_name} ${author.last_name}` : 'Someone')}</strong>
         wrote:</p>
      <blockquote style="margin:0 0 16px;padding:10px 14px;background:#f4f6fa;
                         border-left:3px solid #2f6fed;font-size:14px;white-space:pre-wrap">
        ${escapeHtml(comment.comment)}</blockquote>
      ${detailRows(ticket)}`, ticket),
  }),
};

const logEmail = async ({ ticketId, to, subject, template, status, error }) => {
  try {
    await db.query(
      `INSERT INTO email_logs (ticket_id, recipient_email, subject, template, status, error)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [ticketId || null, to, subject ? subject.slice(0, 255) : null, template, status, error || null],
    );
  } catch (err) {
    console.error('Failed to write email log:', err.message);
  }
};

/**
 * Renders and sends one notification. Never throws: a notification failure is
 * logged to email_logs and swallowed so it can't fail the API request that
 * triggered it.
 */
const send = async (templateName, to, context = {}) => {
  const build = templates[templateName];
  if (!build) {
    console.error(`Unknown email template: ${templateName}`);
    return { status: 'failed' };
  }
  if (!to) return { status: 'skipped' };

  const { ticket } = context;
  let subject;

  try {
    const rendered = build(context);
    subject = rendered.subject;

    const mailer = getTransporter();
    if (!mailer) {
      if (!warnedUnconfigured && !config.isTest) {
        console.warn('SMTP is not configured -- notifications are logged, not sent.');
        warnedUnconfigured = true;
      }
      await logEmail({ ticketId: ticket?.id, to, subject, template: templateName, status: 'skipped' });
      return { status: 'skipped', subject };
    }

    await mailer.sendMail({ from: config.smtp.from, to, subject, html: rendered.html });
    await logEmail({ ticketId: ticket?.id, to, subject, template: templateName, status: 'sent' });
    return { status: 'sent', subject };
  } catch (err) {
    console.error(`Failed to send "${templateName}" to ${to}:`, err.message);
    await logEmail({
      ticketId: ticket?.id, to, subject, template: templateName, status: 'failed', error: err.message,
    });
    return { status: 'failed', subject };
  }
};

// In-flight notifications, so shutdown (and tests) can wait them out.
const pending = new Set();

// Fire-and-forget wrapper for use inside request handlers: the caller responds
// immediately and the notification finishes on its own.
const notify = (templateName, to, context) => {
  const promise = send(templateName, to, context)
    .catch((err) => console.error('Notification error:', err))
    .finally(() => pending.delete(promise));
  pending.add(promise);
  return promise;
};

/** Resolves once every queued notification has settled. */
const flush = async () => {
  while (pending.size) {
    // New notifications can be queued while we wait, so loop until empty.
    // eslint-disable-next-line no-await-in-loop
    await Promise.allSettled([...pending]);
  }
};

// Everyone who should hear about new or escalating tickets.
const managementRecipients = async () => {
  const { rows } = await db.query(
    "SELECT email FROM users WHERE role = 'management' AND is_active",
  );
  return rows.map((r) => r.email);
};

/**
 * Fire-and-forget notification to every active manager, skipping `exclude`
 * (typically the homeowner, who already got their own copy).
 */
const notifyManagement = (templateName, context, { exclude = [] } = {}) => {
  const promise = managementRecipients()
    .then((recipients) => Promise.allSettled(
      recipients
        .filter((addr) => !exclude.includes(addr))
        .map((addr) => send(templateName, addr, context)),
    ))
    .catch((err) => console.error('Failed to notify management:', err.message))
    .finally(() => pending.delete(promise));
  pending.add(promise);
  return promise;
};

module.exports = { send, notify, notifyManagement, flush, templates, managementRecipients };
