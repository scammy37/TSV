const { app, db, request, resetDatabase, createUser, createTicket } = require('./helpers');

let homeowner;
let staff;
let manager;

beforeEach(async () => {
  await resetDatabase();
  [homeowner, staff, manager] = await Promise.all([
    createUser({ role: 'homeowner' }),
    createUser({ role: 'staff' }),
    createUser({ role: 'management' }),
  ]);
});

afterAll(() => db.pool.end());

describe('GET /api/users/assignable', () => {
  it('lists staff and management with their open workload', async () => {
    const ticket = await createTicket(homeowner);
    await request(app).post(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', manager.auth()).send({ assignedTo: staff.id });

    const res = await request(app).get('/api/users/assignable').set('Authorization', staff.auth());

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
    expect(res.body.users.every((u) => u.role !== 'homeowner')).toBe(true);
    expect(res.body.users.find((u) => u.id === staff.id).openTicketCount).toBe(1);
  });

  it('is closed to homeowners', async () => {
    const res = await request(app).get('/api/users/assignable').set('Authorization', homeowner.auth());
    expect(res.status).toBe(403);
  });
});

describe('GET /api/users', () => {
  it('lists the directory for management', async () => {
    const res = await request(app).get('/api/users').set('Authorization', manager.auth());

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(3);
    expect(res.body.pagination.total).toBe(3);
  });

  it('filters by role and search term', async () => {
    const byRole = await request(app).get('/api/users?role=homeowner')
      .set('Authorization', manager.auth());
    expect(byRole.body.users).toHaveLength(1);

    const bySearch = await request(app).get(`/api/users?q=${encodeURIComponent(staff.email)}`)
      .set('Authorization', manager.auth());
    expect(bySearch.body.users).toHaveLength(1);
    expect(bySearch.body.users[0].id).toBe(staff.id);
  });

  it('is closed to staff and homeowners', async () => {
    const asStaff = await request(app).get('/api/users').set('Authorization', staff.auth());
    expect(asStaff.status).toBe(403);

    const asHomeowner = await request(app).get('/api/users').set('Authorization', homeowner.auth());
    expect(asHomeowner.status).toBe(403);
  });

  it('hides deactivated users unless asked for', async () => {
    await request(app).patch(`/api/users/${staff.id}`)
      .set('Authorization', manager.auth()).send({ isActive: false });

    const active = await request(app).get('/api/users').set('Authorization', manager.auth());
    expect(active.body.users).toHaveLength(2);

    const all = await request(app).get('/api/users?includeInactive=true')
      .set('Authorization', manager.auth());
    expect(all.body.users).toHaveLength(3);
  });
});

describe('PATCH /api/users/:id', () => {
  it('promotes a homeowner to staff', async () => {
    const res = await request(app).patch(`/api/users/${homeowner.id}`)
      .set('Authorization', manager.auth()).send({ role: 'staff' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('staff');
  });

  it('deactivates an account, locking out its existing token', async () => {
    await request(app).patch(`/api/users/${staff.id}`)
      .set('Authorization', manager.auth()).send({ isActive: false });

    const res = await request(app).get('/api/auth/me').set('Authorization', staff.auth());
    expect(res.status).toBe(403);
  });

  it('stops a manager deactivating or demoting themselves', async () => {
    const deactivate = await request(app).patch(`/api/users/${manager.id}`)
      .set('Authorization', manager.auth()).send({ isActive: false });
    expect(deactivate.status).toBe(400);

    const demote = await request(app).patch(`/api/users/${manager.id}`)
      .set('Authorization', manager.auth()).send({ role: 'staff' });
    expect(demote.status).toBe(400);
  });

  it('returns 404 for a user that does not exist', async () => {
    const res = await request(app).patch('/api/users/999999')
      .set('Authorization', manager.auth()).send({ role: 'staff' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/meta', () => {
  it('returns the categories, priorities and statuses the UI renders', async () => {
    const res = await request(app).get('/api/meta').set('Authorization', homeowner.auth());

    expect(res.status).toBe(200);
    expect(res.body.categories.map((c) => c.slug)).toContain('plumbing');
    expect(res.body.priorities).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 'high', label: 'High' }),
    ]));
    expect(res.body.statuses.find((s) => s.value === 'open').next).toContain('in_progress');
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/meta');
    expect(res.status).toBe(401);
  });
});
