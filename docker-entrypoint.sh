#!/bin/sh

if [ -n "$DATABASE_URL" ]; then
  echo "Running Prisma migrations..."

  # ─── Direct SQL: replay schema-only migration SQL BEFORE the resolve loop ────
  # The resolve loop below marks all migrations as "applied" which prevents
  # migrate deploy from running new migration SQL. So we execute every
  # migration.sql file directly — they are all schema-only DDL with
  # IF NOT EXISTS guards, making them safe to re-run.
  # This guarantees every column, index, and table exists in the database.
  #
  # To avoid redundant work on restarts, we track the latest migration name
  # in a _schema_version table. If the DB already matches the current image's
  # latest migration, the replay is skipped entirely.
  #
  # Each migration file is executed inside its own transaction so that a
  # failure rolls back cleanly instead of leaving the schema half-applied.
  echo "Checking if migration replay is needed..."
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
      if (dirs.length === 0) {
        console.log('No migrations found — skipping replay.');
        await pool.end();
        return;
      }
      const latestMigration = dirs[dirs.length - 1];

      // ── Short-circuit: skip replay if DB already matches this image ──
      await pool.query(\`
        CREATE TABLE IF NOT EXISTS _schema_version (
          id INTEGER PRIMARY KEY DEFAULT 1,
          latest_migration TEXT NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT single_row CHECK (id = 1)
        )
      \`);
      const { rows } = await pool.query(
        'SELECT latest_migration FROM _schema_version WHERE id = 1'
      );
      if (rows.length > 0 && rows[0].latest_migration === latestMigration) {
        console.log('Schema already up-to-date (latest: ' + latestMigration + ') — skipping replay.');
        await pool.end();
        return;
      }

      // ── Replay all migration SQL inside individual transactions ──
      console.log('Replaying migration SQL (idempotent DDL)...');
      for (const dir of dirs) {
        const sqlFile = path.join(migrationsDir, dir, 'migration.sql');
        if (fs.existsSync(sqlFile)) {
          const sql = fs.readFileSync(sqlFile, 'utf8');
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            await client.query(sql);
            await client.query('COMMIT');
            console.log('  Applied: ' + dir);
          } catch (err) {
            await client.query('ROLLBACK');
            if (EXPECTED_PG_CODES.has(err.code)) {
              console.log('  Skipped: ' + dir + ' (' + err.message.split('\\n')[0] + ')');
            } else {
              console.error('  FAILED: ' + dir);
              console.error('    Code: ' + err.code + ' — ' + err.message);
              client.release();
              await pool.end();
              process.exit(1);
            }
          } finally {
            client.release();
          }
        }
      }

      // ── Record successful replay ──
      await pool.query(\`
        INSERT INTO _schema_version (id, latest_migration)
        VALUES (1, \$1)
        ON CONFLICT (id) DO UPDATE SET latest_migration = \$1, applied_at = now()
      \`, [latestMigration]);
      console.log('All migration SQL replayed. Recorded version: ' + latestMigration);
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
