# TSV Backend

Express + PostgreSQL API for the ticket management system.

## Setup

```bash
npm install
cp .env.example .env      # then fill in DB_PASSWORD, JWT_SECRET, STAFF_INVITE_CODE
createdb tsv_db
npm run migrate           # applies db/schema.sql (idempotent)
npm run dev               # http://localhost:5000
```

`npm run migrate -- --reset` drops every table first, for a clean rebuild.

Email is optional. With `SMTP_HOST`/`SMTP_USER` blank the app runs normally and
records what it *would* have sent in the `email_logs` table with status
`skipped`, so you can develop without a mail server.

## Creating the first management account

Homeowners self-register. Staff and management accounts require the shared
`STAFF_INVITE_CODE` from `.env`:

```bash
curl -X POST localhost:5000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"ChangeMe123!","firstName":"Jane",
       "lastName":"Doe","role":"management","staffInviteCode":"<your code>"}'
```

After that you can promote people from the People page in the UI. Leave
`STAFF_INVITE_CODE` blank in production once your managers exist, and staff
self-registration is refused outright.

## Tests

```bash
npm test
```

Integration tests run against a real PostgreSQL database (`tsv_test` by
default), created and migrated automatically before the suite. They use the
same `DB_HOST`/`DB_USER`/`DB_PASSWORD` as development and never touch `tsv_db`.

## Roles

| Role | Can do |
|---|---|
| `homeowner` | File tickets, see and comment on **their own** tickets, edit them while open |
| `staff` | See and triage every ticket, assign, comment, post internal notes, view reports |
| `management` | Everything staff can do, plus the people directory and role changes |

Homeowners never see internal notes, and never see that one exists.

## API

All routes are under `/api`. Everything except `/api/health`, `/api/auth/login`
and `/api/auth/register` requires `Authorization: Bearer <token>`.

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | Homeowner signup; staff/management need `staffInviteCode` |
| POST | `/auth/login` | Returns `{ token, user }` |
| GET | `/auth/me` | Current user |
| PATCH | `/auth/me` | Update name, address, phone |
| POST | `/auth/change-password` | Requires the current password; returns a fresh `{ token, user }` because the change signs out every other session |

### Tickets
| Method | Path | Notes |
|---|---|---|
| GET | `/tickets` | Filters: `status`, `priority`, `category`, `assignedTo` (id, `me`, `unassigned`), `homeownerId`, `q`, `open`, `overdue`, `sort`, `order`, `page`, `limit`. Homeowners are always scoped to their own tickets. |
| POST | `/tickets` | Staff may pass `homeownerId` to file on someone's behalf |
| GET | `/tickets/:id` | |
| PATCH | `/tickets/:id` | Triage. Homeowners may only edit title/description/category/location, and only while the ticket is open |
| POST | `/tickets/:id/assign` | `{ assignedTo: <id or null> }`, staff only |
| GET | `/tickets/:id/comments` | Internal notes filtered out for homeowners |
| POST | `/tickets/:id/comments` | `{ comment, isInternal }`; `isInternal` is ignored for homeowners |
| GET | `/tickets/:id/activity` | Audit trail |

### Other
| Method | Path | Notes |
|---|---|---|
| GET | `/meta` | Categories, priorities and statuses with their legal transitions |
| GET | `/users/assignable` | Staff directory with open workload; staff only |
| GET | `/users`, `GET /users/:id`, `PATCH /users/:id` | Management only |
| POST | `/users/:id/reset-password` | Management only. Returns `{ user, temporaryPassword }`; the plaintext appears in this response and nowhere else |
| GET | `/reports/summary` | Volume, SLA and workload figures; staff only |
| GET | `/health` | Public |

## Getting a locked-out resident back in

The emailed reset link is the normal route, but it only works where outbound
SMTP does -- which rules out several managed hosts, Render among them. So
management can issue a temporary password directly, from **People -> Reset
password**.

What that does, and why:

| | |
|---|---|
| The password is generated, not chosen | A manager cannot set it to something they know the resident uses elsewhere |
| `must_change_password` is set | The account can do nothing but replace it, so the manager's knowledge of it dies at first use |
| `password_changed_at` is stamped | Every session opened before the reset is rejected, making this the tool for shutting out an intruder too |
| Outstanding reset tokens are consumed | An emailed link already in flight cannot be used to set a password of someone else's choosing |

The plaintext is returned once, in the response body. It is not logged, not
emailed and not stored -- if it is lost before it reaches the resident, issue
another one.

`password_changed_at` is null for accounts that predate this feature, so
deploying it does not sign anybody out.

## Ticket lifecycle

```
open ──> in_progress ──> resolved ──> closed
  │          ↕                │
  │       on_hold             └──> in_progress (reopen)
  └──> cancelled ──> open
```

Illegal jumps are rejected with a 400 listing the legal next statuses, so the
audit trail can never contain a nonsensical transition.

## SLA

Deadlines are set from the time the ticket was filed, by priority:

| Priority | Target |
|---|---|
| Urgent | 4 hours |
| High | 24 hours |
| Medium | 72 hours |
| Low | 7 days |

Re-prioritising recalculates the deadline from the original filing time, so
escalating an old ticket tightens the clock rather than restarting it.

## Layout

```
app.js              Express app (exported for tests)
server.js           HTTP listener + graceful shutdown
config/             Environment configuration
constants.js        Roles, statuses, priorities, SLA policy
db/                 Pool, transaction helper, schema.sql
middleware/         auth (JWT), validate (Joi), errorHandler
routes/             auth, tickets, users, reports, meta
services/           tickets (queries + access rules), email, activity
utils/              AppError, asyncHandler, sla, serialize
scripts/migrate.js  Schema runner
tests/              Jest + supertest integration tests
```
