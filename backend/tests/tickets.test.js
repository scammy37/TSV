const {
  app, db, request, resetDatabase, createUser, createTicket, waitForEmail,
} = require('./helpers');

let homeowner;
let otherHomeowner;
let staff;
let manager;

beforeEach(async () => {
  await resetDatabase();
  [homeowner, otherHomeowner, staff, manager] = await Promise.all([
    createUser({ role: 'homeowner', unitNumber: '101' }),
    createUser({ role: 'homeowner', unitNumber: '202' }),
    createUser({ role: 'staff' }),
    createUser({ role: 'management' }),
  ]);
});

afterAll(() => db.pool.end());

describe('POST /api/tickets', () => {
  it('files a ticket with a number, an age and an audit entry', async () => {
    const ticket = await createTicket(homeowner, { priority: 'high' });

    expect(ticket.ticketNumber).toMatch(/^TSV-\d{4}-\d{5}$/);
    expect(ticket.status).toBe('open');
    expect(ticket.priority).toBe('high');
    expect(ticket.homeowner.id).toBe(homeowner.id);
    expect(ticket.assignee).toBeNull();
    // A ticket filed just now is zero hours old.
    expect(ticket.ageHours).toBe(0);

    const activity = await request(app).get(`/api/tickets/${ticket.id}/activity`)
      .set('Authorization', homeowner.auth());
    expect(activity.body.activity).toHaveLength(1);
    expect(activity.body.activity[0].action).toBe('created');
  });

  it('inherits the unit number from the homeowner profile', async () => {
    const ticket = await createTicket(homeowner);
    expect(ticket.unitNumber).toBe('101');
  });

  it('rejects an unknown category', async () => {
    const res = await request(app).post('/api/tickets')
      .set('Authorization', homeowner.auth())
      .send({ title: 'Something broke', description: 'A description long enough.', category: 'teleportation' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unknown category/);
  });

  it('rejects a too-short title', async () => {
    const res = await request(app).post('/api/tickets')
      .set('Authorization', homeowner.auth())
      .send({ title: 'Hi', description: 'A description long enough.', category: 'plumbing' });

    expect(res.status).toBe(400);
  });

  it('lets staff file on a homeowner behalf', async () => {
    const res = await request(app).post('/api/tickets')
      .set('Authorization', staff.auth())
      .send({
        title: 'Reported by phone: no hot water',
        description: 'Homeowner called the office about no hot water since Tuesday.',
        category: 'plumbing',
        homeownerId: homeowner.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.ticket.homeowner.id).toBe(homeowner.id);
  });

  it('stops a homeowner filing on someone else behalf', async () => {
    const res = await request(app).post('/api/tickets')
      .set('Authorization', homeowner.auth())
      .send({
        title: 'Not my unit at all',
        description: 'Trying to file against a neighbour unit.',
        category: 'plumbing',
        homeownerId: otherHomeowner.id,
      });

    expect(res.status).toBe(403);
  });

  it('logs a notification for the homeowner and management', async () => {
    const ticket = await createTicket(homeowner);

    const rows = await waitForEmail('ticket_id = $1', [ticket.id]);
    await waitForEmail("ticket_id = $1 AND recipient_email = $2", [ticket.id, manager.email]);

    expect(rows.map((r) => r.recipient_email)).toContain(homeowner.email);
  });
});

describe('GET /api/tickets', () => {
  it('scopes a homeowner to their own tickets', async () => {
    await createTicket(homeowner, { title: 'Mine: leaking sink' });
    await createTicket(otherHomeowner, { title: 'Theirs: broken heater' });

    const res = await request(app).get('/api/tickets').set('Authorization', homeowner.auth());

    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(1);
    expect(res.body.tickets[0].title).toBe('Mine: leaking sink');
  });

  it('shows staff every ticket', async () => {
    await createTicket(homeowner);
    await createTicket(otherHomeowner);

    const res = await request(app).get('/api/tickets').set('Authorization', staff.auth());
    expect(res.body.tickets).toHaveLength(2);
  });

  it('ignores a homeownerId filter from a homeowner', async () => {
    await createTicket(otherHomeowner);

    const res = await request(app).get(`/api/tickets?homeownerId=${otherHomeowner.id}`)
      .set('Authorization', homeowner.auth());

    expect(res.body.tickets).toHaveLength(0);
  });

  it('filters by status, priority and free text', async () => {
    const a = await createTicket(homeowner, { title: 'Urgent burst pipe', priority: 'high' });
    await createTicket(homeowner, { title: 'Low priority squeaky door', priority: 'low' });

    await request(app).patch(`/api/tickets/${a.id}`)
      .set('Authorization', staff.auth()).send({ status: 'in_progress' });

    const byStatus = await request(app).get('/api/tickets?status=in_progress')
      .set('Authorization', staff.auth());
    expect(byStatus.body.tickets).toHaveLength(1);
    expect(byStatus.body.tickets[0].id).toBe(a.id);

    const byPriority = await request(app).get('/api/tickets?priority=low')
      .set('Authorization', staff.auth());
    expect(byPriority.body.tickets).toHaveLength(1);

    const bySearch = await request(app).get('/api/tickets?q=squeaky')
      .set('Authorization', staff.auth());
    expect(bySearch.body.tickets).toHaveLength(1);
    expect(bySearch.body.tickets[0].title).toMatch(/squeaky/);
  });

  it('filters the unassigned queue and "assigned to me"', async () => {
    const assigned = await createTicket(homeowner);
    await createTicket(otherHomeowner);

    await request(app).post(`/api/tickets/${assigned.id}/assign`)
      .set('Authorization', manager.auth()).send({ assignedTo: staff.id });

    const unassigned = await request(app).get('/api/tickets?assignedTo=unassigned')
      .set('Authorization', manager.auth());
    expect(unassigned.body.tickets).toHaveLength(1);

    const mine = await request(app).get('/api/tickets?assignedTo=me')
      .set('Authorization', staff.auth());
    expect(mine.body.tickets).toHaveLength(1);
    expect(mine.body.tickets[0].id).toBe(assigned.id);
  });

  it('orders by age, oldest first', async () => {
    const older = await createTicket(homeowner, { title: 'Filed a while ago' });
    await db.query("UPDATE tickets SET created_at = now() - interval '9 days' WHERE id = $1", [older.id]);
    await createTicket(homeowner, { title: 'Filed just now' });

    const res = await request(app).get('/api/tickets?sort=created_at&order=asc')
      .set('Authorization', staff.auth());

    expect(res.body.tickets[0].id).toBe(older.id);
    expect(res.body.tickets[0].ageHours).toBeGreaterThanOrEqual(24 * 9);
  });

  it('paginates', async () => {
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await createTicket(homeowner, { title: `Sequential issue number ${i}` });
    }

    const res = await request(app).get('/api/tickets?limit=2&page=2').set('Authorization', homeowner.auth());
    expect(res.body.tickets).toHaveLength(2);
    expect(res.body.pagination).toMatchObject({ page: 2, limit: 2, total: 5, totalPages: 3 });
  });

  it('rejects an invalid sort column', async () => {
    const res = await request(app).get('/api/tickets?sort=password_hash')
      .set('Authorization', staff.auth());
    expect(res.status).toBe(400);
  });
});

describe('GET /api/tickets/:id', () => {
  it('hides another homeowner ticket behind a 404', async () => {
    const ticket = await createTicket(otherHomeowner);
    const res = await request(app).get(`/api/tickets/${ticket.id}`)
      .set('Authorization', homeowner.auth());

    expect(res.status).toBe(404);
  });

  it('returns 404 for a ticket that does not exist', async () => {
    const res = await request(app).get('/api/tickets/999999').set('Authorization', staff.auth());
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/tickets/:id', () => {
  it('lets staff triage status and priority, recording each change', async () => {
    const ticket = await createTicket(homeowner);

    const res = await request(app).patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', staff.auth())
      .send({ status: 'in_progress', priority: 'high' });

    expect(res.status).toBe(200);
    expect(res.body.ticket).toMatchObject({ status: 'in_progress', priority: 'high' });
    expect(res.body.changed).toEqual(expect.arrayContaining(['status', 'priority']));
    expect(res.body.ticket.firstResponseAt).not.toBeNull();

    const activity = await request(app).get(`/api/tickets/${ticket.id}/activity`)
      .set('Authorization', staff.auth());
    const fields = activity.body.activity.map((a) => a.field);
    expect(fields).toEqual(expect.arrayContaining(['status', 'priority']));
  });

  it('raises priority without touching when the ticket was filed', async () => {
    const ticket = await createTicket(homeowner, { priority: 'low' });

    const res = await request(app).patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', staff.auth()).send({ priority: 'high' });

    expect(res.body.ticket.priority).toBe('high');
    expect(res.body.ticket.createdAt).toBe(ticket.createdAt);
  });

  it('refuses a priority outside low, medium and high', async () => {
    const ticket = await createTicket(homeowner);

    const res = await request(app).patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', staff.auth()).send({ priority: 'urgent' });

    expect(res.status).toBe(400);
  });

  it('refuses an illegal status transition', async () => {
    const ticket = await createTicket(homeowner);
    const res = await request(app).patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', staff.auth()).send({ status: 'closed' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot move a ticket/);
  });

  it('stamps resolvedAt on resolve and clears it on reopen', async () => {
    const ticket = await createTicket(homeowner);

    const resolved = await request(app).patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', staff.auth())
      .send({ status: 'resolved', resolutionNotes: 'Replaced the supply line.' });
    expect(resolved.body.ticket.resolvedAt).not.toBeNull();

    const reopened = await request(app).patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', staff.auth()).send({ status: 'in_progress' });
    expect(reopened.body.ticket.resolvedAt).toBeNull();
  });

  it('lets a homeowner correct their own open ticket', async () => {
    const ticket = await createTicket(homeowner);
    const res = await request(app).patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', homeowner.auth())
      .send({ description: 'Correction: it only leaks when the dishwasher runs.' });

    expect(res.status).toBe(200);
    expect(res.body.ticket.description).toMatch(/dishwasher/);
  });

  it('stops a homeowner setting their own priority or status', async () => {
    const ticket = await createTicket(homeowner);

    const priority = await request(app).patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', homeowner.auth()).send({ priority: 'high' });
    expect(priority.status).toBe(403);

    const status = await request(app).patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', homeowner.auth()).send({ status: 'resolved' });
    expect(status.status).toBe(403);
  });

  it('stops a homeowner editing a closed ticket', async () => {
    const ticket = await createTicket(homeowner);
    await request(app).patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', staff.auth()).send({ status: 'resolved' });
    await request(app).patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', staff.auth()).send({ status: 'closed' });

    const res = await request(app).patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', homeowner.auth()).send({ title: 'Trying to edit after close' });

    expect(res.status).toBe(403);
  });

  it('is a no-op when nothing actually changes', async () => {
    const ticket = await createTicket(homeowner);
    const res = await request(app).patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', staff.auth()).send({ title: ticket.title });

    expect(res.status).toBe(200);
    expect(res.body.changed).toEqual([]);
  });
});

describe('DELETE /api/tickets/:id', () => {
  it('removes the ticket, its comments and its audit trail', async () => {
    const ticket = await createTicket(homeowner);
    await request(app).post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', manager.auth()).send({ comment: 'Looking into it now.' });

    const res = await request(app).delete(`/api/tickets/${ticket.id}`)
      .set('Authorization', manager.auth());
    expect(res.status).toBe(204);

    const gone = await request(app).get(`/api/tickets/${ticket.id}`)
      .set('Authorization', manager.auth());
    expect(gone.status).toBe(404);

    const comments = await db.query('SELECT 1 FROM ticket_comments WHERE ticket_id = $1', [ticket.id]);
    expect(comments.rowCount).toBe(0);
    const trail = await db.query('SELECT 1 FROM ticket_activity WHERE ticket_id = $1', [ticket.id]);
    expect(trail.rowCount).toBe(0);
  });

  it('keeps the record of emails already sent, detached from the ticket', async () => {
    const ticket = await createTicket(homeowner);
    await waitForEmail('ticket_id = $1', [ticket.id]);

    await request(app).delete(`/api/tickets/${ticket.id}`).set('Authorization', manager.auth());

    const { rows } = await db.query(
      'SELECT ticket_id FROM email_logs WHERE recipient_email = $1', [homeowner.email],
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.ticket_id === null)).toBe(true);
  });

  it('leaves the rest of the queue alone', async () => {
    const [doomed, keeper] = [await createTicket(homeowner), await createTicket(otherHomeowner)];

    await request(app).delete(`/api/tickets/${doomed.id}`).set('Authorization', manager.auth());

    const res = await request(app).get('/api/tickets').set('Authorization', manager.auth());
    expect(res.body.tickets.map((t) => t.id)).toEqual([keeper.id]);
  });

  it('is closed to staff and to the homeowner who filed it', async () => {
    const ticket = await createTicket(homeowner);

    const asStaff = await request(app).delete(`/api/tickets/${ticket.id}`)
      .set('Authorization', staff.auth());
    expect(asStaff.status).toBe(403);

    const asOwner = await request(app).delete(`/api/tickets/${ticket.id}`)
      .set('Authorization', homeowner.auth());
    expect(asOwner.status).toBe(403);

    const still = await request(app).get(`/api/tickets/${ticket.id}`)
      .set('Authorization', manager.auth());
    expect(still.status).toBe(200);
  });

  it('404s for a ticket that does not exist', async () => {
    const res = await request(app).delete('/api/tickets/999999')
      .set('Authorization', manager.auth());
    expect(res.status).toBe(404);
  });
});

describe('POST /api/tickets/:id/assign', () => {
  it('assigns and then unassigns a ticket', async () => {
    const ticket = await createTicket(homeowner);

    const assigned = await request(app).post(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', manager.auth()).send({ assignedTo: staff.id });
    expect(assigned.status).toBe(200);
    expect(assigned.body.ticket.assignee.id).toBe(staff.id);

    const unassigned = await request(app).post(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', manager.auth()).send({ assignedTo: null });
    expect(unassigned.body.ticket.assignee).toBeNull();
  });

  it('refuses to assign a ticket to a homeowner', async () => {
    const ticket = await createTicket(homeowner);
    const res = await request(app).post(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', manager.auth()).send({ assignedTo: otherHomeowner.id });

    expect(res.status).toBe(400);
  });

  it('refuses assignment by a homeowner', async () => {
    const ticket = await createTicket(homeowner);
    const res = await request(app).post(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', homeowner.auth()).send({ assignedTo: staff.id });

    expect(res.status).toBe(403);
  });

  it('emails the new assignee', async () => {
    const ticket = await createTicket(homeowner);
    await request(app).post(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', manager.auth()).send({ assignedTo: staff.id });

    // The notification is fire-and-forget, so wait for it to land.
    const rows = await waitForEmail(
      "ticket_id = $1 AND template = 'ticket_assigned' AND recipient_email = $2",
      [ticket.id, staff.email],
    );
    expect(rows).toHaveLength(1);
  });
});
