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

describe('GET /api/reports/summary', () => {
  it('is closed to homeowners', async () => {
    const res = await request(app).get('/api/reports/summary').set('Authorization', homeowner.auth());
    expect(res.status).toBe(403);
  });

  it('returns zeroed buckets when there are no tickets', async () => {
    const res = await request(app).get('/api/reports/summary').set('Authorization', manager.auth());

    expect(res.status).toBe(200);
    expect(res.body.totals).toMatchObject({ total: 0, open: 0, agingOpen: 0, unassigned: 0 });
    expect(res.body.totals.avgResolutionHours).toBeNull();
    expect(res.body.totals.oldestOpenHours).toBeNull();
    expect(res.body.byStatus.open).toBe(0);
  });

  it('counts open, unassigned and long-open tickets', async () => {
    const a = await createTicket(homeowner, { title: 'Long-running burst pipe', priority: 'high' });
    await createTicket(homeowner, { title: 'Ordinary squeaky hinge' });

    // Older than a week, which is what agingOpen counts.
    await db.query("UPDATE tickets SET created_at = now() - interval '9 days' WHERE id = $1", [a.id]);
    await request(app).post(`/api/tickets/${a.id}/assign`)
      .set('Authorization', manager.auth()).send({ assignedTo: staff.id });

    const res = await request(app).get('/api/reports/summary').set('Authorization', manager.auth());

    expect(res.body.totals).toMatchObject({
      total: 2, open: 2, unassigned: 1, agingOpen: 1,
    });
    expect(res.body.totals.oldestOpenHours).toBeGreaterThanOrEqual(24 * 9);
    expect(res.body.byStatus.open).toBe(2);
    expect(res.body.byPriority.high).toBe(1);
  });

  it('reports resolution time once tickets close', async () => {
    const first = await createTicket(homeowner, { title: 'Resolved quickly enough' });
    const second = await createTicket(homeowner, { title: 'Resolved after a while' });

    await request(app).patch(`/api/tickets/${first.id}`)
      .set('Authorization', staff.auth()).send({ status: 'closed' });
    await request(app).patch(`/api/tickets/${second.id}`)
      .set('Authorization', staff.auth()).send({ status: 'closed' });

    const res = await request(app).get('/api/reports/summary').set('Authorization', manager.auth());

    expect(res.body.totals.avgResolutionHours).toEqual(expect.any(Number));
    expect(res.body.totals.resolvedLast7Days).toBe(2);
    expect(res.body.byStatus.closed).toBe(2);
    // Nothing is left open, so there is no oldest open ticket.
    expect(res.body.totals.oldestOpenHours).toBeNull();
  });

  it('breaks work down by category and assignee', async () => {
    const landscaping = await createTicket(homeowner, { category: 'landscaping' });
    await createTicket(homeowner, { category: 'security', title: 'Front gate keypad is dead' });

    await request(app).post(`/api/tickets/${landscaping.id}/assign`)
      .set('Authorization', manager.auth()).send({ assignedTo: staff.id });

    const res = await request(app).get('/api/reports/summary').set('Authorization', manager.auth());

    const categories = Object.fromEntries(res.body.byCategory.map((c) => [c.category, c.count]));
    expect(categories).toMatchObject({ landscaping: 1, security: 1 });
    expect(res.body.byCategory.find((c) => c.category === 'landscaping').name).toBe('Landscaping');

    const assignee = res.body.byAssignee.find((a) => a.id === staff.id);
    expect(assignee.openCount).toBe(1);
    expect(res.body.byAssignee.find((a) => a.id === manager.id).openCount).toBe(0);
  });

  it('reports daily volume for the trailing month', async () => {
    await createTicket(homeowner);
    const res = await request(app).get('/api/reports/summary').set('Authorization', manager.auth());

    expect(res.body.dailyVolume).toHaveLength(1);
    expect(res.body.dailyVolume[0].created).toBe(1);
  });
});

describe('unknown routes', () => {
  it('returns a 404 describing the route', async () => {
    const res = await request(app).get('/api/not-a-real-route').set('Authorization', manager.auth());
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/No route matches GET/);
  });

  it('serves a public health check', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
