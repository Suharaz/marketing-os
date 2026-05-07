/**
 * add-page-manual.ts
 * Bypass OAuth: insert FB page directly with token from Graph API Explorer.
 *
 * Usage:
 *   npx tsx scripts/add-page-manual.ts <pageId> <pageName> <pageToken>
 *
 * Get pageId + pageToken from:
 *   https://developers.facebook.com/tools/explorer/
 *   GET /me/accounts?fields=id,name,access_token
 */

import 'dotenv/config';
import { Pool } from 'pg';

const [pageId, pageName, pageToken] = process.argv.slice(2);

if (!pageId || !pageName || !pageToken) {
  console.error('Usage: npx tsx scripts/add-page-manual.ts <pageId> <pageName> <pageToken>');
  process.exit(1);
}

if (!process.env.DATABASE_URL || !process.env.ENCRYPTION_KEY) {
  console.error('Missing DATABASE_URL or ENCRYPTION_KEY in .env');
  process.exit(1);
}

const db = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    // Get admin id (single admin model)
    const admin = await db.query<{ id: string }>(
      `SELECT id FROM team_member WHERE email = $1 LIMIT 1`,
      [process.env.ADMIN_EMAIL || 'admin@taki.vn']
    );
    if (admin.rows.length === 0) {
      throw new Error('Admin not found. Run npm run db:seed first.');
    }
    const ownerId = admin.rows[0]!.id;

    // Encrypt token via pgcrypto, UPSERT social_account
    const result = await db.query<{ id: string }>(
      `INSERT INTO social_account
        (platform, external_id, name, access_token_encrypted, status, owner_member_id, connected_at)
       VALUES ('facebook', $1, $2, pgp_sym_encrypt($3, $4), 'active', $5, NOW())
       ON CONFLICT (platform, external_id)
       DO UPDATE SET
         name = EXCLUDED.name,
         access_token_encrypted = EXCLUDED.access_token_encrypted,
         status = 'active',
         connected_at = NOW()
       RETURNING id`,
      [pageId, pageName, pageToken, process.env.ENCRYPTION_KEY, ownerId]
    );

    console.log(`✓ Page connected: id=${result.rows[0]!.id} (${pageName})`);
    console.log(`Run sync now: npx tsx scripts/run-job-once.ts page_insights`);
  } catch (err) {
    console.error('Failed:', (err as Error).message);
    process.exit(1);
  } finally {
    await db.end();
  }
})();
