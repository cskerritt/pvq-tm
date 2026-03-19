#!/bin/sh

if [ -n "$DATABASE_URL" ]; then
  echo "Running Prisma migrations..."

  # Resolve any previously failed migrations before attempting deploy.
  # This handles the case where a migration failed on a prior deploy
  # (e.g., column already existed) but the SQL has since been made idempotent.
  node node_modules/prisma/build/index.js migrate resolve --applied 20260318170411_add_comprehensive_analysis_fields 2>/dev/null || true
  node node_modules/prisma/build/index.js migrate resolve --applied 20260318200000_rename_mvqs_to_vqs 2>/dev/null || true
  node node_modules/prisma/build/index.js migrate resolve --applied 20260319000000_add_local_demand_columns 2>/dev/null || true

  if node node_modules/prisma/build/index.js migrate deploy; then
    echo "Migrations complete."
  else
    echo "WARNING: Migration deploy returned non-zero. Continuing with server startup..."
  fi
else
  echo "WARNING: DATABASE_URL not set — skipping migrations."
fi

echo "Starting Next.js server..."
exec node server.js
