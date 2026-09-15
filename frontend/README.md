# TSV Frontend

React app serving both portals: homeowners submit and track requests, staff and
management triage them. Plain CSS, no UI framework.

## Setup

```bash
npm install
cp .env.example .env      # REACT_APP_API_URL, defaults to http://localhost:5000/api
npm start                 # http://localhost:3000
```

The backend must be running first. `npm run build` produces a static bundle in
`build/`; serve it behind any static host that falls back to `index.html` for
client-side routes.

## Routes

| Path | Who | Page |
|---|---|---|
| `/login`, `/register` | anyone | Sign in / homeowner signup |
| `/` | homeowner | Their requests, filtered by open/closed |
| `/` | staff, management | Triage queue with filters, search and pagination |
| `/tickets/new` | homeowner | Submit a request |
| `/tickets/:id` | anyone with access | Detail, conversation, activity; triage panel for staff |
| `/reports` | staff, management | Volume, SLA and workload |
| `/users` | management | Directory, role changes, deactivation |
| `/profile` | anyone | Name, unit, phone, password |

`/` renders a different dashboard per role rather than redirecting, so both
audiences share one bookmark.

## Layout

```
src/
  api/client.js        Axios instance, token handling, error message extraction
  context/AuthContext  Session state; loads the stored token on boot
  hooks/useMeta.js     Categories/priorities/statuses, fetched once per session
  components/          Layout, ProtectedRoute, TicketRow, Badges, Alert, Spinner
  pages/               One file per route
  utils/format.js      Relative times, durations, label humanising
  index.css            Design tokens and all styling
```

## Dependencies

`package.json` carries an `overrides` entry pinning `typescript` to `^4.9.5`.
The project has no TypeScript; the pin exists because `react-scripts@5.0.1`
declares an optional peer of `^3.2.1 || ^4`, while a transitive peer accepts
`>= 2.7`. Without the pin npm hoists TypeScript 7, and `npm ci` then rejects
the lockfile as out of sync -- so CI cannot install at all. Remove the pin only
alongside an upgrade off `react-scripts` 5.

## Notes

- **Roles.** `ProtectedRoute` gates by role; the API enforces the same rules, so
  the UI is a convenience, not the boundary.
- **Vocabulary.** Categories, priorities and statuses come from `GET /api/meta`,
  so adding a category server-side needs no frontend change.
- **Expired sessions.** A 401 on any call clears the token and returns to login.
- **Theme.** Light and dark both ship, following the OS setting. Colours are
  defined once as custom properties in `index.css`.
- **Responsive.** Single-column below 860px; no horizontal scrolling at 390px.
