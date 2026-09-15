# Local Development Setup

## Prerequisites

- Node.js 16+
- PostgreSQL 12+
- Git

## 1. Database

```bash
createdb tsv_db
```

The schema is applied by the backend's migrate script in the next step -- you do
not need to run `psql` against `schema.sql` yourself.

## 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and set at minimum:

- `DB_PASSWORD` -- your local PostgreSQL password
- `JWT_SECRET` -- any long random string
  (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
- `STAFF_INVITE_CODE` -- any value; needed to create the first manager account

Then:

```bash
npm run migrate
npm run dev          # http://localhost:5000
```

Check it is up: `curl localhost:5000/api/health`

SMTP can stay unconfigured. Notifications are then recorded in the `email_logs`
table with status `skipped` instead of being sent.

## 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm start            # http://localhost:3000
```

## 4. Create accounts

Open <http://localhost:3000/register>.

- **Homeowner** -- pick "Homeowner", no code needed.
- **Management** -- pick "Management" and enter the `STAFF_INVITE_CODE` you set
  in `backend/.env`.

Register one of each to see both portals. From the People page a manager can
promote anyone else, so the invite code is only needed to bootstrap.

## Tests

```bash
cd backend && npm test
```

Creates and migrates a separate `tsv_test` database automatically. It never
touches `tsv_db`.

## Resetting

```bash
cd backend && npm run migrate -- --reset    # drops and recreates every table
```

## Troubleshooting

**`ECONNREFUSED` on startup** -- PostgreSQL is not running, or `DB_HOST`/
`DB_PORT` are wrong.

**`password authentication failed`** -- `DB_USER`/`DB_PASSWORD` do not match
your local PostgreSQL role.

**Login works but every other call 401s** -- `JWT_SECRET` changed since the
token was issued. Sign in again.

**CORS errors in the browser** -- `FRONTEND_URL` in `backend/.env` must match
the origin the frontend is served from.

**"Staff registration is disabled"** -- `STAFF_INVITE_CODE` is blank in
`backend/.env`. Set it and restart the API.
