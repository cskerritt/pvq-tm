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
    20260319180000_add_labor_market_access \
    20260319190000_ensure_all_columns \
    20260319200000_fix_production_columns; do
    node node_modules/prisma/build/index.js migrate resolve --applied "$migration" 2>/dev/null || true
  done

  if node node_modules/prisma/build/index.js migrate deploy; then
    echo "Migrations complete."
  else
    echo "WARNING: Migration deploy returned non-zero. Attempting direct SQL fallback..."
    # Fallback: run the CPC migration SQL directly if migrate deploy fails
    node -e "
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      pool.query(\`
        ALTER TABLE \"TargetOccupation\" ADD COLUMN IF NOT EXISTS \"cpcCode\" TEXT;
        ALTER TABLE \"TargetOccupation\" ADD COLUMN IF NOT EXISTS \"cpcSimilarity\" DOUBLE PRECISION;
        ALTER TABLE \"Analysis\" ADD COLUMN IF NOT EXISTS \"cpcAnalysis\" JSONB;
      \`).then(() => {
        console.log('CPC columns added via direct SQL.');
        pool.end();
      }).catch(err => {
        console.error('Direct SQL fallback failed:', err.message);
        pool.end();
      });
    "
    # Mark the CPC migration as applied so future deploys don't retry
    node node_modules/prisma/build/index.js migrate resolve --applied 20260323100000_add_cpc_fields 2>/dev/null || true
  fi
else
  echo "WARNING: DATABASE_URL not set — skipping migrations."
fi

echo "Starting Next.js server..."
exec node server.js
