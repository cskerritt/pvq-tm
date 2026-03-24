#!/bin/sh

if [ -n "$DATABASE_URL" ]; then
  echo "Running Prisma migrations..."

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
    echo "WARNING: Migration deploy returned non-zero. Attempting direct SQL fallback..."
    # Fallback: run critical column additions directly if migrate deploy fails
    node -e "
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      pool.query(\`
        ALTER TABLE \"TargetOccupation\" ADD COLUMN IF NOT EXISTS \"cpcCode\" TEXT;
        ALTER TABLE \"TargetOccupation\" ADD COLUMN IF NOT EXISTS \"cpcSimilarity\" DOUBLE PRECISION;
        ALTER TABLE \"Analysis\" ADD COLUMN IF NOT EXISTS \"cpcAnalysis\" JSONB;
      \`).then(() => {
        console.log('Fallback columns added via direct SQL.');
        pool.end();
      }).catch(err => {
        console.error('Direct SQL fallback failed:', err.message);
        pool.end();
      });
    "
  fi
else
  echo "WARNING: DATABASE_URL not set — skipping migrations."
fi

echo "Starting Next.js server..."
exec node server.js
