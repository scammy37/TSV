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
- JWT authentication; deactivating an account invalidates its token immediately
- Enforced status transitions, so the audit trail cannot contain nonsense
- SLA deadlines by priority, measured from when the ticket was filed
- Append-only activity log on every ticket
- Every notification recorded in `email_logs`, sent or not

## Getting Started

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
`STAFF_INVITE_CODE` you put in `backend/.env`.

## Development

- API reference, role matrix, ticket lifecycle and SLA policy: [`backend/README.md`](backend/README.md)
- Routes and frontend layout: [`frontend/README.md`](frontend/README.md)
- `cd backend && npm test` runs the integration suite against a `tsv_test` database.

## License

MIT
