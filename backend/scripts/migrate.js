#!/usr/bin/env node
/**
 * Applies db/schema.sql to the configured database.
 *
 *   npm run migrate            apply the schema (idempotent)
 *   npm run migrate -- --reset drop every object first, then apply
 *
 * The schema uses IF NOT EXISTS throughout, so re-running it is a no-op.
 */
const fs = require('fs');
const path = require('path');

const config = require('../config');
const { pool } = require('../db/connection');

const SCHEMA_PATH = path.join(__dirname, '..', 'db', 'schema.sql');

const DROP_SQL = `
  DROP TABLE IF EXISTS password_reset_tokens, email_logs, ticket_activity,
                       ticket_comments, tickets, categories, users CASCADE;
  DROP SEQUENCE IF EXISTS ticket_number_seq;
  DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
`;

async function migrate({ reset = false } = {}) {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

  if (reset) {
    console.log(`Dropping existing objects in "${config.db.database}"...`);
    await pool.query(DROP_SQL);
  }

  console.log(`Applying schema to "${config.db.database}"...`);
  await pool.query(schema);
  console.log('Migration complete.');
}

if (require.main === module) {
  migrate({ reset: process.argv.includes('--reset') })
    .then(() => pool.end())
    .catch(async (err) => {
      console.error('Migration failed:', err.message);
      await pool.end();
      process.exit(1);
    });
}

module.exports = migrate;
