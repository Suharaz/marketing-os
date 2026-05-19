import { db } from '@/lib/db';

export interface ChannelListItem {
  id: string;
  // Platform-specific ID (vd FB Page ID) — hiển thị cho admin verify + copy lên clipboard
  externalId: string;
  name: string;
  platform: string;
  status: string;
  lastSyncedAt: string | null;
  followers: number | null;
  healthScore: number | null;
  // Tổng reach 7 ngày gần nhất (không tính ngày hiện tại), lấy từ account_metric_daily.total_reach
  reach7d: number | null;
  // Engagement rate trung bình (đơn vị: tỉ lệ — render UI nhân 100 thành %)
  avgEngagementRate: number | null;
  // Tên người quản lý kênh (team_member.name) — null nếu chưa gán
  ownerName: string | null;
  // Tổng lead 30 ngày qua từ manual_conversion (mặc định 0 nếu chưa có)
  lead30d: number;
}

export interface ChannelsListFilter {
  platform?: string | null;
  status?: string | null;
  sort?: string | null;
}

const ALLOWED_SORT_COLUMNS: Record<string, string> = {
  name: 'sa.name ASC',
  health: 'ch.health_score DESC NULLS LAST',
  followers: 'am.followers DESC NULLS LAST',
};

export async function fetchChannelsList(
  filter: ChannelsListFilter
): Promise<ChannelListItem[]> {
  const sortClause = ALLOWED_SORT_COLUMNS[filter.sort ?? ''] ?? ALLOWED_SORT_COLUMNS.name;

  const res = await db.query<{
    id: string;
    external_id: string;
    name: string;
    platform: string;
    status: string;
    last_synced_at: string | null;
    followers: string | null;
    health_score: string | null;
    reach_7d: string | null;
    avg_engagement_rate: string | null;
    owner_name: string | null;
    lead_30d: string;
  }>(
    `SELECT sa.id, sa.external_id, sa.name, sa.platform, sa.status, sa.last_synced_at,
            am.followers, ch.health_score,
            rch.reach_7d, pm.avg_engagement_rate,
            tm.name AS owner_name,
            lc.lead_30d
     FROM social_account sa
     LEFT JOIN LATERAL (
       SELECT followers FROM account_metric_daily
       WHERE account_id = sa.id ORDER BY date DESC LIMIT 1
     ) am ON TRUE
     LEFT JOIN LATERAL (
       SELECT health_score FROM channel_health_daily
       WHERE account_id = sa.id ORDER BY date DESC LIMIT 1
     ) ch ON TRUE
     -- Tổng reach 7 ngày gần nhất (loại trừ ngày hiện tại) từ account_metric_daily.total_reach.
     -- NULL nếu không có row → render '—' trên UI. SUM trả 0 khi có row nhưng total_reach = 0.
     LEFT JOIN LATERAL (
       SELECT SUM(total_reach)::BIGINT AS reach_7d
       FROM account_metric_daily
       WHERE account_id = sa.id
         AND date >= CURRENT_DATE - INTERVAL '7 days'
         AND date <  CURRENT_DATE
     ) rch ON TRUE
     -- ER trung bình trên post_metric_daily 30 ngày, lấy row mới nhất per-post
     LEFT JOIN LATERAL (
       SELECT AVG(p.engagement_rate)::NUMERIC AS avg_engagement_rate
       FROM (
         SELECT DISTINCT ON (sp.id) pmd.engagement_rate
         FROM social_post sp
         JOIN post_metric_daily pmd ON pmd.post_id = sp.id
         WHERE sp.account_id = sa.id
           AND sp.published_at >= NOW() - INTERVAL '30 days'
         ORDER BY sp.id, pmd.date DESC
       ) p
     ) pm ON TRUE
     -- Tổng lead 30 ngày từ landing_page_conversion (Ladipage sync cron).
     -- Bảng cũ manual_conversion đã bị migration 015 drop và thay bằng bảng này.
     -- COALESCE → 0 nếu không có row.
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(conversion_count), 0)::INT AS lead_30d
       FROM landing_page_conversion
       WHERE account_id = sa.id
         AND occurred_date >= CURRENT_DATE - INTERVAL '30 days'
     ) lc ON TRUE
     LEFT JOIN team_member tm ON tm.id = sa.owner_member_id
     WHERE ($1::text IS NULL OR sa.platform = $1::platform_t)
       AND (
         -- Default: hide disconnected channels (deleted from user POV)
         ($2::text IS NULL AND sa.status != 'disconnected')
         -- Explicit filter: show only that status (incl. disconnected if requested)
         OR ($2::text IS NOT NULL AND sa.status = $2::account_status_t)
       )
     ORDER BY ${sortClause}
     LIMIT 100`,
    [filter.platform ?? null, filter.status ?? null]
  );

  return res.rows.map((row) => ({
    id: row.id,
    externalId: row.external_id,
    name: row.name,
    platform: row.platform,
    status: row.status,
    lastSyncedAt: row.last_synced_at,
    followers: row.followers !== null ? Number(row.followers) : null,
    healthScore: row.health_score !== null ? Number(row.health_score) : null,
    reach7d: row.reach_7d !== null ? Number(row.reach_7d) : null,
    avgEngagementRate:
      row.avg_engagement_rate !== null ? Number(row.avg_engagement_rate) : null,
    ownerName: row.owner_name,
    lead30d: Number(row.lead_30d),
  }));
}

// ─── Summary for KPI cards + tab counts ──────────────────────────────────
// Excludes 'disconnected' channels (deleted from user POV) — same rule as fetchChannelsList default.

export interface ChannelsSummary {
  total: number;
  active: number;
  avgHealth: number | null;
  byPlatform: Record<string, number>;
}

export async function fetchChannelsSummary(): Promise<ChannelsSummary> {
  // Single round-trip: aggregate totals + per-platform counts in two CTEs.
  const res = await db.query<{
    total: string;
    active: string;
    avg_health: string | null;
    by_platform: Record<string, number> | null;
  }>(
    `WITH base AS (
       SELECT sa.platform, sa.status,
              (SELECT health_score FROM channel_health_daily
                 WHERE account_id = sa.id ORDER BY date DESC LIMIT 1) AS health_score
       FROM social_account sa
       WHERE sa.status != 'disconnected'
     )
     SELECT
       COUNT(*)::text                                                AS total,
       COUNT(*) FILTER (WHERE status = 'active')::text               AS active,
       AVG(health_score)::text                                       AS avg_health,
       (SELECT jsonb_object_agg(platform, cnt)
          FROM (SELECT platform, COUNT(*)::int AS cnt
                  FROM base GROUP BY platform) p)                    AS by_platform
     FROM base`
  );

  const row = res.rows[0];
  if (!row) {
    return { total: 0, active: 0, avgHealth: null, byPlatform: {} };
  }

  return {
    total: Number(row.total),
    active: Number(row.active),
    avgHealth: row.avg_health !== null ? Number(row.avg_health) : null,
    byPlatform: row.by_platform ?? {},
  };
}
