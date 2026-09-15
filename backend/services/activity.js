const db = require('../db/connection');

/**
 * Appends one audit-trail entry. `client` lets the caller pass a transaction
 * client so the log commits atomically with the change it describes.
 */
const record = async ({ ticketId, userId, action, field = null, oldValue = null, newValue = null }, client = db) => {
  const { rows } = await client.query(
    `INSERT INTO ticket_activity (ticket_id, user_id, action, field, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [ticketId, userId, action, field, oldValue === null ? null : String(oldValue),
      newValue === null ? null : String(newValue)],
  );
  return rows[0];
};

// Records one entry per changed field, for a batch update.
const recordChanges = async ({ ticketId, userId, changes }, client = db) => {
  for (const change of changes) {
    // Sequential on purpose: the audit trail should read in the order applied.
    // eslint-disable-next-line no-await-in-loop
    await record({ ticketId, userId, action: 'updated', ...change }, client);
  }
};

module.exports = { record, recordChanges };
