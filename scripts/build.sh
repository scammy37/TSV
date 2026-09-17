#!/usr/bin/env bash
# Build step for a single-service deployment: install both halves, build the
# frontend, then bring the database up to date. Host-agnostic -- Render,
# Railway, Fly, a plain VM.
#
# Deliberately does NOT seed demo data -- seeding refuses to run under
# NODE_ENV=production anyway.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing backend dependencies"
npm --prefix backend ci --omit=dev

echo "==> Installing frontend dependencies"
# --include=dev is load-bearing: managed hosts set NODE_ENV=production for the
# whole build, and npm reads that as omit=dev. Without this flag react-scripts
# (a devDependency) is never installed and the build below fails with
# "react-scripts: not found".
npm --prefix frontend ci --include=dev

echo "==> Building the frontend"
# Relative API URL: the API serves these files, so requests are same-origin.
REACT_APP_API_URL=/api npm --prefix frontend run build

echo "==> Applying database migrations"
npm --prefix backend run migrate

echo "==> Build complete"
