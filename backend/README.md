# Backend

Express + PostgreSQL API. It also serves the built frontend when
`SERVE_FRONTEND=true`, which is how the app is deployed: one process, one port,
one origin, no CORS to configure.

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
records what it *would* have sent in `email_logs` with status `skipped`, so you
can develop without a mail server.

`npm run check:email` prints the configuration and proves the connection. Pass
an address — `npm run check:email -- you@example.com` — and it sends a real
message as well, which is the only thing that actually proves delivery.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | nodemon on port 5000 |
| `npm start` | production listener |
| `npm run migrate` | apply `db/schema.sql`; `-- --reset` drops first |
| `npm run seed` | load demo accounts and tickets |
| `npm run create-admin -- <email> ["Full Name"]` | create, or promote to, a management account |
| `npm run check:email [-- <address>]` | prove the SMTP connection; with an address, send a real message |
| `npm test` | Jest + supertest against `tsv_test` |

## Creating the first management account

Use `npm run create-admin`:

```bash
npm run create-admin -- you@example.com "Jane Doe"
```

It creates the account, or promotes an existing one to management. The password
comes from `ADMIN_PASSWORD`, or is generated and printed once — it is never
stored in plaintext, so copy it from the output and change it at first sign-in.

This is the production path for the first manager, because it means
`STAFF_INVITE_CODE` can stay blank.

Failing that, homeowners self-register and staff/management registration needs
the shared `STAFF_INVITE_CODE` from `.env`:

```bash
curl -X POST localhost:5000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"ChangeMe123!","firstName":"Jane",
       "lastName":"Doe","role":"management","staffInviteCode":"<your code>"}'
```

After that, promote people from the People page. Leave `STAFF_INVITE_CODE`
blank in production once your managers exist and staff self-registration is
refused outright — a guessable code lets anyone grant themselves management.

## Tests

```bash
npm test
```

Integration tests run against a real PostgreSQL database (`tsv_test` by
default), created and migrated automatically before the suite. They use the
same `DB_HOST`/`DB_USER`/`DB_PASSWORD` as development and never touch `tsv_db`
— a stray `DATABASE_URL` in the environment cannot point the suite at something
real.

## Roles

| Role | Can do |
|---|---|
| `homeowner` | File tickets, see and comment on **their own** tickets, and edit the title, description, category and location until the ticket is resolved, closed or cancelled |
| `staff` | See and triage every ticket, assign, comment, post internal notes, view reports |
| `management` | Everything staff can do, plus the people directory, role changes and password resets |

Homeowners never see internal notes, and never see that one exists.

## API

All routes are under `/api`. Everything except `/api/health`, `/api/auth/login`,
`/api/auth/register`, `/api/auth/forgot-password` and `/api/auth/reset-password`
requires `Authorization: Bearer <token>`.

### Auth

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | Homeowner signup; staff/management need `staffInviteCode` |
| POST | `/auth/login` | Returns `{ token, user }` |
| POST | `/auth/forgot-password` | Always answers the same way, registered or not — a differing response is an account-enumeration oracle |
| POST | `/auth/reset-password` | Consumes the token and signs in |
| GET | `/auth/me` | Current user |
| PATCH | `/auth/me` | Update name, address, phone |
| POST | `/auth/change-password` | Requires the current password. Returns a fresh `{ token, user }`, because the change ends every other session and would otherwise end the caller's own |

### Tickets

| Method | Path | Notes |
|---|---|---|
| GET | `/tickets` | Filters: `status`, `priority`, `category`, `assignedTo` (id, `me`, `unassigned`), `homeownerId`, `q`, `open`, `sort` (`created_at`, `updated_at`, `priority`, `status`), `order`, `page`, `limit`. `status` and `priority` accept repeats. Homeowners are always scoped to their own tickets. |
| POST | `/tickets` | Staff may pass `homeownerId` to file on someone's behalf |
| GET | `/tickets/:id` | |
| PATCH | `/tickets/:id` | Triage. Homeowners may only change `title`, `description`, `category` and `locationDetails`, and only until the ticket is resolved, closed or cancelled. Anything else is a 403 listing what they may change |
| POST | `/tickets/:id/assign` | `{ assignedTo: <id or null> }`, staff only |
| GET | `/tickets/:id/comments` | Internal notes filtered out for homeowners |
| POST | `/tickets/:id/comments` | `{ comment, isInternal }`; `isInternal` is ignored for homeowners |
| GET | `/tickets/:id/activity` | Audit trail |

