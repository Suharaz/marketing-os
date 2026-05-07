import { db } from '@/lib/db';

export interface ChannelOwner {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface ChannelAccount {
  id: string;
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
}

export interface SyncLogEntry {
  id: string;
  syncType: string;
  status: string;
  recordsUpserted: number | null;
  errorMessage: string | null;
  startedAt: string;
  details: SyncCallEntry[] | null;
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
    `SELECT sa.id, sa.name, sa.platform, sa.status, sa.last_synced_at, sa.persona_json,
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
  // Lấy 7 ngày gần nhất NHƯNG loại trừ hôm nay (data hôm nay chưa đủ → tránh tụt cuối chart)
  // Khoảng: [CURRENT_DATE - 7, CURRENT_DATE - 1] → 7 điểm dữ liệu
  const res = await db.query<{
    date: string;
    followers: string | null;
    total_reach: string | null;
    total_engagement: string | null;
    posts_count: string | null;
  }>(
    `SELECT to_char(date, 'YYYY-MM-DD') AS date, followers, total_reach, total_engagement, posts_count
     FROM account_metric_daily
     WHERE account_id = $1
       AND date >= CURRENT_DATE - INTERVAL '7 days'
       AND date < CURRENT_DATE
     ORDER BY date ASC`,
    [accountId]
  );

  return res.rows.map((row) => ({
    date: row.date,
    followers: row.followers !== null ? Number(row.followers) : null,
    totalReach: row.total_reach !== null ? Number(row.total_reach) : null,
    totalEngagement:
      row.total_engagement !== null ? Number(row.total_engagement) : null,
    postsCount: row.posts_count !== null ? Number(row.posts_count) : null,
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
  }>(
    // LATERAL lấy 1 row metric mới nhất / post — đảm bảo ER + 3 chỉ số đồng nhất cùng snapshot
    `SELECT sp.id, sp.external_id, sp.content, sp.media_url, sp.permalink,
            sp.published_at,
            pm.engagement_rate, pm.reactions, pm.comments, pm.shares
     FROM social_post sp
     LEFT JOIN LATERAL (
       SELECT engagement_rate, reactions, comments, shares
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
  }));
}

export async function fetchSyncLog(
  accountId: string,
  limit = 10
): Promise<SyncLogEntry[]> {
  const res = await db.query<{
    id: string;
    sync_type: string;
    status: string;
    records_upserted: string | null;
    error_message: string | null;
    started_at: string;
    details: SyncCallEntry[] | null;
  }>(
    `SELECT id, sync_type, status, records_upserted, error_message, started_at, details
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
    details: row.details,
    recordsUpserted:
      row.records_upserted !== null ? Number(row.records_upserted) : null,
    errorMessage: row.error_message,
    startedAt: row.started_at,
  }));
}
