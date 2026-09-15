require("./setEnv");

/**
 * Creates the test database if it does not exist, then applies the schema.
 * Runs once before the whole suite.
 */
process.env.NODE_ENV = 'test';

const { Client } = require('pg');

module.exports = async () => {
  const config = require('../config');

  // Connect to the maintenance database to create the test database.
  const admin = new Client({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: 'postgres',
  });

  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.db.database]);
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${config.db.database}"`);
  }
  await admin.end();

  const migrate = require('../scripts/migrate');
  await migrate({ reset: true });

  const { pool } = require('../db/connection');
  await pool.end();
};
