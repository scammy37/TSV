#!/usr/bin/env node
/**
 * Loads demo accounts and a spread of tickets, for trying the app out.
 *
 *   npm run seed
 *
 * Refuses to run against NODE_ENV=production. Re-running is safe: it skips
 * seeding entirely if the demo homeowner already exists.
 */
const bcrypt = require('bcryptjs');

const config = require('../config');
const db = require('../db/connection');

const PASSWORD = process.env.SEED_PASSWORD || 'Password123!';

const USERS = [
  { email: 'manager@demo.test',  firstName: 'Morgan', lastName: 'Vale',    role: 'management' },
  { email: 'sam@demo.test',      firstName: 'Sam',    lastName: 'Okafor',  role: 'staff' },
  { email: 'priya@demo.test',    firstName: 'Priya',  lastName: 'Raman',   role: 'staff' },
  { email: 'dana@demo.test',     firstName: 'Dana',   lastName: 'Reyes',   role: 'homeowner', unitNumber: '4B' },
  { email: 'alex@demo.test',     firstName: 'Alex',   lastName: 'Whitfield', role: 'homeowner', unitNumber: '12C' },
  { email: 'jordan@demo.test',   firstName: 'Jordan', lastName: 'Nakamura', role: 'homeowner', unitNumber: '7A' },
];

// daysAgo drives created_at so the reports page has a real trend to draw.
const TICKETS = [
  {
    homeowner: 'dana@demo.test', title: 'Kitchen sink is leaking badly',
    description: 'Water pools under the cabinet every morning and the wood is starting to swell.',
    category: 'plumbing', priority: 'high', location: 'Under the kitchen sink',
    assignee: 'sam@demo.test', status: 'in_progress', daysAgo: 2,
    comments: [
      { from: 'sam@demo.test', body: 'Plumber is booked for Thursday morning between 9 and 11.' },
      { from: 'sam@demo.test', body: 'Third callout this quarter -- flag to the vendor.', internal: true },
      { from: 'dana@demo.test', body: 'Thank you. It got worse overnight, there is water on the floor now.' },
    ],
  },
  {
    homeowner: 'alex@demo.test', title: 'Hallway light flickering all night',
    description: 'The light outside my door flickers constantly and is keeping us awake.',
    category: 'electrical', priority: 'high', assignee: 'priya@demo.test',
    status: 'in_progress', daysAgo: 1,
    comments: [{ from: 'priya@demo.test', body: 'Replacing the ballast this afternoon.' }],
  },
  {
    homeowner: 'jordan@demo.test', title: 'No hot water since Tuesday',
    description: 'The water never gets above lukewarm, at any time of day.',
    category: 'plumbing', priority: 'high', daysAgo: 0,
  },
  {
    homeowner: 'dana@demo.test', title: 'Dishwasher not draining properly',
    description: 'Standing water is left in the bottom after every cycle.',
    category: 'appliance', priority: 'medium', daysAgo: 4,
  },
  {
    homeowner: 'alex@demo.test', title: 'Balcony door will not latch',
    description: 'The sliding door on the balcony no longer latches shut and swings open in wind.',
    category: 'structural', priority: 'medium', assignee: 'sam@demo.test',
    status: 'on_hold', daysAgo: 9,
    comments: [{ from: 'sam@demo.test', body: 'Waiting on the replacement latch, due next week.' }],
  },
  {
    homeowner: 'jordan@demo.test', title: 'Ants in the kitchen cupboards',
    description: 'A trail of ants along the counter every morning, coming from behind the cupboard.',
    category: 'pest_control', priority: 'low', assignee: 'priya@demo.test',
    status: 'resolved', daysAgo: 12, resolvedDaysAgo: 10,
    resolution: 'Pest control treated the unit and sealed the gap behind the cupboard.',
  },
  {
    homeowner: 'dana@demo.test', title: 'Gym treadmill making a grinding noise',
    description: 'The treadmill nearest the window grinds loudly under load.',
    category: 'common_area', priority: 'low', assignee: 'sam@demo.test',
    status: 'resolved', daysAgo: 20, resolvedDaysAgo: 6,
    resolution: 'Belt replaced and deck re-lubricated by the service contractor.',
  },
  {
    homeowner: 'alex@demo.test', title: 'Parking gate opens very slowly',
    description: 'The gate takes almost a minute to open, causing a queue at rush hour.',
    category: 'security', priority: 'medium', assignee: 'priya@demo.test',
    status: 'closed', daysAgo: 30, resolvedDaysAgo: 24,
    resolution: 'Motor serviced and the chain tension adjusted.',
  },
];

