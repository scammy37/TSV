#!/usr/bin/env node
/**
 * Creates (or promotes) a management account from the server console.
 *
 *   npm run create-admin -- you@example.com "Jane Doe"
 *
 * The password is read from ADMIN_PASSWORD, or generated and printed once.
 *
 * This is the production path for the first manager: it means STAFF_INVITE_CODE
 * can stay blank, which refuses staff self-registration entirely. Everyone else
 * is promoted from the People page afterwards.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const config = require('../config');
const db = require('../db/connection');

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  const fullName = (process.argv[3] || '').trim();

  if (!email || !email.includes('@')) {
    console.error('Usage: npm run create-admin -- <email> ["Full Name"]');
    return 1;
  }

  const [firstName, ...rest] = (fullName || 'Site Manager').split(/\s+/);
  const lastName = rest.join(' ') || 'Manager';

  const existing = await db.query('SELECT id, role FROM users WHERE lower(email) = lower($1)', [email]);

  if (existing.rowCount > 0) {
    const user = existing.rows[0];
    if (user.role === 'management') {
      console.log(`${email} is already a management account.`);
      return 0;
    }
    await db.query("UPDATE users SET role = 'management', is_active = true WHERE id = $1", [user.id]);
    console.log(`Promoted ${email} from ${user.role} to management.`);
    return 0;
  }

  // Printed once and never stored in plaintext; the account holder should
  // change it, or use the forgot-password flow, on first sign-in.
  const generated = !process.env.ADMIN_PASSWORD;
  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');

  if (password.length < 8) {
    console.error('ADMIN_PASSWORD must be at least 8 characters.');
    return 1;
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  await db.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role)
     VALUES ($1, $2, $3, $4, 'management')`,
    [email, passwordHash, firstName, lastName],
  );

  console.log(`Created management account ${email}`);
  if (generated) {
    console.log(`Password: ${password}`);
    console.log('This is shown once. Change it after signing in.');
  }
  return 0;
}

main()
  .then(async (code) => { await db.pool.end(); process.exit(code); })
  .catch(async (err) => {
    console.error('Failed:', err.message);
    await db.pool.end();
    process.exit(1);
  });
