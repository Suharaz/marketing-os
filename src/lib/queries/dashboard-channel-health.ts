import { db } from '@/lib/db';

export interface ChannelHealthData {
  accountId: string;
  name: string;
  platform: string;
  healthScore: number;
  prevScore: number | null;
}

export async function fetchChannelHealth(): Promise<ChannelHealthData[]> {
  const res = await db.query<{
    account_id: string;
    name: string;
    platform: string;
    health_score: string;
    prev_score: string | null;
  }>(`
    SELECT
      latest.account_id,
      sa.name,
      sa.platform,
      latest.health_score,
      prev.health_score AS prev_score
    FROM (
      SELECT DISTINCT ON (account_id)
        account_id, health_score
      FROM channel_health_daily
      WHERE date >= CURRENT_DATE - 7
      ORDER BY account_id, date DESC
    ) latest
    -- Filter sa.status != 'disconnected' để widget không show kênh đã hủy.
    JOIN social_account sa ON sa.id = latest.account_id
      AND sa.status != 'disconnected'
    LEFT JOIN (
      SELECT DISTINCT ON (account_id)
        account_id, health_score
      FROM channel_health_daily
      WHERE date >= CURRENT_DATE - 14 AND date < CURRENT_DATE - 7
      ORDER BY account_id, date DESC
    ) prev ON prev.account_id = latest.account_id
    ORDER BY latest.health_score DESC
  `);

  return res.rows.map((row) => ({
    accountId: row.account_id,
    name: row.name,
    platform: row.platform,
    healthScore: Number(row.health_score),
    prevScore: row.prev_score !== null ? Number(row.prev_score) : null,
  }));
}
