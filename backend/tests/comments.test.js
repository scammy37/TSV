const {
  app, db, request, resetDatabase, createUser, createTicket, waitForEmail,
} = require('./helpers');

let homeowner;
let otherHomeowner;
let staff;

beforeEach(async () => {
  await resetDatabase();
  [homeowner, otherHomeowner, staff] = await Promise.all([
    createUser({ role: 'homeowner' }),
    createUser({ role: 'homeowner' }),
    createUser({ role: 'staff' }),
  ]);
});

afterAll(() => db.pool.end());

describe('ticket comments', () => {
  it('records a homeowner comment and returns it with the author', async () => {
    const ticket = await createTicket(homeowner);

    const res = await request(app).post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', homeowner.auth())
      .send({ comment: 'It got worse overnight.' });

    expect(res.status).toBe(201);
    expect(res.body.comment).toMatchObject({ comment: 'It got worse overnight.', isInternal: false });
    expect(res.body.comment.author.id).toBe(homeowner.id);
  });

  it('hides internal notes from the homeowner but shows them to staff', async () => {
    const ticket = await createTicket(homeowner);

    await request(app).post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', staff.auth())
      .send({ comment: 'Plumber booked for Thursday.', isInternal: false });

    await request(app).post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', staff.auth())
      .send({ comment: 'Third callout this quarter; escalate to the vendor.', isInternal: true });

    const asHomeowner = await request(app).get(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', homeowner.auth());
    expect(asHomeowner.body.comments).toHaveLength(1);
    expect(asHomeowner.body.comments[0].comment).toMatch(/Plumber booked/);

    const asStaff = await request(app).get(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', staff.auth());
    expect(asStaff.body.comments).toHaveLength(2);
  });

  it('forces a homeowner comment to be public even if it asks to be internal', async () => {
    const ticket = await createTicket(homeowner);

    const res = await request(app).post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', homeowner.auth())
      .send({ comment: 'Trying to hide this.', isInternal: true });

    expect(res.body.comment.isInternal).toBe(false);
  });

  it('refuses comments on another homeowner ticket', async () => {
    const ticket = await createTicket(otherHomeowner);

    const res = await request(app).post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', homeowner.auth())
      .send({ comment: 'Not my ticket.' });

    expect(res.status).toBe(404);
  });

  it('rejects an empty comment', async () => {
    const ticket = await createTicket(homeowner);
    const res = await request(app).post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', homeowner.auth()).send({ comment: '   ' });

    expect(res.status).toBe(400);
  });

  it('emails the homeowner about a public staff reply', async () => {
    const ticket = await createTicket(homeowner);

    await request(app).post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', staff.auth())
      .send({ comment: 'We are on our way.' });

    const rows = await waitForEmail(
      "ticket_id = $1 AND template = 'ticket_comment' AND recipient_email = $2",
      [ticket.id, homeowner.email],
    );
    expect(rows).toHaveLength(1);
  });

  it('never emails the homeowner about an internal note', async () => {
    const ticket = await createTicket(homeowner);

    await request(app).post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', staff.auth())
      .send({ comment: 'Internal only.', isInternal: true });

    // Let any stray notification land before asserting it did not happen.
    await new Promise((resolve) => setTimeout(resolve, 150));
    const { rows } = await db.query(
      "SELECT 1 FROM email_logs WHERE ticket_id = $1 AND template = 'ticket_comment'",
      [ticket.id],
    );
    expect(rows).toHaveLength(0);
  });

  it('counts a public staff reply as the first response', async () => {
    const ticket = await createTicket(homeowner);
    expect(ticket.firstResponseAt).toBeNull();

    await request(app).post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', staff.auth()).send({ comment: 'Looking into it now.' });

    const res = await request(app).get(`/api/tickets/${ticket.id}`).set('Authorization', staff.auth());
    expect(res.body.ticket.firstResponseAt).not.toBeNull();
  });

  it('hides internal-note activity from the homeowner', async () => {
    const ticket = await createTicket(homeowner);

    await request(app).post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', staff.auth()).send({ comment: 'Public note.' });
    await request(app).post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', staff.auth()).send({ comment: 'Private note.', isInternal: true });

    const asHomeowner = await request(app).get(`/api/tickets/${ticket.id}/activity`)
      .set('Authorization', homeowner.auth());
    expect(asHomeowner.body.activity.map((a) => a.action)).toEqual(['created', 'commented']);

    const asStaff = await request(app).get(`/api/tickets/${ticket.id}/activity`)
      .set('Authorization', staff.auth());
    expect(asStaff.body.activity.map((a) => a.action))
      .toEqual(['created', 'commented', 'commented_internal']);
  });

  it('logs each comment in the activity trail', async () => {
    const ticket = await createTicket(homeowner);

    await request(app).post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', staff.auth()).send({ comment: 'Public note.' });
    await request(app).post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', staff.auth()).send({ comment: 'Private note.', isInternal: true });

    const res = await request(app).get(`/api/tickets/${ticket.id}/activity`)
      .set('Authorization', staff.auth());

    const actions = res.body.activity.map((a) => a.action);
    expect(actions).toEqual(['created', 'commented', 'commented_internal']);
  });
});
