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
    expect(res.body.totals).toMatchObject({ total: 0, open: 0, overdue: 0, unassigned: 0 });
    expect(res.body.totals.avgResolutionHours).toBeNull();
    expect(res.body.totals.slaCompliance).toBeNull();
    expect(res.body.byStatus.open).toBe(0);
  });

  it('counts open, unassigned and overdue tickets', async () => {
    const a = await createTicket(homeowner, { title: 'Overdue burst pipe', priority: 'urgent' });
    await createTicket(homeowner, { title: 'Ordinary squeaky hinge' });

    await db.query("UPDATE tickets SET sla_deadline = now() - interval '2 hours' WHERE id = $1", [a.id]);
    await request(app).post(`/api/tickets/${a.id}/assign`)
      .set('Authorization', manager.auth()).send({ assignedTo: staff.id });

    const res = await request(app).get('/api/reports/summary').set('Authorization', manager.auth());

    expect(res.body.totals).toMatchObject({
      total: 2, open: 2, unassigned: 1, overdue: 1, createdLast7Days: 2,
    });
    expect(res.body.byStatus.open).toBe(2);
    expect(res.body.byPriority.urgent).toBe(1);
  });

  it('reports resolution time and SLA compliance once tickets close', async () => {
    const onTime = await createTicket(homeowner, { title: 'Resolved inside the SLA window' });
    const late = await createTicket(homeowner, { title: 'Resolved outside the SLA window' });

    await request(app).patch(`/api/tickets/${onTime.id}`)
      .set('Authorization', staff.auth()).send({ status: 'resolved' });

    // Force this one past its deadline before resolving, so one of each lands.
    await db.query("UPDATE tickets SET sla_deadline = now() - interval '1 hour' WHERE id = $1", [late.id]);
    await request(app).patch(`/api/tickets/${late.id}`)
      .set('Authorization', staff.auth()).send({ status: 'resolved' });

    const res = await request(app).get('/api/reports/summary').set('Authorization', manager.auth());

    expect(res.body.totals.slaCompliance).toBe(50);
    expect(res.body.totals.avgResolutionHours).toEqual(expect.any(Number));
    expect(res.body.totals.resolvedLast7Days).toBe(2);
    expect(res.body.byStatus.resolved).toBe(2);
  });

  it('breaks work down by category and assignee', async () => {
    const plumbing = await createTicket(homeowner, { category: 'plumbing' });
    await createTicket(homeowner, { category: 'electrical', title: 'Hallway light is out' });

    await request(app).post(`/api/tickets/${plumbing.id}/assign`)
      .set('Authorization', manager.auth()).send({ assignedTo: staff.id });

    const res = await request(app).get('/api/reports/summary').set('Authorization', manager.auth());

    const categories = Object.fromEntries(res.body.byCategory.map((c) => [c.category, c.count]));
    expect(categories).toMatchObject({ plumbing: 1, electrical: 1 });
    expect(res.body.byCategory.find((c) => c.category === 'plumbing').name).toBe('Plumbing');

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
