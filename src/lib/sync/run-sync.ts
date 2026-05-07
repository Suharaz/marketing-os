// Core sync pipeline: fetch FB posts + insights → parse → UPSERT to DB.
// Called by /api/sync/fetch-now (manual) and Phase 05 cron scheduler.
// DOES NOT handle debounce — callers are responsible for that check.

import { db } from '@/lib/db';
import {
  fetchPagePosts,
  fetchPageInsights,
  fbThrottle,
} from '@/lib/fb/api-client';
import { runHealthRecomputeForAccount } from '@/lib/cron/job-health-recompute';
import { decryptToken } from '@/lib/fb/token-encryption';
import { parsePost } from '@/lib/fb/parse-post';
import { parseInsights } from '@/lib/fb/parse-insights';
import { TokenExpiredError } from '@/lib/fb/types';
import { markAccountTokenExpired } from '@/lib/fb/token-expired-handler';
import { logSync } from '@/lib/sync/log-sync';
import { callContext, type CallEntry } from '@/lib/sync/call-context';
import { upsertAccountMetricDaily } from '@/lib/cron/upsert-helpers';
import { toPtDateKey, getTodayUntilUtcSec } from '@/lib/fb/pt-date';
import type { SocialAccount } from '@/lib/db-types';

/** How far back to fetch posts (30 days) */
const SYNC_LOOKBACK_DAYS = 30;

/**
 * Run a full manual sync for one social_account.
 * Fetches posts with embedded insights, parses, and UPSERTs into social_post
 * and post_metric_daily. Logs result to api_sync_log.
 *
 * @returns number of post rows upserted
 */
export async function runManualSync(accountId: string): Promise<number> {
  const calls: CallEntry[] = [];
  return callContext.run(calls, () => runManualSyncInner(accountId, calls));
}

async function runManualSyncInner(accountId: string, calls: CallEntry[]): Promise<number> {
  const startedAt = new Date();

  // Load account from DB
  const accountResult = await db.query<SocialAccount>(
    `SELECT id, external_id, access_token_encrypted, status, platform
     FROM social_account WHERE id = $1 LIMIT 1`,
    [accountId]
  );
  const account = accountResult.rows[0];
  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }
  if (!account.access_token_encrypted) {
    throw new Error(`Account ${accountId} has no encrypted token`);
  }

  let recordsUpserted = 0;

  try {
    // Decrypt token — never log the result
    const token = await decryptToken(account.access_token_encrypted);

    const sinceTs = Math.floor(
      (Date.now() - SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000) / 1000
    );
    const insightsSinceTs = Math.floor(
      (Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000
    );
    // Mọi FB request đều set until = todayT08:00:00+0000 thay vì để FB default
    // about "now". Đảm bảo FB không cắt mất row insights cuối cùng nếu sync
    // chạy trước khi giờ hiện tại vượt qua mốc PT-midnight gần nhất.
    const untilTs = getTodayUntilUtcSec();

    // Sequential calls + random throttle — avoid concurrent FB calls from
    // the same token (rate-limit pressure) and avoid bot-like cadence.
    const rawPosts = await fetchPagePosts(
      token,
      account.external_id,
      sinceTs,
      untilTs
    );
    await fbThrottle();
    const rawInsights = await fetchPageInsights(
      token,
      account.external_id,
      insightsSinceTs,
      untilTs
    );

    // Compute posts_count per date from rawPosts (FB doesn't expose this metric).
    // Bucket by PT calendar date so the key aligns with parseInsights output —
    // both account_metric_daily.date columns must use the same timezone.
    const postsCountByDate = new Map<string, number>();
    for (const p of rawPosts) {
      if (!p.created_time) continue;
      const dateKey = toPtDateKey(p.created_time);
      postsCountByDate.set(dateKey, (postsCountByDate.get(dateKey) ?? 0) + 1);
    }

    // Page-level: parse + posts_count + UPSERT account_metric_daily
    const parsedDays = parseInsights(rawInsights);
    // "today" must also be PT — FB reports daily insights in PT so the
    // fallback row check below has to compare PT-to-PT.
    const today = toPtDateKey(new Date());

    // Always include today's row even if FB returned no insights for today
    // (cần để track posts_count hôm nay nếu user vừa đăng bài).
    const dateKeys = new Set(parsedDays.map((d) => d.date.toISOString().slice(0, 10)));
    if (!dateKeys.has(today)) {
      // Carry-forward followers từ row gần nhất — tránh hiện 0 trên UI khi FB
      // chưa trả insights hôm nay (delay 1-2 ngày là bình thường). Đây là
      // INSERT path, không hit UPDATE clause của UPSERT, nên cần fallback ở app.
      const latestFollowersRes = await db.query<{ followers: number }>(
        `SELECT followers FROM account_metric_daily
         WHERE account_id = $1 AND followers > 0
         ORDER BY date DESC LIMIT 1`,
        [accountId]
      );
      const carriedFollowers = Number(latestFollowersRes.rows[0]?.followers ?? 0);

      parsedDays.push({
        date: new Date(`${today}T00:00:00.000Z`),
        followers: carriedFollowers,
        follower_growth: 0,
        total_reach: 0,
        total_reach_unique: 0,
        total_engagement: 0,
        total_actions: 0,
        page_views: 0,
        post_reactions_total: 0,
      });
    }

    const accountRows = parsedDays.map((day) => {
      const dateKey = day.date.toISOString().slice(0, 10);
      return {
        account_id: accountId,
        date: day.date,
        followers: day.followers,
        follower_growth: day.follower_growth,
        posts_count: postsCountByDate.get(dateKey) ?? 0,
        total_reach: day.total_reach,
        total_reach_unique: day.total_reach_unique,
        total_engagement: day.total_engagement,
        total_actions: day.total_actions,
        page_views: day.page_views,
        post_reactions_total: day.post_reactions_total,
      };
    });
    const accountMetricCount = await upsertAccountMetricDaily(accountRows);

    // Post-level: posts already include insights + comments + shares
    // from field expansion in fetchPagePosts (single API call for entire batch)
    const parsed = rawPosts.map((p) => parsePost(p));
    const postsCount = await upsertPosts(accountId, parsed);

    recordsUpserted = accountMetricCount + postsCount;

    // Recompute health score for this account (Job C, single-account variant)
    try {
      await runHealthRecomputeForAccount(accountId);
    } catch (e) {
      console.warn('[runManualSync] health recompute failed:', (e as Error).message);
    }

    // Update last_synced_at
    await db.query(`UPDATE social_account SET last_synced_at = NOW() WHERE id = $1`, [
      accountId,
    ]);

    await logSync({
      syncType: 'manual_refresh',
      accountId,
      startedAt,
      status: 'success',
      recordsUpserted,
      details: calls,
    });

    return recordsUpserted;
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      await markAccountTokenExpired(accountId);
    }

    const errorMessage =
      err instanceof Error ? err.message : 'Unknown sync error';

    await logSync({
      syncType: 'manual_refresh',
      accountId,
      startedAt,
      status: 'failed',
      recordsUpserted: 0,
      errorMessage,
      details: calls,
    });

    throw err;
  }
}

