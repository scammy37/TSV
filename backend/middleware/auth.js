const jwt = require('jsonwebtoken');

const config = require('../config');
const db = require('../db/connection');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { STAFF_ROLES, ROLES } = require('../constants');

const signToken = (user) => jwt.sign(
  { sub: user.id, role: user.role },
  config.jwt.secret,
  { expiresIn: config.jwt.expiresIn },
);

const bearerToken = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
};

// Verifies the JWT and loads the current user row, so a deactivated account
// stops working the moment it is disabled rather than when its token expires.
const authenticate = asyncHandler(async (req, res, next) => {
  const token = bearerToken(req);
  if (!token) throw AppError.unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch (err) {
    throw AppError.unauthorized(
      err.name === 'TokenExpiredError' ? 'Session expired, please sign in again' : 'Invalid token',
    );
  }

  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [payload.sub]);
  const user = rows[0];
  if (!user) throw AppError.unauthorized('Account no longer exists');
  if (!user.is_active) throw AppError.forbidden('This account has been deactivated');

  req.user = user;
  next();
});

// Route guard: authorize('management') or authorize(...STAFF_ROLES).
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(AppError.unauthorized());
  if (!roles.includes(req.user.role)) return next(AppError.forbidden());
  return next();
};

const isStaff = (user) => STAFF_ROLES.includes(user.role);
const isManagement = (user) => user.role === ROLES.MANAGEMENT;

module.exports = { signToken, authenticate, authorize, isStaff, isManagement };
