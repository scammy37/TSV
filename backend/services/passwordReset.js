const crypto = require('crypto');

const db = require('../db/connection');

// How long a reset link stays usable.
const TOKEN_TTL_MINUTES = 60;

// The token goes out in the email; only its hash is stored. A read-only leak of
// the table therefore yields nothing usable.
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Issues a reset token for a user, invalidating any outstanding ones so a
 * second request cannot be used to keep an older link alive.
 */
const issue = async (userId) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

  await db.transaction(async (client) => {
    await client.query(
      'UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL',
      [userId],
    );
    await client.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, hashToken(token), expiresAt],
    );
  });

  return { token, expiresAt };
};

/**
 * Exchanges a token for its user and marks it used, in one statement so two
 * concurrent requests cannot both succeed. Returns null for a token that is
 * unknown, expired, already used, or belongs to a deactivated account.
 */
const consume = async (token) => {
  if (!token) return null;

  const { rows } = await db.query(
    `UPDATE password_reset_tokens t
     SET used_at = now()
     FROM users u
     WHERE t.token_hash = $1
       AND t.used_at IS NULL
       AND t.expires_at > now()
       AND u.id = t.user_id
       AND u.is_active
     RETURNING u.id, u.email, u.first_name, u.last_name`,
    [hashToken(token)],
  );

  return rows[0] || null;
};

/** Housekeeping for tokens that were never used. */
const purgeExpired = async () => {
  const { rowCount } = await db.query(
    "DELETE FROM password_reset_tokens WHERE expires_at < now() - interval '7 days'",
  );
  return rowCount;
};

module.exports = { issue, consume, purgeExpired, hashToken, TOKEN_TTL_MINUTES };
