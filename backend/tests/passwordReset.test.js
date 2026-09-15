const {
  app, db, request, resetDatabase, createUser, waitForEmail,
} = require('./helpers');
const passwordReset = require('../services/passwordReset');

beforeEach(resetDatabase);
afterAll(() => db.pool.end());

// Pulls the token straight from the table, standing in for the emailed link.
const tokenFor = async (userId) => {
  const { rows } = await db.query(
    'SELECT token_hash FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL',
    [userId],
  );
  return rows[0]?.token_hash;
};

describe('POST /api/auth/forgot-password', () => {
  it('issues a token and emails the user', async () => {
    const user = await createUser();

    const res = await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    expect(res.status).toBe(200);

    await waitForEmail("recipient_email = $1 AND template = 'password_reset'", [user.email]);

    const { rows } = await db.query(
      'SELECT * FROM password_reset_tokens WHERE user_id = $1',
      [user.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].used_at).toBeNull();
    expect(new Date(rows[0].expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it('answers identically for an unknown address, and sends nothing', async () => {
    const known = await createUser();

    const a = await request(app).post('/api/auth/forgot-password').send({ email: known.email });
    const b = await request(app).post('/api/auth/forgot-password')
      .send({ email: 'nobody@example.com' });

    expect(b.status).toBe(a.status);
    expect(b.body).toEqual(a.body);

    const { rows } = await db.query(
      "SELECT 1 FROM email_logs WHERE recipient_email = 'nobody@example.com'",
    );
    expect(rows).toHaveLength(0);
  });

  it('does not issue a token for a deactivated account', async () => {
    const user = await createUser();
    await db.query('UPDATE users SET is_active = false WHERE id = $1', [user.id]);

    const res = await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    expect(res.status).toBe(200);

    const { rows } = await db.query('SELECT 1 FROM password_reset_tokens WHERE user_id = $1', [user.id]);
    expect(rows).toHaveLength(0);
  });

  it('invalidates an earlier outstanding token', async () => {
    const user = await createUser();

    await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    const first = await tokenFor(user.id);

    await request(app).post('/api/auth/forgot-password').send({ email: user.email });

    const { rows } = await db.query(
      'SELECT token_hash, used_at FROM password_reset_tokens WHERE user_id = $1 ORDER BY id',
      [user.id],
    );
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.token_hash === first).used_at).not.toBeNull();
  });
});

describe('POST /api/auth/reset-password', () => {
  // Issues a token directly so the test holds the plaintext, as the email would.
  const issueFor = async (user) => (await passwordReset.issue(user.id)).token;

  it('sets the new password and returns a working session', async () => {
    const user = await createUser();
    const token = await issueFor(user);

    const res = await request(app).post('/api/auth/reset-password')
      .send({ token, password: 'BrandNewPass1!' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);

    const me = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);

    const newLogin = await request(app).post('/api/auth/login')
      .send({ email: user.email, password: 'BrandNewPass1!' });
    expect(newLogin.status).toBe(200);

    const oldLogin = await request(app).post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    expect(oldLogin.status).toBe(401);
  });

  it('refuses to reuse a token', async () => {
    const user = await createUser();
    const token = await issueFor(user);

    const first = await request(app).post('/api/auth/reset-password')
      .send({ token, password: 'BrandNewPass1!' });
    expect(first.status).toBe(200);

    const second = await request(app).post('/api/auth/reset-password')
      .send({ token, password: 'AnotherPass1!' });
    expect(second.status).toBe(400);
  });

  it('refuses an expired token', async () => {
    const user = await createUser();
    const token = await issueFor(user);
    await db.query(
      "UPDATE password_reset_tokens SET expires_at = now() - interval '1 minute' WHERE user_id = $1",
      [user.id],
    );

    const res = await request(app).post('/api/auth/reset-password')
      .send({ token, password: 'BrandNewPass1!' });
    expect(res.status).toBe(400);
  });

  it('refuses a token for an account deactivated after it was issued', async () => {
    const user = await createUser();
    const token = await issueFor(user);
    await db.query('UPDATE users SET is_active = false WHERE id = $1', [user.id]);

    const res = await request(app).post('/api/auth/reset-password')
      .send({ token, password: 'BrandNewPass1!' });
    expect(res.status).toBe(400);
  });

  it('refuses a forged token and a short password', async () => {
    const forged = await request(app).post('/api/auth/reset-password')
      .send({ token: 'a'.repeat(64), password: 'BrandNewPass1!' });
    expect(forged.status).toBe(400);

    const user = await createUser();
    const token = await issueFor(user);
    const short = await request(app).post('/api/auth/reset-password')
      .send({ token, password: 'short' });
    expect(short.status).toBe(400);
  });

  it('stores only the hash of the token, never the token itself', async () => {
    const user = await createUser();
    const token = await issueFor(user);

    const { rows } = await db.query('SELECT token_hash FROM password_reset_tokens WHERE user_id = $1', [user.id]);
    expect(rows[0].token_hash).not.toBe(token);
    expect(rows[0].token_hash).toBe(passwordReset.hashToken(token));
  });
});
