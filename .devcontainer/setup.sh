#!/usr/bin/env bash
# Runs once when the container is created: install, configure, migrate, seed
# and build. Leaves the workspace ready for start.sh to serve.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing backend dependencies"
npm --prefix backend ci

echo "==> Installing frontend dependencies"
npm --prefix frontend ci

# Written rather than copied from .env.example so the demo gets a real random
# secret and the container's database host, with no manual editing.
if [ ! -f backend/.env ]; then
  echo "==> Writing backend/.env"
  cat > backend/.env <<ENV
NODE_ENV=development
PORT=5000

DB_HOST=db
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=tsv_db
TEST_DB_NAME=tsv_test

JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
JWT_EXPIRE=7d
STAFF_INVITE_CODE=demo-invite

# The API serves the built frontend too, so everything is on one origin and
# there is no CORS configuration to get wrong.
SERVE_FRONTEND=true
FRONTEND_URL=*

# SMTP intentionally unset: notifications are recorded in the email_logs table
# with status 'skipped' instead of being sent.
APP_NAME=TSV - Ticket Management System
ENV
fi

echo "==> Waiting for PostgreSQL"
for _ in $(seq 1 30); do
  if pg_isready -h db -U postgres -q 2>/dev/null; then break; fi
  sleep 1
done

echo "==> Applying database schema"
npm --prefix backend run migrate

echo "==> Loading demo data"
npm --prefix backend run seed

# Relative API URL: the frontend is served by the API, so same-origin.
echo "REACT_APP_API_URL=/api" > frontend/.env

echo "==> Building the frontend"
npm --prefix frontend run build

echo
echo "Setup complete."
