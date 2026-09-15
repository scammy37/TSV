# Local Development Setup

## Prerequisites

- Node.js 20+ (CI covers 20 and 22)
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

## CI

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`:

- **Backend tests** on Node 20 and 22, against a PostgreSQL 16 service
  container. The suite provisions its own test database, so the workflow only
  supplies `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`.
- **Frontend build** with `CI=true`, which promotes lint warnings to errors and
  so covers linting as well as compilation.

Both jobs install with `npm ci`, which enforces that `package-lock.json` is in
sync with `package.json`. If you change dependencies, commit the regenerated
lockfile or CI will fail before running anything.

## Running it as one service

Setting `SERVE_FRONTEND=true` makes the API serve `frontend/build` as well, so
the whole app runs on a single port with no CORS configuration:

```bash
cd frontend && REACT_APP_API_URL=/api npm run build
cd ../backend && SERVE_FRONTEND=true npm start   # whole app on :5000
```

This is what the devcontainer does, and it is the simplest shape to deploy:
one process, one origin. Requests under `/api` are handled by the API; every
other GET returns `index.html` so client-side routes work on a hard refresh.

## Demo data

```bash
cd backend && npm run seed
```

Loads six accounts and eight tickets spread across statuses, priorities and
dates, including overdue and resolved work so the reports page is not empty.
All demo accounts use the password `Password123!`; override with
`SEED_PASSWORD`. The script is a no-op if the demo data is already there, and
refuses to run when `NODE_ENV=production`.

## Codespaces

`.devcontainer/` provides a one-click environment: PostgreSQL, dependencies,
schema, demo data and a built frontend, served on port 5000. Create one from
**Code → Codespaces** on GitHub. To rebuild from scratch, run
**Codespaces: Rebuild Container** from the command palette.

Useful inside the codespace:

```bash
bash .devcontainer/start.sh                 # start the app (idempotent)
pkill -f "node server.js"                   # stop it
cat .devcontainer/logs/api.log              # server output
npm --prefix backend run migrate -- --reset # wipe and rebuild the database
npm --prefix backend run seed               # reload demo data
```

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