const daysAgoTs = (days) => new Date(Date.now() - days * 86400000);

async function seed() {
  if (config.isProduction) {
    throw new Error('Refusing to seed demo data with NODE_ENV=production');
  }

  const existing = await db.query('SELECT 1 FROM users WHERE email = $1', ['dana@demo.test']);
  if (existing.rowCount > 0) {
    console.log('Demo data is already present -- nothing to do.');
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, config.bcryptRounds);
  const ids = {};

  for (const user of USERS) {
    const { rows } = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, unit_number)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
       RETURNING id`,
      [user.email, passwordHash, user.firstName, user.lastName, user.role, user.unitNumber || null],
    );
    ids[user.email] = rows[0].id;
  }
  console.log(`Created ${USERS.length} demo accounts (password: ${PASSWORD})`);

  let count = 0;
  for (const t of TICKETS) {
    const createdAt = daysAgoTs(t.daysAgo);
    const resolvedAt = t.resolvedDaysAgo === undefined ? null : daysAgoTs(t.resolvedDaysAgo);
    const status = t.status || 'open';
    const assignee = t.assignee ? ids[t.assignee] : null;

    const numbered = await db.query("SELECT nextval('ticket_number_seq') AS n");
    const ticketNumber = `TSV-${createdAt.getFullYear()}-${String(numbered.rows[0].n).padStart(5, '0')}`;

    const { rows } = await db.query(
      `INSERT INTO tickets (ticket_number, homeowner_id, created_by, assigned_to, category,
                            priority, status, title, description, location_details, unit_number,
                            first_response_at, resolved_at, closed_at,
                            resolution_notes, created_at, updated_at)
       VALUES ($1,$2,$2,$3,$4,$5,$6,$7,$8,$9,
               (SELECT unit_number FROM users WHERE id = $2),
               $10,$11,$12,$13,$14,$14)
       RETURNING id`,
      [
        ticketNumber, ids[t.homeowner], assignee, t.category, t.priority, status,
        t.title, t.description, t.location || null,
        assignee ? daysAgoTs(t.daysAgo - 0.2) : null,
        resolvedAt,
        status === 'closed' ? resolvedAt : null,
        t.resolution || null,
        createdAt,
      ],
    );
    const ticketId = rows[0].id;

    await db.query(
      `INSERT INTO ticket_activity (ticket_id, user_id, action, new_value, created_at)
       VALUES ($1, $2, 'created', $3, $4)`,
      [ticketId, ids[t.homeowner], ticketNumber, createdAt],
    );

    for (const [i, c] of (t.comments || []).entries()) {
      const at = new Date(createdAt.getTime() + (i + 1) * 3600000);
      await db.query(
        `INSERT INTO ticket_comments (ticket_id, user_id, comment, is_internal, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)`,
        [ticketId, ids[c.from], c.body, Boolean(c.internal), at],
      );
      await db.query(
        `INSERT INTO ticket_activity (ticket_id, user_id, action, created_at)
         VALUES ($1, $2, $3, $4)`,
        [ticketId, ids[c.from], c.internal ? 'commented_internal' : 'commented', at],
      );
    }
    count += 1;
  }

  console.log(`Created ${count} demo tickets`);
  console.log('\nSign in with any of:');
  USERS.forEach((u) => console.log(`  ${u.email.padEnd(22)} ${u.role}`));
  console.log(`\nAll use the password: ${PASSWORD}`);
}

if (require.main === module) {
  seed()
    .then(() => db.pool.end())
    .catch(async (err) => {
      console.error('Seed failed:', err.message);
      await db.pool.end();
      process.exit(1);
    });
}

module.exports = seed;
