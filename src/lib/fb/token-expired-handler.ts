// Handles the side-effects when a FB Page Access Token is detected as expired/revoked.
// Sets account status to 'token_expired' and creates a warning alert for the dashboard.

import { db } from '@/lib/db';

/**
 * Mark a social_account as token_expired and insert a dashboard alert.
 * Called when TokenExpiredError is caught during sync or manual fetch.
 *
 * Safe to call multiple times — UPDATE is idempotent, INSERT creates a new alert
 * each time but duplicate alerts are acceptable (Phase 05 can deduplicate if needed).
 */
export async function markAccountTokenExpired(accountId: string): Promise<void> {
  // Run both operations in a single transaction for consistency
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE social_account SET status = 'token_expired' WHERE id = $1`,
      [accountId]
    );

    await client.query(
      `INSERT INTO alert (severity, type, title, message, account_id)
       VALUES ('warning', 'token_expired', 'Page token hết hạn',
               'Vui lòng kết nối lại page trong phần Channels', $1)`,
      [accountId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
