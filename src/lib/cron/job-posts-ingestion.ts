// Job B — Posts + post metrics ingestion (runs 1×/day at 02:30).
// For each active account: fetches posts from last 7 days, UPSERTs social_post
// then UPSERTs today's snapshot of post_metric_daily.
// 7-day window ensures re-sync of posts whose metrics are still accumulating.

import { db } from '@/lib/db';
import { fetchPagePosts } from '@/lib/fb/api-client';
import { decryptToken } from '@/lib/fb/token-encryption';
import { parsePost } from '@/lib/fb/parse-post';
import { getTodayUntilUtcSec } from '@/lib/fb/pt-date';
import { startSyncLog, finishSyncLog } from '@/lib/cron/sync-log';
import {
  upsertSocialPost,
  upsertPostMetricDaily,
} from '@/lib/cron/upsert-helpers';
import { handleAccountError } from '@/lib/cron/account-error-handler';
import type { SocialPostRow, PostMetricDailyRow } from '@/lib/cron/upsert-helpers';

interface ActiveAccount {
  id: string;
  external_id: string;
  access_token_encrypted: Buffer;
}

const LOOKBACK_DAYS = 7;

/** Unix timestamp (seconds) for N days ago from now. */
function unixDaysAgo(n: number): number {
  return Math.floor((Date.now() - n * 24 * 60 * 60 * 1000) / 1000);
}

/** Midnight UTC today as a Date (for post_metric_daily date column). */
function todayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function loadActiveAccounts(): Promise<ActiveAccount[]> {
  const result = await db.query<ActiveAccount>(
    `SELECT id, external_id, access_token_encrypted
     FROM social_account
     WHERE status = 'active' AND access_token_encrypted IS NOT NULL`
  );
  return result.rows;
}

/**
 * Run the posts + post-metric ingestion job.
 * Exported for use in cron/init.ts and the run-job-once CLI script.
 */
export async function runPostsIngestionJob(): Promise<void> {
  const logId = await startSyncLog('posts');
  let totalRecords = 0;
  let jobError: string | null = null;

  try {
    const accounts = await loadActiveAccounts();
    console.log(`[job-posts-ingestion] Processing ${accounts.length} active accounts`);

    const today = todayUTC();

    for (const acc of accounts) {
      try {
        const token = await decryptToken(acc.access_token_encrypted);
        const since = unixDaysAgo(LOOKBACK_DAYS);
        // until = todayT08:00:00+0000 — đồng nhất mọi FB request, tránh để FB
        // default until="now" cắt cụt response trước mốc PT-midnight gần nhất.
        const until = getTodayUntilUtcSec();

        const rawPosts = await fetchPagePosts(token, acc.external_id, since, until);
        const parsed = rawPosts.map((p) => parsePost(p));

        if (parsed.length === 0) {
          console.log(`[job-posts-ingestion] Account ${acc.id}: no posts in window`);
          continue;
        }

        // Build SocialPostRow array
        const postRows: SocialPostRow[] = parsed.map((p) => ({
          account_id: acc.id,
          external_id: p.external_id,
          content: p.content,
          media_url: p.media_url,
          post_type: p.post_type,
          published_at: p.published_at,
          permalink: p.permalink,
        }));

        // UPSERT posts — get back external_id → internal UUID map
        const idMap = await upsertSocialPost(postRows);

        // Build PostMetricDailyRow array (today's cumulative snapshot)
        const metricRows: PostMetricDailyRow[] = [];
        for (const p of parsed) {
          const postId = idMap.get(p.external_id);
          if (!postId) continue;

          metricRows.push({
            post_id: postId,
            date: today,
            reactions: p.metrics.reactions,
            comments: p.metrics.comments,
            shares: p.metrics.shares,
            reach: p.metrics.reach,
            impressions: p.metrics.impressions,
            clicks: p.metrics.clicks,
            video_views: p.metrics.video_views,
          });
        }

        const metricCount = await upsertPostMetricDaily(metricRows);
        totalRecords += metricCount;

        // Update last_synced_at on success
        await db.query(
          `UPDATE social_account SET last_synced_at = NOW() WHERE id = $1`,
          [acc.id]
        );

        console.log(
          `[job-posts-ingestion] Account ${acc.id}: ${parsed.length} posts, ${metricCount} metric rows`
        );
      } catch (err) {
        await handleAccountError(acc.id, err);
      }
    }
  } catch (err) {
    jobError = err instanceof Error ? err.message : String(err);
    console.error('[job-posts-ingestion] Fatal job error:', err);
  }

  await finishSyncLog(
    logId,
    jobError ? 'failed' : 'success',
    totalRecords,
    jobError
  );

  console.log(`[job-posts-ingestion] Done — ${totalRecords} metric rows upserted`);
}
