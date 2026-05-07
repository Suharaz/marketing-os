import { db } from '@/lib/db';

export interface AlertData {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  type: string;
  title: string;
  message: string;
  accountId: string | null;
  postId: string | null;
  createdAt: string;
}

export interface LastSyncData {
  syncedAt: string | null;
  platform: string | null;
}

export async function fetchUnreadAlerts(limit = 10): Promise<AlertData[]> {
  const res = await db.query<{
    id: string;
    severity: string;
    type: string;
    title: string;
    message: string;
    account_id: string | null;
    post_id: string | null;
    created_at: Date;
  }>(
    `
    SELECT id, severity, type, title, message, account_id, post_id, created_at
    FROM alert
    WHERE is_read = false
    ORDER BY created_at DESC
    LIMIT $1
  `,
    [limit]
  );

  return res.rows.map((row) => ({
    id: row.id,
    severity: row.severity as AlertData['severity'],
    type: row.type,
    title: row.title,
    message: row.message,
    accountId: row.account_id,
    postId: row.post_id,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function markAlertRead(id: string): Promise<void> {
  await db.query('UPDATE alert SET is_read = true WHERE id = $1', [id]);
}

export async function fetchLastSync(): Promise<LastSyncData> {
  const res = await db.query<{ synced_at: Date | null; platform: string | null }>(`
    SELECT started_at AS synced_at, platform
    FROM api_sync_log
    WHERE status = 'success'
    ORDER BY started_at DESC
    LIMIT 1
  `);

  const row = res.rows[0];
  return {
    syncedAt: row?.synced_at ? row.synced_at.toISOString() : null,
    platform: row?.platform ?? null,
  };
}
