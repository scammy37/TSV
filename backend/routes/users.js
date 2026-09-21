const express = require('express');
const bcrypt = require('bcryptjs');

const config = require('../config');
const db = require('../db/connection');
const schemas = require('../validators');
const validate = require('../middleware/validate');
const { authenticate, authorize, isStaff } = require('../middleware/auth');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { publicUser } = require('../utils/serialize');
const { ROLES } = require('../constants');
const tempPassword = require('../services/tempPassword');

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/users/assignable
 * The staff directory the assignment dropdown is built from. Available to any
 * staff member, not just management, so technicians can hand work over.
 */
router.get('/assignable', asyncHandler(async (req, res) => {
  if (!isStaff(req.user)) throw AppError.forbidden();

  const { rows } = await db.query(
    `SELECT u.*, COUNT(t.id) FILTER (
              WHERE t.status NOT IN ('resolved', 'closed', 'cancelled')
            )::int AS open_ticket_count
     FROM users u
     LEFT JOIN tickets t ON t.assigned_to = u.id
     WHERE u.role IN ('staff', 'management') AND u.is_active
     GROUP BY u.id
     ORDER BY u.first_name, u.last_name`,
  );

  res.json({
    users: rows.map((row) => ({ ...publicUser(row), openTicketCount: row.open_ticket_count })),
  });
}));

/** GET /api/users -- full directory, management only. */
router.get('/', authorize(ROLES.MANAGEMENT), validate(schemas.listUsers, 'query'), asyncHandler(async (req, res) => {
  const { role, q, includeInactive, page, limit } = req.query;

  const where = [];
  const values = [];
  if (!includeInactive) where.push('is_active');
  if (role) { values.push(role); where.push(`role = $${values.length}`); }
  if (q) {
    values.push(`%${q}%`);
    const p = `$${values.length}`;
    where.push(`(first_name ILIKE ${p} OR last_name ILIKE ${p} OR email ILIKE ${p} OR unit_number ILIKE ${p})`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM users ${clause}`, values);
  const { rows } = await db.query(
    `SELECT * FROM users ${clause}
     ORDER BY role, first_name, last_name
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, (page - 1) * limit],
  );

  res.json({
    users: rows.map(publicUser),
    pagination: {
      page, limit,
      total: countResult.rows[0].total,
      totalPages: Math.max(1, Math.ceil(countResult.rows[0].total / limit)),
    },
  });
}));

/** GET /api/users/:id -- management only. */
router.get('/:id', authorize(ROLES.MANAGEMENT), validate(schemas.idParam, 'params'), asyncHandler(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (!rows[0]) throw AppError.notFound('User not found');
  res.json({ user: publicUser(rows[0]) });
}));

/**
 * PATCH /api/users/:id
 * Management can change a user's role, deactivate them, or fix their details.
 */
router.patch('/:id', authorize(ROLES.MANAGEMENT), validate(schemas.idParam, 'params'), validate(schemas.updateUser),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    // Guard against a manager locking themselves out of the admin surface.
    if (id === req.user.id) {
      if (req.body.isActive === false) throw AppError.badRequest('You cannot deactivate your own account');
      if (req.body.role && req.body.role !== ROLES.MANAGEMENT) {
        throw AppError.badRequest('You cannot change your own role');
      }
    }

    const columns = {
      role: 'role',
      isActive: 'is_active',
      firstName: 'first_name',
      lastName: 'last_name',
      unitNumber: 'unit_number',
      phone: 'phone',
    };

    const sets = [];
    const values = [];
    for (const [field, column] of Object.entries(columns)) {
      if (req.body[field] === undefined) continue;
      values.push(req.body[field] === '' ? null : req.body[field]);
      sets.push(`${column} = $${values.length}`);
    }

    values.push(id);
    const { rows } = await db.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (!rows[0]) throw AppError.notFound('User not found');

    res.json({ user: publicUser(rows[0]) });
  }));

/**
 * POST /api/users/:id/reset-password
 * Sets a temporary password and returns it once, for a manager to pass to the
 * resident in person or over the phone.
 *
 * This exists because the self-service route -- an emailed reset link -- cannot
 * be relied on: the host blocks outbound SMTP, so a resident who forgets their
 * password has no way back into the account on their own.
 *
 * Three things keep that from being a back door into anyone's account:
 *
 *   - the password is generated here, never chosen by the manager, so it cannot
 *     be set to something the manager already knows the resident uses elsewhere;
 *   - must_change_password forces it to be replaced at next sign-in, so the
 *     manager's knowledge of it expires the moment it is used;
 *   - password_changed_at invalidates sessions opened before the reset, so this
 *     is also the tool for shutting an intruder out.
 *
 * The plaintext is in the response body and nowhere else. It is deliberately
 * not logged, not emailed and not stored.
 */
router.post('/:id/reset-password', authorize(ROLES.MANAGEMENT), validate(schemas.idParam, 'params'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    // A manager resetting themselves would be locked into the change-password
    // screen on their next request, for no benefit -- they can already change
    // their own password from their profile.
    if (id === req.user.id) {
      throw AppError.badRequest('Change your own password from your profile instead');
    }

    const password = tempPassword.generate();
    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

    const { rows } = await db.transaction(async (client) => {
      const updated = await client.query(
        `UPDATE users
         SET password_hash = $1, must_change_password = true, password_changed_at = now()
         WHERE id = $2
         RETURNING *`,
        [passwordHash, id],
      );

      // An outstanding emailed link would otherwise still work and let whoever
      // holds it set a password of their own choosing.
      if (updated.rowCount > 0) {
        await client.query(
          'UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL',
          [id],
        );
      }

      return updated;
    });

    if (!rows[0]) throw AppError.notFound('User not found');

    res.json({ user: publicUser(rows[0]), temporaryPassword: password });
  }));

module.exports = router;
