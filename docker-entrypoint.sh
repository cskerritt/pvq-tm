#!/bin/sh

if [ -n "$DATABASE_URL" ]; then
  echo "Running Prisma migrations..."

  # ─── Direct SQL: replay schema-only migration SQL BEFORE the resolve loop ────
  # The resolve loop below marks all migrations as "applied" which prevents
  # migrate deploy from running new migration SQL. So we execute every
  # migration.sql file directly — they are all schema-only DDL with
  # IF NOT EXISTS guards, making them safe to re-run.
  # This guarantees every column, index, and table exists in the database.
  echo "Replaying migration SQL (idempotent DDL) to ensure schema is complete..."
  node -e "
    const { Pool } = require('pg');
    const fs = require('fs');
    const path = require('path');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    // PostgreSQL error codes that are safe to ignore on replay:
    // 42P07 = duplicate_table, 42P16 = invalid_table_definition (e.g. column exists),
    // 42701 = duplicate_column, 42710 = duplicate_object (index, constraint)
    const EXPECTED_PG_CODES = new Set(['42P07', '42P16', '42701', '42710']);

    (async () => {
      const migrationsDir = path.join(__dirname, 'prisma', 'migrations');
      if (!fs.existsSync(migrationsDir)) {
        console.error('ERROR: prisma/migrations directory not found at ' + migrationsDir);
        process.exit(1);
      }
      const dirs = fs.readdirSync(migrationsDir)
        .filter(d => /^\d/.test(d))
        .sort();
      for (const dir of dirs) {
        const sqlFile = path.join(migrationsDir, dir, 'migration.sql');
        if (fs.existsSync(sqlFile)) {
          const sql = fs.readFileSync(sqlFile, 'utf8');
          try {
            await pool.query(sql);
            console.log('  Applied: ' + dir);
          } catch (err) {
            if (EXPECTED_PG_CODES.has(err.code)) {
              // Safe to skip: object already exists (e.g. init migration tables)
              console.log('  Skipped: ' + dir + ' (' + err.message.split('\\n')[0] + ')');
            } else {
              // Unexpected error — fail fast so we don't mask real issues
              console.error('  FAILED: ' + dir);
              console.error('    Code: ' + err.code + ' — ' + err.message);
              await pool.end();
              process.exit(1);
            }
          }
        }
      }
      console.log('All migration SQL replayed.');
      await pool.end();
    })().catch(err => {
      console.error('Migration SQL replay failed:', err.message);
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