### Other

| Method | Path | Notes |
|---|---|---|
| GET | `/meta` | Categories, priorities, statuses with their legal transitions, and the ageing threshold |
| GET | `/users/assignable` | Staff directory with open workload; staff only |
| GET | `/users`, `GET /users/:id`, `PATCH /users/:id` | Management only. List filters: `role`, `q`, `includeInactive`, `page`, `limit` |
| POST | `/users/:id/reset-password` | Management only. Returns `{ user, temporaryPassword }`; the plaintext appears in this response and nowhere else |
| GET | `/reports/summary` | Volume, timing and workload figures; staff only |
| GET | `/health` | Public |

## Ticket lifecycle

```
open ──> in_progress ──> resolved ──> closed
  │          ↕                │
  │       on_hold             └──> in_progress (reopen)
  └──> cancelled ──> open
```

Illegal jumps are rejected with a 400 listing the legal next statuses, so the
audit trail can never contain a nonsensical transition.

## Priority and age

Priorities are `low`, `medium` and `high`. They carry no deadline — there is no
SLA clock, and changing a priority changes nothing but the label and the sort
order.

What flags a ticket instead is **age**: how long it has been open, against the
`AGING_DAYS` threshold in `constants.js` (7 days). That single number is
published through `GET /api/meta` rather than written into each query and each
component, so the badge on a ticket and the count on the reports page can never
mean different things.

## Sessions

Every JWT carries `tv`, the account's `token_version`. Changing a password —
by any route — increments it, so sessions opened beforehand stop working at
once. `authenticate` also reloads the user row on every request, so
deactivating an account takes effect immediately rather than when its token
expires.

The comparison is against a counter rather than a timestamp on purpose. JWT
`iat` has whole-second resolution, so a token minted in the same second as the
change cannot be told apart from one minted just before it, and any comparison
against a timestamp has to either reject the new token or spare the old one.

Tokens issued before `token_version` existed carry no `tv` and read as
generation 0, which is the column default, so deploying it signed nobody out.

## Getting a locked-out resident back in

The emailed reset link is the normal route, but it only works where outbound
SMTP does — which rules out several managed hosts, Render's free tier among
them. So management can issue a temporary password directly, from
**People → Reset password**.

What that does, and why:

| | |
|---|---|
| The password is generated, not chosen | A manager cannot set it to something they know the resident uses elsewhere |
| `must_change_password` is set | The account can do nothing but replace it, so the manager's knowledge of it dies at first use. Enforced in `authenticate`, not per-route, so a new route cannot quietly forget it |
| `token_version` is bumped | Every session opened before the reset is rejected, making this the tool for shutting out an intruder too |
| Outstanding reset tokens are consumed | An emailed link already in flight cannot be used to set a password of someone else's choosing |

The temporary password is returned once, in the response body. It is not
logged, not emailed and not stored — if it is lost before it reaches the
resident, issue another one. It is generated from an alphabet that drops
characters mistaken for one another when spoken, in hyphenated groups of four,
because it is going to be read down a phone line.

## Layout

```
app.js              Express app (exported for tests)
server.js           HTTP listener + graceful shutdown
config/             Environment configuration and production guards
constants.js        Roles, statuses, priorities, ageing threshold
db/                 Pool, transaction helper, schema.sql
middleware/         auth (JWT), validate (Joi), errorHandler
routes/             auth, tickets, users, reports, meta
services/           tickets (queries + access rules), email, activity,
                    passwordReset, tempPassword
utils/              AppError, asyncHandler, serialize
scripts/            migrate, seed, create-admin, check-email
tests/              Jest + supertest integration tests
```
