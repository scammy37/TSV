process.env.NODE_ENV = 'test';

const request = require('supertest');

const app = require('../app');
const db = require('../db/connection');
const email = require('../services/email');

let counter = 0;
const uniqueEmail = (prefix = 'user') => {
  counter += 1;
  return `${prefix}.${process.pid}.${counter}@example.com`;
};

/**
 * Truncates every table between tests, resetting identities. Outstanding
 * notifications are flushed first so a late write cannot hit a truncated table.
 */
const resetDatabase = async () => {
  await email.flush();
  await db.query(
    'TRUNCATE email_logs, ticket_activity, ticket_comments, tickets, users RESTART IDENTITY CASCADE',
  );
  await db.query("SELECT setval('ticket_number_seq', 1000, false)");
};

/**
 * Registers a user through the real API and returns { user, token, auth },
 * where auth() produces the Authorization header for supertest.
 */
const createUser = async (overrides = {}) => {
  const role = overrides.role || 'homeowner';
  const payload = {
    email: uniqueEmail(role),
    password: 'Password123!',
    firstName: 'Test',
    lastName: role.charAt(0).toUpperCase() + role.slice(1),
    unitNumber: role === 'homeowner' ? '101' : undefined,
    ...overrides,
  };

  if (role !== 'homeowner') payload.staffInviteCode = process.env.STAFF_INVITE_CODE;

  const res = await request(app).post('/api/auth/register').send(payload);
  if (res.status !== 201) {
    throw new Error(`Failed to create ${role}: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return {
    ...res.body.user,
    token: res.body.token,
    password: payload.password,
    auth: () => `Bearer ${res.body.token}`,
  };
};

/** Files a ticket as the given user and returns the created ticket. */
const createTicket = async (user, overrides = {}) => {
  const res = await request(app)
    .post('/api/tickets')
    .set('Authorization', user.auth())
    .send({
      title: 'Kitchen sink is leaking',
      description: 'Water is pooling under the sink cabinet every morning.',
      category: 'plumbing',
      priority: 'medium',
      ...overrides,
    });

  if (res.status !== 201) {
    throw new Error(`Failed to create ticket: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.ticket;
};

/**
 * Polls `fn` until it returns a truthy value or the timeout elapses. Used for
 * the fire-and-forget notifications, which land shortly after the response.
 */
const waitFor = async (fn, { timeout = 2000, interval = 25 } = {}) => {
  const deadline = Date.now() + timeout;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const result = await fn();
    if (result) return result;
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
};

/** Resolves once an email_logs row matching the filter exists. */
const waitForEmail = (where, params) => waitFor(async () => {
  const { rows } = await db.query(`SELECT * FROM email_logs WHERE ${where}`, params);
  return rows.length ? rows : null;
});

module.exports = {
  app, db, request, uniqueEmail, resetDatabase, createUser, createTicket, waitFor, waitForEmail,
};
