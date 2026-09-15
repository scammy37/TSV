# Ticket System for Property Management

A ticket/work order management system for apartment complexes. Homeowners submit
service requests, track their status and talk to management. Management triages,
assigns, and resolves them against SLA targets.

## Project Structure

```
/frontend          React application (homeowner & management portals)
/backend           Node.js/Express API server, PostgreSQL schema and migrations
/docs              Setup documentation
```

## Tech Stack

- **Frontend**: React 18, React Router, Axios, plain CSS (light + dark)
- **Backend**: Node.js, Express, JWT authentication, Joi validation
- **Database**: PostgreSQL
- **Email**: Nodemailer over SMTP (optional -- the app runs fine without it)
- **Tests**: Jest + supertest, run against a real PostgreSQL database

## Features

### Homeowner Portal
- Submit service requests with category, priority and location
- Track status in real time, with the SLA target date shown
- Comment back and forth with management
- Correct a request's details while it is still open
- Full history of everything that happened to a ticket
- Email notification on submission, status change, reply and resolution

### Management Portal
- Queue of every ticket, with quick views for unassigned, mine and overdue
- Filter by status, priority, category and assignee; free-text search; pagination
- Assign to staff, with each person's open workload shown in the picker
- Change priority (which recalculates the SLA deadline) and move status
- Internal notes the homeowner never sees
- Reports: volume, SLA compliance, average resolution and first-response time,
  per-category and per-assignee breakdowns, daily volume
- People directory: promote, demote and deactivate accounts

### Core
- Role-based access control (homeowner / staff / management), enforced in the API
- Self-service password reset, with single-use hashed tokens that expire in an hour
- JWT authentication; deactivating an account invalidates its token immediately
- Enforced status transitions, so the audit trail cannot contain nonsense
- SLA deadlines by priority, measured from when the ticket was filed
- Append-only activity log on every ticket
- Every notification recorded in `email_logs`, sent or not

## Try it without installing anything

On GitHub, click **Code → Codespaces → Create codespace on this branch** and
wait a couple of minutes for it to build. The devcontainer starts PostgreSQL, installs
dependencies, applies the schema, loads demo data and builds the frontend, then
serves the whole app on port 5000. Click the globe icon next to port 5000 in the
**Ports** tab to open it.

Demo accounts (password `Password123!`):

| Account | Role | What you see |
|---|---|---|
| `manager@demo.test` | management | Triage queue, reports, people directory |
| `sam@demo.test` | staff | Assigned work, internal notes |
| `dana@demo.test` | homeowner | Only their own requests |

Sign in as the manager and the homeowner in two browser profiles to watch both
sides of the same ticket. The seeded data includes overdue tickets, an internal
note, and resolved work, so the reports page has something to show.

Codespaces is free for a monthly allowance on personal accounts and the
codespace stops on its own when idle.

## Getting Started (local)

See **[docs/SETUP.md](docs/SETUP.md)** for the full walkthrough. The short version:

```bash
createdb tsv_db

cd backend && npm install && cp .env.example .env
# set DB_PASSWORD, JWT_SECRET and STAFF_INVITE_CODE in .env
npm run migrate && npm run dev

cd ../frontend && npm install && cp .env.example .env && npm start
```

Then register a homeowner and a management account at
<http://localhost:3000/register>. Management signup needs the
`STAFF_INVITE_CODE` you put in `backend/.env`. Or run
`npm run seed` in `backend` to load the same demo accounts the Codespace uses.

## Deploying

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**. The app deploys as one service:
the API serves the built frontend, so there is one process, one port and one
origin. `.replit` is configured for Replit; the same build and run commands work
on any host that provides `DATABASE_URL`.

Two things to do before real residents use it: create the first manager with
`npm run create-admin` rather than the demo seed, and prove email works with
`npm run check:email` — notifications fail silently by design, so an
unconfigured mail server means no one is ever notified of anything.

## Development

- API reference, role matrix, ticket lifecycle and SLA policy: [`backend/README.md`](backend/README.md)
- Routes and frontend layout: [`frontend/README.md`](frontend/README.md)
- `cd backend && npm test` runs the integration suite against a `tsv_test` database.

## License

MIT
