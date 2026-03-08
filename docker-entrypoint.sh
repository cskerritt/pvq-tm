#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "Running Prisma migrations..."
  node node_modules/prisma/build/index.js migrate deploy
  echo "Migrations complete."
else
  echo "WARNING: DATABASE_URL not set — skipping migrations."
fi

echo "Starting Next.js server..."
exec node server.js
