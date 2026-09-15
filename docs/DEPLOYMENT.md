# Deployment

The app deploys as **one service**: the API serves the built frontend, so there
is a single process, a single port and a single origin. No CORS configuration,
no separate static host.

```
frontend/build ──served by──> backend (Express) ──> PostgreSQL
                                   :5000
```

## Required configuration

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Provided by most managed hosts. Falls back to `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`. |
| `JWT_SECRET` | yes | At least 32 characters, random. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `NODE_ENV` | yes | `production` |
| `SERVE_FRONTEND` | yes | `true`, for the single-service shape above |
| `PORT` | usually | Most hosts set this themselves |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | for email | Without these **no notification is ever delivered** — see below |
| `FRONTEND_URL` | for links | The public URL. Used in emailed links, and for CORS if you ever split the frontend out. |
| `STAFF_INVITE_CODE` | no | Leave **blank** in production and use `npm run create-admin` instead |
| `DB_SSL` | no | Set to `disable` only for a provider that does not use TLS |

The app refuses to start under `NODE_ENV=production` with a missing or
placeholder `JWT_SECRET`, no database configuration, or a placeholder
`STAFF_INVITE_CODE`. These are failures worth having at boot rather than in
production.

## Replit

The repository carries a `.replit` file configured for an Autoscale deployment.

1. Import the repository into Replit.
2. Add the **PostgreSQL** integration. It sets `DATABASE_URL` automatically.
3. In **Secrets**, add `JWT_SECRET`, plus the `SMTP_*` values if you want email.
   Do not put secrets in `.replit` — that file is committed.
4. Deploy. The build step (`scripts/replit-build.sh`) installs both halves,
   builds the frontend and runs migrations; the run step starts the server.
5. Create the first manager (see below).

`NODE_ENV`, `PORT` and `SERVE_FRONTEND` are already set in `.replit`.

## Any other host (Render, Railway, Fly, a VM)

The same three commands work anywhere:

```bash
# build
npm --prefix backend ci --omit=dev
npm --prefix frontend ci
REACT_APP_API_URL=/api npm --prefix frontend run build
npm --prefix backend run migrate

# run
NODE_ENV=production SERVE_FRONTEND=true npm --prefix backend start
```

Provide `DATABASE_URL` and `JWT_SECRET`, and point the host's health check at
`/api/health`.

## The first manager account

Do **not** use `npm run seed` — it is demo data and refuses to run under
`NODE_ENV=production`.

```bash
npm --prefix backend run create-admin -- you@example.com "Your Name"
```

It prints a generated password once, or uses `ADMIN_PASSWORD` if set. Promote
everyone else from the People page in the app. With `STAFF_INVITE_CODE` blank,
staff self-registration is refused outright and homeowner signup is unaffected.

## Prove email works before anyone relies on it

Notifications are best-effort by design: a failure is logged and never breaks a
request. That is right for reliability, and it means a bad password fails
**silently**. With SMTP unset, every notification is recorded in `email_logs`
with status `skipped` and nothing is delivered.

```bash
npm --prefix backend run check:email                      # verify the connection
npm --prefix backend run check:email -- you@example.com   # send a real message
```

The server also verifies SMTP at boot and logs the outcome. For Gmail,
`SMTP_PASS` must be an [App Password](https://support.google.com/accounts/answer/185833),
not the account password, and the account needs 2-Step Verification enabled.

To audit what has been attempted:

```sql
SELECT status, count(*) FROM email_logs GROUP BY status;
SELECT * FROM email_logs WHERE status = 'failed' ORDER BY sent_at DESC LIMIT 20;
```

## Before real resident data

- [ ] `JWT_SECRET` is random and held in the host's secret store
- [ ] `STAFF_INVITE_CODE` is blank; the first manager came from `create-admin`
- [ ] `npm run check:email` passes and a test message arrived
- [ ] `FRONTEND_URL` is the real public URL, so reset links work
- [ ] No demo accounts exist: `SELECT email FROM users WHERE email LIKE '%@demo.test'`
- [ ] The database has automated backups
- [ ] The host terminates TLS — password reset tokens travel in URLs
- [ ] Someone other than you can reach the site and sign in

## Things this does not do yet

- **No account lockout.** Login is rate limited by IP (20 attempts per 15
  minutes), but there is no per-account lockout or MFA.
- **No file attachments**, so no photos of the problem.
- **No background job runner.** Expired reset tokens accumulate until
  `passwordReset.purgeExpired()` is called; nothing calls it on a schedule yet.
- **No audit trail for user administration.** Ticket changes are logged; role
  changes and deactivations are not.
