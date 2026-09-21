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

// The only requests an account on a temporary password may make. Matched on
// originalUrl because this runs as router-level middleware, where req.path has
// already had the mount point stripped off it.
const PASSWORD_CHANGE_ALLOWED = [
  { method: 'POST', path: '/api/auth/change-password' },
  { method: 'GET', path: '/api/auth/me' },
];

const isPasswordChangeRequest = (req) => {
  const path = (req.originalUrl || '').split('?')[0].replace(/\/+$/, '') || '/';
  return PASSWORD_CHANGE_ALLOWED.some((a) => a.method === req.method && a.path === path);
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

  // A password change ends every session that predates it. Without this a
  // manager could reset the password of a compromised account and the intruder
  // would keep working for the remaining life of the token they already hold.
  //
  // iat is whole seconds, and the row's timestamp has sub-second precision, so
  // the comparison is made in seconds. Rounding the change down means a token
  // minted in the same second as the change survives -- which is exactly what
  // the reset endpoints need, since they sign a fresh token immediately after.
  if (user.password_changed_at) {
    const changedAtSeconds = Math.floor(new Date(user.password_changed_at).getTime() / 1000);
    if (payload.iat < changedAtSeconds) {
      throw AppError.unauthorized('Your password was changed, please sign in again');
    }
  }

  // An account on a temporary password can do exactly two things: read itself,
  // so the app can render, and replace that password. Enforced here rather than
  // per-route so a new route cannot quietly forget it.
  if (user.must_change_password && !isPasswordChangeRequest(req)) {
    throw AppError.forbidden('Set a new password before continuing');
  }

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
