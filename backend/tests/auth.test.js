const { app, db, request, uniqueEmail, resetDatabase, createUser } = require('./helpers');

beforeEach(resetDatabase);
afterAll(() => db.pool.end());

describe('POST /api/auth/register', () => {
  it('registers a homeowner and returns a usable token', async () => {
    const email = uniqueEmail('homeowner');
    const res = await request(app).post('/api/auth/register').send({
      email,
      password: 'Password123!',
      firstName: 'Dana',
      lastName: 'Reyes',
      unitNumber: '4B',
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email, role: 'homeowner', unitNumber: '4B' });
    expect(res.body.user).not.toHaveProperty('password_hash');

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);
  });

  it('rejects a duplicate email regardless of case', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/auth/register').send({
      email: user.email.toUpperCase(),
      password: 'Password123!',
      firstName: 'Copy',
      lastName: 'Cat',
    });

    expect(res.status).toBe(409);
  });

  it('rejects a short password with field-level detail', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: uniqueEmail(), password: 'short', firstName: 'A', lastName: 'B',
    });

    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field)).toContain('password');
  });

  it('refuses a management role without the invite code', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: uniqueEmail('mgmt'),
      password: 'Password123!',
      firstName: 'Mal',
      lastName: 'Ory',
      role: 'management',
      staffInviteCode: 'wrong-code',
    });

    expect(res.status).toBe(403);
  });

  it('allows a management role with the correct invite code', async () => {
    const manager = await createUser({ role: 'management' });
    expect(manager.role).toBe('management');
  });
});

describe('POST /api/auth/login', () => {
  it('returns a token for correct credentials', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/auth/login')
      .send({ email: user.email, password: user.password });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it('rejects a wrong password', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/auth/login')
      .send({ email: user.email, password: 'NotThePassword1!' });

    expect(res.status).toBe(401);
  });

  it('gives the same answer for an unknown account as for a wrong password', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Password123!' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Incorrect email or password');
  });

  it('refuses a deactivated account', async () => {
    const user = await createUser();
    await db.query('UPDATE users SET is_active = false WHERE id = $1', [user.id]);

    const res = await request(app).post('/api/auth/login')
      .send({ email: user.email, password: user.password });

    expect(res.status).toBe(403);
  });
});

describe('authentication middleware', () => {
  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not.a.token');
    expect(res.status).toBe(401);
  });

  it('stops working as soon as the account is deactivated', async () => {
    const user = await createUser();
    await db.query('UPDATE users SET is_active = false WHERE id = $1', [user.id]);

    const res = await request(app).get('/api/auth/me').set('Authorization', user.auth());
    expect(res.status).toBe(403);
  });
});

describe('profile management', () => {
  it('updates the caller profile', async () => {
    const user = await createUser();
    const res = await request(app).patch('/api/auth/me')
      .set('Authorization', user.auth())
      .send({ phone: '555-0100', unitNumber: '12C' });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ phone: '555-0100', unitNumber: '12C' });
  });

  it('changes the password and invalidates the old one', async () => {
    const user = await createUser();
    const change = await request(app).post('/api/auth/change-password')
      .set('Authorization', user.auth())
      .send({ currentPassword: user.password, newPassword: 'BrandNewPass1!' });

    expect(change.status).toBe(200);

    const oldLogin = await request(app).post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post('/api/auth/login')
      .send({ email: user.email, password: 'BrandNewPass1!' });
    expect(newLogin.status).toBe(200);
  });

  it('refuses a password change with the wrong current password', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/auth/change-password')
      .set('Authorization', user.auth())
      .send({ currentPassword: 'WrongPassword1!', newPassword: 'BrandNewPass1!' });

    expect(res.status).toBe(400);
  });
});