/** UPSERT parsed posts + daily metrics in a single transaction. */
async function upsertPosts(
  accountId: string,
  posts: ReturnType<typeof parsePost>[]
): Promise<number> {
  if (posts.length === 0) return 0;

  const client = await db.connect();
  let count = 0;

  try {
    await client.query('BEGIN');

    for (const post of posts) {
      // UPSERT social_post
      const postResult = await client.query<{ id: string }>(
        `INSERT INTO social_post
           (account_id, external_id, content, media_url, post_type, published_at, permalink)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (account_id, external_id)
         DO UPDATE SET
           content     = EXCLUDED.content,
           media_url   = EXCLUDED.media_url,
           post_type   = EXCLUDED.post_type,
           published_at = EXCLUDED.published_at,
           permalink   = EXCLUDED.permalink
         RETURNING id`,
        [
          accountId,
          post.external_id,
          post.content,
          post.media_url,
          post.post_type,
          post.published_at,
          post.permalink,
        ]
      );

      const postId = postResult.rows[0]?.id;
      if (!postId) continue;

      // UPSERT post_metric_daily for today
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      await client.query(
        `INSERT INTO post_metric_daily
           (post_id, date, reactions, comments, shares, reach, impressions, clicks, video_views)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (post_id, date)
         DO UPDATE SET
           reactions   = EXCLUDED.reactions,
           comments    = EXCLUDED.comments,
           shares      = EXCLUDED.shares,
           reach       = EXCLUDED.reach,
           impressions = EXCLUDED.impressions,
           clicks      = EXCLUDED.clicks,
           video_views = EXCLUDED.video_views,
           updated_at  = NOW()`,
        [
          postId,
          today,
          post.metrics.reactions,
          post.metrics.comments,
          post.metrics.shares,
          post.metrics.reach,
          post.metrics.impressions,
          post.metrics.clicks,
          post.metrics.video_views,
        ]
      );

      count++;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return count;
}
