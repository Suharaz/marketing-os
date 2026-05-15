// UPSERT SQL helpers for the 3 metric tables written by cron jobs.
// All functions are idempotent — safe to re-run with same data.
// engagement_rate is a GENERATED ALWAYS AS STORED column — never written directly.

import { db } from '@/lib/db';

// ─── Types ────────────────────────────────────────────────────────────────────

// posts_count CỐ Ý không có ở đây — query đọc bằng COUNT từ social_post
// (xem channel-detail.ts, dashboard-trend.ts). Column posts_count trong DB
// vẫn tồn tại (NOT NULL DEFAULT 0) nhưng deprecated — INSERT bỏ qua → auto 0.
export interface AccountMetricDailyRow {
  account_id: string;
  date: Date | string;
  followers: number;
  follower_growth: number;
  total_reach: number;
  total_reach_unique: number;
  total_engagement: number;
  total_actions: number;
  page_views: number;
  post_reactions_total: number;
}

export interface SocialPostRow {
  account_id: string;
  external_id: string;
  content: string | null;
  media_url: string | null;
  post_type: string;
  published_at: Date;
  permalink: string | null;
}

export interface PostMetricDailyRow {
  post_id: string;
  date: Date | string;
  reactions: number;
  comments: number;
  shares: number;
  reach: number;
  impressions: number;
  clicks: number;
  video_views: number;
}

// ─── account_metric_daily ─────────────────────────────────────────────────────

/**
 * UPSERT rows into account_metric_daily.
 * Conflict target: (account_id, date).
 * Returns number of rows processed.
 */
export async function upsertAccountMetricDaily(
  rows: AccountMetricDailyRow[]
): Promise<number> {
  if (rows.length === 0) return 0;

  let count = 0;
  for (const row of rows) {
    await db.query(
      `INSERT INTO account_metric_daily
         (account_id, date, followers, follower_growth,
          total_reach, total_reach_unique, total_engagement,
          total_actions, page_views, post_reactions_total, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (account_id, date) DO UPDATE SET
         -- COALESCE(NULLIF(EXCLUDED.x, 0), old.x): nếu caller gửi 0 (placeholder
         -- "today" row khi FB chưa finalize, hoặc API hiccup), giữ giá trị cũ
         -- thay vì clobber. Áp dụng cho mọi metric mà 0 = "chưa có data" thay vì
         -- "thật sự bằng 0". Ngăn row bị stuck ở 0 vĩnh viễn khi FB delay 1-2 ngày.
         followers            = COALESCE(NULLIF(EXCLUDED.followers, 0), account_metric_daily.followers),
         -- follower_growth GIỮ EXCLUDED — 0 là giá trị hợp lệ (ngày không có follower mới).
         follower_growth      = EXCLUDED.follower_growth,
         total_reach          = COALESCE(NULLIF(EXCLUDED.total_reach, 0), account_metric_daily.total_reach),
         total_reach_unique   = COALESCE(NULLIF(EXCLUDED.total_reach_unique, 0), account_metric_daily.total_reach_unique),
         total_engagement     = COALESCE(NULLIF(EXCLUDED.total_engagement, 0), account_metric_daily.total_engagement),
         total_actions        = COALESCE(NULLIF(EXCLUDED.total_actions, 0), account_metric_daily.total_actions),
         page_views           = COALESCE(NULLIF(EXCLUDED.page_views, 0), account_metric_daily.page_views),
         post_reactions_total = COALESCE(NULLIF(EXCLUDED.post_reactions_total, 0), account_metric_daily.post_reactions_total),
         updated_at           = NOW()`,
      [
        row.account_id,
        row.date,
        row.followers,
        row.follower_growth,
        row.total_reach,
        row.total_reach_unique,
        row.total_engagement,
        row.total_actions,
        row.page_views,
        row.post_reactions_total,
      ]
    );
    count++;
  }

  return count;
}

// ─── social_post ──────────────────────────────────────────────────────────────

/**
 * UPSERT rows into social_post.
 * Conflict target: (account_id, external_id).
 * Does NOT update published_at on conflict — preserve original date.
 * Returns a map of external_id → internal UUID (for wiring post_metric_daily).
 */
export async function upsertSocialPost(
  rows: SocialPostRow[]
): Promise<Map<string, string>> {
  const idMap = new Map<string, string>();
  if (rows.length === 0) return idMap;

  for (const row of rows) {
    const result = await db.query<{ id: string }>(
      `INSERT INTO social_post
         (account_id, external_id, content, media_url, post_type, published_at, permalink)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (account_id, external_id) DO UPDATE SET
         content   = EXCLUDED.content,
         permalink = EXCLUDED.permalink,
         media_url = EXCLUDED.media_url
       RETURNING id`,
      [
        row.account_id,
        row.external_id,
        row.content,
        row.media_url,
        row.post_type,
        row.published_at,
        row.permalink,
      ]
    );

    const id = result.rows[0]?.id;
    if (id) {
      idMap.set(row.external_id, id);
    }
  }

  return idMap;
}

// ─── post_metric_daily ────────────────────────────────────────────────────────

/**
 * UPSERT rows into post_metric_daily.
 * Conflict target: (post_id, date).
 * Does NOT write engagement_rate — it is a GENERATED ALWAYS AS STORED column.
 * Returns number of rows processed.
 */
export async function upsertPostMetricDaily(
  rows: PostMetricDailyRow[]
): Promise<number> {
  if (rows.length === 0) return 0;

  let count = 0;
  for (const row of rows) {
    await db.query(
      `INSERT INTO post_metric_daily
         (post_id, date, reactions, comments, shares, reach, impressions, clicks, video_views)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (post_id, date) DO UPDATE SET
         reactions   = EXCLUDED.reactions,
         comments    = EXCLUDED.comments,
         shares      = EXCLUDED.shares,
         reach       = EXCLUDED.reach,
         impressions = EXCLUDED.impressions,
         clicks      = EXCLUDED.clicks,
         video_views = EXCLUDED.video_views,
         updated_at  = NOW()`,
      [
        row.post_id,
        row.date,
        row.reactions,
        row.comments,
        row.shares,
        row.reach,
        row.impressions,
        row.clicks,
        row.video_views,
      ]
    );
    count++;
  }

  return count;
}
