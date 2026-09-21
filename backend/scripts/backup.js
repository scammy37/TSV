#!/usr/bin/env node
/**
 * Dumps the database to a file.
 *
 *   npm run backup                  -> backups/tsv-<timestamp>.dump
 *   npm run backup -- /path/out.dump
 *
 * Restore with:
 *
 *   pg_restore --clean --if-exists --no-owner -d "<DATABASE_URL>" <file>
 *
 * Reads the connection from the same config the app uses, so on a host that
 * provides DATABASE_URL this needs no arguments and no credentials typed
 * anywhere. The password is handed to pg_dump through PGPASSWORD rather than
 * in the connection string, because command-line arguments are visible to
 * anyone who can list processes.
 *
 * Format is pg_dump's custom format (-Fc): compressed, and pg_restore can pull
 * a single table out of it rather than all or nothing.
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const config = require('../config');
const db = require('../db/connection');

/** Connection parts for the pg_* binaries, kept apart from the password. */
const connection = () => {
  if (config.db.connectionString) {
    const url = new URL(config.db.connectionString);
    return {
      host: url.hostname,
      port: url.port || '5432',
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    };
  }
  return {
    host: config.db.host,
    port: String(config.db.port),
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
  };
};

const majorVersion = (text) => {
  const match = /(\d+)\.\d+/.exec(text) || /(\d+)/.exec(text);
  return match ? Number(match[1]) : null;
};

async function main() {
  const conn = connection();

  const local = spawnSync('pg_dump', ['--version'], { encoding: 'utf8' });
  if (local.error) {
    console.error('pg_dump is not installed, or not on PATH.');
    console.error('It ships with the PostgreSQL client tools:');
    console.error('  macOS    brew install libpq && brew link --force libpq');
    console.error('  Ubuntu   sudo apt install postgresql-client');
    console.error('  Windows  install PostgreSQL and use the bundled pg_dump');
    return 1;
  }

  const { rows } = await db.query('SHOW server_version');
  const serverMajor = majorVersion(rows[0].server_version);
  const dumpMajor = majorVersion(local.stdout);

  console.log(`Server  : PostgreSQL ${rows[0].server_version} (${conn.database} on ${conn.host}:${conn.port})`);
  console.log(`pg_dump : ${local.stdout.trim()}`);

  // pg_dump reads a server older than itself, never a newer one. Managed hosts
  // run current majors, so a machine with an older client fails here -- with a
  // message from pg_dump that does not say what to do about it.
  if (serverMajor && dumpMajor && dumpMajor < serverMajor) {
    console.error('');
    console.error(`pg_dump ${dumpMajor} cannot dump a PostgreSQL ${serverMajor} server.`);
    console.error(`Install PostgreSQL client tools ${serverMajor} or newer and run this again.`);
    console.error('  macOS    brew install postgresql@' + serverMajor);
    console.error('  Ubuntu   see https://www.postgresql.org/download/linux/ubuntu/');
    return 1;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const target = process.argv[2]
    || path.join(__dirname, '..', '..', 'backups', `tsv-${stamp}.dump`);
  fs.mkdirSync(path.dirname(target), { recursive: true });

  // What the dump should contain, so the file can be sanity-checked rather
  // than assumed good.
  const counts = await db.query(`
    SELECT (SELECT count(*) FROM users)           AS users,
           (SELECT count(*) FROM tickets)         AS tickets,
           (SELECT count(*) FROM ticket_comments) AS comments`);
  const { users, tickets, comments } = counts.rows[0];
  console.log(`Contents: ${users} users, ${tickets} tickets, ${comments} comments`);
  console.log(`\nWriting ${target} ...`);

  const code = await new Promise((resolve) => {
    const child = spawn('pg_dump', [
      '--format=custom',
      '--no-owner',
      '--no-privileges',
      '--file', target,
      '--host', conn.host,
      '--port', conn.port,
      '--username', conn.user,
      '--dbname', conn.database,
    ], {
      // PGPASSWORD rather than a URL argument: argv is world-readable.
      env: { ...process.env, PGPASSWORD: conn.password },
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('close', resolve);
  });

  if (code !== 0) {
    console.error(`\npg_dump exited ${code}. Nothing to trust here -- do not treat this as a backup.`);
    return 1;
  }

  const bytes = fs.statSync(target).size;
  console.log(`\nDone. ${target} (${(bytes / 1024).toFixed(1)} KB)`);
  console.log('\nRestore into an empty database with:');
  console.log(`  pg_restore --clean --if-exists --no-owner -d "<DATABASE_URL>" ${target}`);
  return 0;
}

main()
  .then(async (code) => { await db.pool.end(); process.exit(code); })
  .catch(async (err) => {
    console.error('Backup failed:', err.message);
    await db.pool.end();
    process.exit(1);
  });
