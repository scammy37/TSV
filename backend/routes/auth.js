const express = require('express');
const bcrypt = require('bcryptjs');

const config = require('../config');
const db = require('../db/connection');
const schemas = require('../validators');
const validate = require('../middleware/validate');
const { signToken, authenticate } = require('../middleware/auth');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { publicUser } = require('../utils/serialize');
const { ROLES } = require('../constants');

const router = express.Router();

/**
 * POST /api/auth/register
 * Self-service signup for homeowners. Requesting a staff or management role
 * requires STAFF_INVITE_CODE, which is how the first manager account is made.
 */
router.post('/register', validate(schemas.register), asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, unitNumber, phone, role, staffInviteCode } = req.body;

  if (role !== ROLES.HOMEOWNER) {
    if (!config.staffInviteCode) {
      throw AppError.forbidden('Staff registration is disabled; set STAFF_INVITE_CODE to enable it');
    }
    if (staffInviteCode !== config.staffInviteCode) {
      throw AppError.forbidden('Invalid staff invite code');
    }
  }

  const existing = await db.query('SELECT 1 FROM users WHERE lower(email) = lower($1)', [email]);
  if (existing.rowCount > 0) {
    throw AppError.conflict('An account with that email already exists');
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  const { rows } = await db.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, unit_number, phone)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [email, passwordHash, firstName, lastName, role, unitNumber || null, phone || null],
  );

  const user = rows[0];
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}));

/** POST /api/auth/login */
router.post('/login', validate(schemas.login), asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { rows } = await db.query('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
  const user = rows[0];

  // Compare against a dummy hash when the user is unknown so a missing account
  // and a wrong password take the same amount of time to reject.
  const hash = user ? user.password_hash : '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const matches = await bcrypt.compare(password, hash);

  if (!user || !matches) throw AppError.unauthorized('Incorrect email or password');
  if (!user.is_active) throw AppError.forbidden('This account has been deactivated');

  res.json({ token: signToken(user), user: publicUser(user) });
}));

/** GET /api/auth/me */
router.get('/me', authenticate, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

/** PATCH /api/auth/me */
router.patch('/me', authenticate, validate(schemas.updateProfile), asyncHandler(async (req, res) => {
  const fieldMap = {
    firstName: 'first_name',
    lastName: 'last_name',
    unitNumber: 'unit_number',
    phone: 'phone',
  };

  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(fieldMap)) {
    if (req.body[key] !== undefined) {
      values.push(req.body[key] === '' ? null : req.body[key]);
      sets.push(`${column} = $${values.length}`);
    }
  }

  values.push(req.user.id);
  const { rows } = await db.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values,
  );

  res.json({ user: publicUser(rows[0]) });
}));

/** POST /api/auth/change-password */
router.post('/change-password', authenticate, validate(schemas.changePassword), asyncHandler(async (req, res) => {
  const matches = await bcrypt.compare(req.body.currentPassword, req.user.password_hash);
  if (!matches) throw AppError.badRequest('Current password is incorrect');

  const passwordHash = await bcrypt.hash(req.body.newPassword, config.bcryptRounds);
  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, req.user.id]);

  res.json({ message: 'Password updated' });
}));

module.exports = router;
