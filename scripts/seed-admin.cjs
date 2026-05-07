'use strict';

/**
 * seed-admin.cjs
 *
 * Idempotent admin user seeder. Inserts (or updates) the admin team_member
 * using ADMIN_EMAIL and ADMIN_PASSWORD_HASH env vars. Pure CommonJS — no tsx
 * required, runnable in the production runner image.
 *
 * Usage: node scripts/seed-admin.cjs
 * Required env: DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD_HASH
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD_HASH) {
  console.error('[seed-admin] Missing required env: DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD_HASH');
  process.exit(1);
}

async function seedAdmin() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();

    // ON CONFLICT(email) keeps the seed idempotent: re-runs update password only.
    const res = await client.query(
      `INSERT INTO team_member (email, name, role, password_hash)
       VALUES ($1, $2, 'admin', $3)
       ON CONFLICT (email)
       DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin'
       RETURNING id, email`,
      [ADMIN_EMAIL, 'TAKI Admin', ADMIN_PASSWORD_HASH]
    );

    const row = res.rows[0];
    console.log(`[seed-admin] Admin ready: ${row.email} (id=${row.id})`);
  } finally {
    await client.end();
  }
}

seedAdmin().catch((err) => {
  console.error('[seed-admin] Failed:', err.message);
  process.exit(1);
});
