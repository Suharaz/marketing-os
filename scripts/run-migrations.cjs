'use strict';

/**
 * run-migrations.cjs
 *
 * Standalone CommonJS migration runner — no transpilation needed.
 * Uses only the `pg` package (production dependency).
 *
 * Matches the pgmigrations table schema used by node-pg-migrate so both
 * tools can coexist without conflict. Runs pending SQL files in lexical order.
 *
 * Usage: node scripts/run-migrations.cjs
 * Requires: DATABASE_URL env var
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[migrations] ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Resolve migrations directory relative to this script's location.
// In the Docker runner stage the working dir is /app and scripts/ is at /app/scripts/.
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS pgmigrations (
      id        SERIAL PRIMARY KEY,
      name      VARCHAR(255) NOT NULL UNIQUE,
      run_on    TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

async function getRanMigrations(client) {
  const result = await client.query('SELECT name FROM pgmigrations ORDER BY run_on ASC');
  return new Set(result.rows.map((r) => r.name));
}

async function getMigrationFiles() {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // lexical sort — filenames are zero-padded (001-, 002-, …)
  return files;
}

async function runMigrations() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('[migrations] Connected to database');

    await ensureMigrationsTable(client);

    const ran = await getRanMigrations(client);
    const files = await getMigrationFiles();

    const pending = files.filter((f) => !ran.has(f));

    if (pending.length === 0) {
      console.log('[migrations] No pending migrations — database is up to date');
      return;
    }

    console.log(`[migrations] Running ${pending.length} pending migration(s)…`);

    for (const filename of pending) {
      const filepath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(filepath, 'utf8');

      console.log(`[migrations]   → ${filename}`);

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO pgmigrations (name) VALUES ($1)', [filename]);
        await client.query('COMMIT');
        console.log(`[migrations]   ✓ ${filename}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrations] FAILED: ${filename}`);
        console.error(`[migrations] ${err.message}`);
        process.exit(1);
      }
    }

    console.log('[migrations] All migrations applied successfully');
  } finally {
    await client.end();
  }
}

runMigrations().catch((err) => {
  console.error('[migrations] Unexpected error:', err.message);
  process.exit(1);
});
