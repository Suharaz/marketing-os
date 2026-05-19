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

/**
 * Health detail với 4 sub-scores (ER/consistency/growth/reach) + prior week.
 * Optional `accountId` filter — omit = trả về tất cả channels.
 * Dùng bởi MCP tool `channels_health`.
 */
export interface ChannelHealthDetail {
  accountId: string;
  name: string;
  platform: string;
  date: string;
  healthScore: number;
  erScore: number;
  consistencyScore: number;
  growthScore: number;
  reachScore: number;
  priorHealthScore: number | null;
}

export async function fetchChannelHealthDetail(
  accountId?: string
): Promise<ChannelHealthDetail[]> {
  const res = await db.query<{
    account_id: string;
    name: string;
    platform: string;
    date: string;
    health_score: string;
    er_score: string;
    consistency_score: string;
    growth_score: string;
    reach_score: string;
    prior_health_score: string | null;
  }>(
    `
    SELECT
      latest.account_id,
      sa.name,
      sa.platform,
      to_char(latest.date, 'YYYY-MM-DD') AS date,
      latest.health_score,
      latest.er_score,
      latest.consistency_score,
      latest.growth_score,
      latest.reach_score,
      prev.health_score AS prior_health_score
    FROM (
      SELECT DISTINCT ON (account_id)
        account_id, date, health_score, er_score,
        consistency_score, growth_score, reach_score
      FROM channel_health_daily
      WHERE date >= CURRENT_DATE - 7
      ORDER BY account_id, date DESC
    ) latest
    JOIN social_account sa ON sa.id = latest.account_id
      AND sa.status != 'disconnected'
      AND ($1::uuid IS NULL OR sa.id = $1::uuid)
    LEFT JOIN (
      SELECT DISTINCT ON (account_id)
        account_id, health_score
      FROM channel_health_daily
      WHERE date >= CURRENT_DATE - 14 AND date < CURRENT_DATE - 7
      ORDER BY account_id, date DESC
    ) prev ON prev.account_id = latest.account_id
    ORDER BY latest.health_score DESC
    `,
    [accountId ?? null]
  );

  return res.rows.map((row) => ({
    accountId: row.account_id,
    name: row.name,
    platform: row.platform,
    date: row.date,
    healthScore: Number(row.health_score),
    erScore: Number(row.er_score),
    consistencyScore: Number(row.consistency_score),
    growthScore: Number(row.growth_score),
    reachScore: Number(row.reach_score),
    priorHealthScore: row.prior_health_score !== null ? Number(row.prior_health_score) : null,
  }));
}
