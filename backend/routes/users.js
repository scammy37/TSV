const express = require('express');

const db = require('../db/connection');
const schemas = require('../validators');
const validate = require('../middleware/validate');
const { authenticate, authorize, isStaff } = require('../middleware/auth');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { publicUser } = require('../utils/serialize');
const { ROLES } = require('../constants');

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

module.exports = router;
