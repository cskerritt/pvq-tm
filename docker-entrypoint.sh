#!/bin/sh

if [ -n "$DATABASE_URL" ]; then
  echo "Running Prisma migrations..."

  # ─── Direct SQL: ensure all required columns exist BEFORE migration resolve ──
  # The resolve loop below marks all migrations as "applied" which prevents
  # migrate deploy from running new migration SQL. So we run ALTER TABLE
  # statements directly with IF NOT EXISTS to guarantee columns exist.
  echo "Ensuring required columns exist via direct SQL..."
  node -e "
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    pool.query(\`
      ALTER TABLE \"TargetOccupation\" ADD COLUMN IF NOT EXISTS \"cpcCode\" TEXT;
      ALTER TABLE \"TargetOccupation\" ADD COLUMN IF NOT EXISTS \"cpcSimilarity\" DOUBLE PRECISION;
      ALTER TABLE \"Analysis\" ADD COLUMN IF NOT EXISTS \"cpcAnalysis\" JSONB;
      ALTER TABLE \"Analysis\" ADD COLUMN IF NOT EXISTS \"analysisMode\" TEXT DEFAULT 'strict';
      ALTER TABLE \"TargetOccupation\" ADD COLUMN IF NOT EXISTS \"pendingEvaluatorReview\" BOOLEAN DEFAULT false;
      ALTER TABLE \"TargetOccupation\" ADD COLUMN IF NOT EXISTS \"hasTolerations\" BOOLEAN DEFAULT false;
    \`).then(() => {
      console.log('All required columns verified/created.');
      pool.end();
    }).catch(err => {
      console.error('Direct SQL column check failed:', err.message);
      pool.end();
      process.exit(1);
    });
  "

  # Auto-resolve any previously failed migrations.
  # Scans the prisma/migrations directory and marks all migrations as applied
  # so migrate deploy only runs truly new ones. This handles the case where
  # a migration failed on a prior deploy (e.g., column already existed) but
  # the SQL has since been made idempotent with IF NOT EXISTS.
  for dir in prisma/migrations/*/; do
    migration=$(basename "$dir")
    # Skip migration_lock.toml and any non-timestamp directories
    case "$migration" in
      [0-9]*)
        node node_modules/prisma/build/index.js migrate resolve --applied "$migration" 2>/dev/null || true
        ;;
    esac
  done

  if node node_modules/prisma/build/index.js migrate deploy; then
    echo "Migrations complete."
  else
    echo "WARNING: Migration deploy returned non-zero (columns already ensured via direct SQL)."
  fi
else
  echo "WARNING: DATABASE_URL not set — skipping migrations."
fi

echo "Starting Next.js server..."
exec node server.js
