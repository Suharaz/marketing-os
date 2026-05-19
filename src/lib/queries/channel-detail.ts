import { db } from '@/lib/db';

export interface ChannelOwner {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface ChannelAccount {
  id: string;
  /** Platform-specific ID — vd FB Page ID (id_page) user nhập khi connect.
   *  Cần hiển thị để admin verify đúng kênh / debug Ladipage webhook. */
  externalId: string;
  name: string;
  platform: string;
  status: string;
  lastSyncedAt: string | null;
  personaJson: Record<string, unknown> | null;
  followers: number | null;
  healthScore: number | null;
  // Người trong team đang phụ trách kênh — null nếu owner đã bị xóa khỏi team
  owner: ChannelOwner | null;
  // Raw FK — dùng cho OwnerSelector dropdown (giữ riêng để frontend không phải dò owner.id)
  ownerId: string | null;
}

export interface ChannelMetricDay {
  date: string;
  followers: number | null;
  totalReach: number | null;
  totalEngagement: number | null;
  postsCount: number | null;
}

export interface ChannelPost {
  id: string;
  externalId: string;
  content: string | null;
  mediaUrl: string | null;
  permalinkUrl: string | null;
  postedAt: string | null;
  engagementRate: number | null;
  // Snapshot mới nhất từ post_metric_daily — lấy cùng row với engagementRate
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  // Lượt xem hợp nhất: ưu tiên video_views (nếu >0), fallback impressions.
  // null khi cả hai = 0/null → UI ẩn hoàn toàn icon 👁.
  views: number | null;
}

export interface SyncLogEntry {
  id: string;
  syncType: string;
  status: string;
  recordsUpserted: number | null;
  errorMessage: string | null;
  startedAt: string;
  /** Số call trong details. 0 nếu details=null hoặc rỗng. Tính ngay từ SQL
   *  qua jsonb_array_length để tránh fetch cả MB JSONB chỉ để đếm. */
  callsCount: number;
}

export interface SyncCallEntry {
  endpoint: string;
  params: Record<string, string>;
  startedAt: string;
  durationMs: number;
  httpStatus: number;
  ok: boolean;
  error?: string;
  responseSample?: unknown;
}

export async function fetchChannel(id: string): Promise<ChannelAccount | null> {
  const res = await db.query<{
    id: string;
    external_id: string;
    name: string;
    platform: string;
    status: string;
    last_synced_at: string | null;
    persona_json: Record<string, unknown> | null;
    followers: string | null;
    health_score: string | null;
    owner_member_id: string | null;
    owner_name: string | null;
    owner_email: string | null;
    owner_role: string | null;
  }>(
    `SELECT sa.id, sa.external_id, sa.name, sa.platform, sa.status, sa.last_synced_at, sa.persona_json,
            sa.owner_member_id,
            am.followers, ch.health_score,
            tm.name AS owner_name, tm.email AS owner_email, tm.role AS owner_role
     FROM social_account sa
     LEFT JOIN team_member tm ON tm.id = sa.owner_member_id
     LEFT JOIN LATERAL (
       SELECT followers FROM account_metric_daily
       WHERE account_id = sa.id ORDER BY date DESC LIMIT 1
     ) am ON TRUE
     LEFT JOIN LATERAL (
       SELECT health_score FROM channel_health_daily
       WHERE account_id = sa.id ORDER BY date DESC LIMIT 1
     ) ch ON TRUE
     WHERE sa.id = $1`,
    [id]
  );

  const row = res.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    externalId: row.external_id,
    name: row.name,
    platform: row.platform,
    status: row.status,
    lastSyncedAt: row.last_synced_at,
    personaJson: row.persona_json,
    followers: row.followers !== null ? Number(row.followers) : null,
    healthScore: row.health_score !== null ? Number(row.health_score) : null,
    ownerId: row.owner_member_id,
    owner:
      row.owner_member_id && row.owner_name && row.owner_email && row.owner_role
        ? {
            id: row.owner_member_id,
            name: row.owner_name,
            email: row.owner_email,
            role: row.owner_role,
          }
        : null,
  };
}

export async function fetchMetrics7d(accountId: string): Promise<ChannelMetricDay[]> {
  return fetchMetricsRange(accountId, 7);
}

/**
 * Parameterized version của fetchMetrics7d — N ngày gần nhất (exclude today).
 * Khoảng: [CURRENT_DATE - days, CURRENT_DATE - 1] → `days` data points.
 * Caller phải validate `days` ở tool layer (allowlist 7/14/30/90).
 */
