const { Pool } = require('pg');
const config = require('../config');

// config.db is either a discrete host/user/password set or a connectionString,
// depending on whether the host provided DATABASE_URL. pg accepts both shapes.
const pool = new Pool(config.db);

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

const query = (text, params) => pool.query(text, params);

// Runs `fn` inside a transaction on a dedicated client, rolling back on throw.
const transaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, query, transaction };
