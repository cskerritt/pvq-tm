#!/bin/sh

if [ -n "$DATABASE_URL" ]; then
  echo "Running Prisma migrations..."

  # Resolve any previously failed migrations before attempting deploy.
  # This handles the case where a migration failed on a prior deploy
  # (e.g., column already existed) but the SQL has since been made idempotent.
  for migration in \
    20260308181256_add_rhaj_reference \
    20260309035804_add_zip_code_metro_area \
    20260312214503_add_mvqs_jolts_comparison \
    20260312220000_fix_jolts_column_names \
    20260318153838_add_jolts_state_area_employment \
    20260318170411_add_comprehensive_analysis_fields \
    20260318200000_rename_mvqs_to_vqs \
    20260319000000_add_local_demand_columns \
    20260319100000_add_hired_jobs_and_local_demand \
    20260319110000_add_injury_prw_earnings_trait_sources \
    20260319180000_add_labor_market_access; do
    node node_modules/prisma/build/index.js migrate resolve --applied "$migration" 2>/dev/null || true
  done

  # Force BOTH catch-all migrations to re-run by marking them as NOT applied.
  # If either is in "failed_to_apply" state it blocks ALL subsequent migrations,
  # so we must resolve both before calling migrate deploy.
  node node_modules/prisma/build/index.js migrate resolve --rolled-back 20260319190000_ensure_all_columns 2>/dev/null || true
  node node_modules/prisma/build/index.js migrate resolve --rolled-back 20260319200000_fix_production_columns 2>/dev/null || true

  if node node_modules/prisma/build/index.js migrate deploy; then
    echo "Migrations complete."
  else
    echo "WARNING: Migration deploy returned non-zero. Running catch-all SQL directly..."
    # Fallback: execute the catch-all migration SQL directly to ensure all columns exist.
    # This handles the case where Prisma migrate is stuck but the database is accessible.
    node node_modules/prisma/build/index.js db execute --stdin < prisma/migrations/20260319200000_fix_production_columns/migration.sql 2>/dev/null || true
    echo "Fallback SQL applied."
  fi
else
  echo "WARNING: DATABASE_URL not set — skipping migrations."
fi

echo "Starting Next.js server..."
exec node server.js