export async function fetchMetricsRange(
  accountId: string,
  days: number
): Promise<ChannelMetricDay[]> {
  // Lấy 7 ngày gần nhất NHƯNG loại trừ hôm nay (data hôm nay chưa đủ → tránh tụt cuối chart)
  // Khoảng: [CURRENT_DATE - 7, CURRENT_DATE - 1] → 7 điểm dữ liệu
  //
  // posts_count: COUNT từ social_post group by PT date (KHÔNG đọc column
  // account_metric_daily.posts_count). Cùng pattern với dashboard-trend.ts +
  // dashboard-top-performers.ts. Lý do: single source of truth — page_insights
  // API không trả per-day post count, nên column denormalized dễ bị race wipe.
  // PT date dùng để align với account_metric_daily.date (FB Insights báo theo PT).
  const res = await db.query<{
    date: string;
    followers: string | null;
    total_reach: string | null;
    total_engagement: string | null;
    posts_count: string;
  }>(
    `SELECT to_char(amd.date, 'YYYY-MM-DD') AS date,
            amd.followers, amd.total_reach, amd.total_engagement,
            COALESCE(pc.posts_count, 0) AS posts_count
     FROM account_metric_daily amd
     LEFT JOIN (
       SELECT (published_at AT TIME ZONE 'America/Los_Angeles')::date AS date,
              COUNT(*)::bigint AS posts_count
       FROM social_post
       WHERE account_id = $1
         AND published_at IS NOT NULL
         AND published_at >= (CURRENT_DATE - ($2::int))::timestamptz
         AND published_at <  CURRENT_DATE::timestamptz
       GROUP BY 1
     ) pc ON pc.date = amd.date
     WHERE amd.account_id = $1
       AND amd.date >= CURRENT_DATE - $2::int
       AND amd.date < CURRENT_DATE
     ORDER BY amd.date ASC`,
    [accountId, days]
  );

  return res.rows.map((row) => ({
    date: row.date,
    followers: row.followers !== null ? Number(row.followers) : null,
    totalReach: row.total_reach !== null ? Number(row.total_reach) : null,
    totalEngagement:
      row.total_engagement !== null ? Number(row.total_engagement) : null,
    postsCount: Number(row.posts_count),
  }));
}

export async function fetchRecentPosts(
  accountId: string,
  limit = 10
): Promise<ChannelPost[]> {
  const res = await db.query<{
    id: string;
    external_id: string;
    content: string | null;
    media_url: string | null;
    permalink: string | null;
    published_at: string | null;
    engagement_rate: string | null;
    reactions: number | null;
    comments: number | null;
    shares: number | null;
    video_views: number | null;
    impressions: number | null;
  }>(
    // LATERAL lấy 1 row metric mới nhất / post — đảm bảo ER + các chỉ số đồng nhất cùng snapshot.
    // video_views + impressions raw → JS layer apply COALESCE để tránh CASE/IF rườm rà ở SQL.
    `SELECT sp.id, sp.external_id, sp.content, sp.media_url, sp.permalink,
            sp.published_at,
            pm.engagement_rate, pm.reactions, pm.comments, pm.shares,
            pm.video_views, pm.impressions
     FROM social_post sp
     LEFT JOIN LATERAL (
       SELECT engagement_rate, reactions, comments, shares, video_views, impressions
       FROM post_metric_daily
       WHERE post_id = sp.id ORDER BY date DESC LIMIT 1
     ) pm ON TRUE
     WHERE sp.account_id = $1
     ORDER BY sp.published_at DESC NULLS LAST
     LIMIT $2`,
    [accountId, limit]
  );

  return res.rows.map((row) => ({
    id: row.id,
    externalId: row.external_id,
    content: row.content,
    mediaUrl: row.media_url,
    permalinkUrl: row.permalink,
    postedAt: row.published_at,
    engagementRate:
      row.engagement_rate !== null ? Number(row.engagement_rate) : null,
    reactions: row.reactions,
    comments: row.comments,
    shares: row.shares,
    // Ưu tiên video_views nếu >0 (post video), fallback impressions, null nếu cả hai trống.
    views: computeViews(row.video_views, row.impressions),
  }));
}

/**
 * Hợp nhất video_views + impressions thành 1 số "lượt xem" hiển thị cho UI.
 * - Post video: video_views thường > 0 → dùng nó.
 * - Post text/image: video_views = 0 → fallback impressions.
 * - Cả hai = 0/null → trả null để UI ẩn icon 👁 hoàn toàn.
 */
function computeViews(
  videoViews: number | null,
  impressions: number | null
): number | null {
  if (videoViews !== null && videoViews > 0) return videoViews;
  if (impressions !== null && impressions > 0) return impressions;
  return null;
}

export async function fetchSyncLog(
  accountId: string,
  limit = 10
): Promise<SyncLogEntry[]> {
  // Project chỉ jsonb_array_length(details) thay vì cả JSONB. Mỗi row
  // details có thể nặng 5-50KB → 10 rows = nửa MB embed vào RSC mỗi lần
  // load channel detail. Component dialog fetch on-demand qua API khi user click.
  const res = await db.query<{
    id: string;
    sync_type: string;
    status: string;
    records_upserted: string | null;
    error_message: string | null;
    started_at: string;
    calls_count: string;
  }>(
    `SELECT id, sync_type, status, records_upserted, error_message, started_at,
            COALESCE(jsonb_array_length(details), 0) AS calls_count
     FROM api_sync_log
     WHERE account_id = $1
     ORDER BY started_at DESC
     LIMIT $2`,
    [accountId, limit]
  );

  return res.rows.map((row) => ({
    id: row.id,
    syncType: row.sync_type,
    status: row.status,
    callsCount: Number(row.calls_count),
    recordsUpserted:
      row.records_upserted !== null ? Number(row.records_upserted) : null,
    errorMessage: row.error_message,
    startedAt: row.started_at,
  }));
}
