// Job C — Channel health score recompute (runs 1×/day at 03:00).
// For each active account: queries last 30d metrics, computes 4 sub-scores,
// computes final health score, UPSERTs into channel_health_daily for today.

import { db } from '@/lib/db';
import { startSyncLog, finishSyncLog } from '@/lib/cron/sync-log';
import { handleAccountError } from '@/lib/cron/account-error-handler';
import {
  erScore,
  consistencyScore,
  growthScore,
  reachScore,
  computeHealthScore,
} from '@/lib/health/compute-scores';

interface ActiveAccount {
  id: string;
}

interface AccountMetricRow {
  date: Date;
  followers: number;
  total_reach: number;
  total_engagement: number;
}

interface PostMetricRow {
  engagement_rate: number;
}

async function loadActiveAccounts(): Promise<ActiveAccount[]> {
  const result = await db.query<ActiveAccount>(
    `SELECT id FROM social_account WHERE status = 'active'`
  );
  return result.rows;
}

/** Fetch last 30 days of account_metric_daily for one account. */
async function fetchAccountMetrics(accountId: string): Promise<AccountMetricRow[]> {
  const result = await db.query<AccountMetricRow>(
    `SELECT date, followers, total_reach, total_engagement
     FROM account_metric_daily
     WHERE account_id = $1
       AND date >= CURRENT_DATE - INTERVAL '30 days'
     ORDER BY date ASC`,
    [accountId]
  );
  return result.rows;
}

/** Fetch engagement_rate from post_metric_daily last 30 days for one account. */
async function fetchPostMetrics(accountId: string): Promise<PostMetricRow[]> {
  const result = await db.query<PostMetricRow>(
    `SELECT pmd.engagement_rate
     FROM post_metric_daily pmd
     JOIN social_post sp ON sp.id = pmd.post_id
     WHERE sp.account_id = $1
       AND pmd.date >= CURRENT_DATE - INTERVAL '30 days'`,
    [accountId]
  );
  return result.rows;
}

/** Count distinct posts in the last 7 days for one account. */
async function fetchPostsCountLast7d(accountId: string): Promise<number> {
  const result = await db.query<{ cnt: string }>(
    `SELECT COUNT(DISTINCT sp.id)::text AS cnt
     FROM social_post sp
     WHERE sp.account_id = $1
       AND sp.published_at >= NOW() - INTERVAL '7 days'`,
    [accountId]
  );
  return parseInt(result.rows[0]?.cnt ?? '0', 10);
}

/** UPSERT one row into channel_health_daily for today. */
async function upsertHealthRow(
  accountId: string,
  scores: {
    health_score: number;
    er_score: number;
    consistency_score: number;
    growth_score: number;
    reach_score: number;
  }
): Promise<void> {
  await db.query(
    `INSERT INTO channel_health_daily
       (account_id, date, health_score, er_score, consistency_score, growth_score, reach_score, computed_at)
     VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (account_id, date) DO UPDATE SET
       health_score       = EXCLUDED.health_score,
       er_score           = EXCLUDED.er_score,
       consistency_score  = EXCLUDED.consistency_score,
       growth_score       = EXCLUDED.growth_score,
       reach_score        = EXCLUDED.reach_score,
       computed_at        = NOW()`,
    [
      accountId,
      scores.health_score,
      scores.er_score,
      scores.consistency_score,
      scores.growth_score,
      scores.reach_score,
    ]
  );
}

/**
 * Run the health score recompute job.
 * Exported for use in cron/init.ts and the run-job-once CLI script.
 */
/** Compute + upsert health for one account (used by both cron + manual sync). */
export async function runHealthRecomputeForAccount(accountId: string): Promise<void> {
  const [accountMetrics, postMetrics, postsLast7d] = await Promise.all([
    fetchAccountMetrics(accountId),
    fetchPostMetrics(accountId),
    fetchPostsCountLast7d(accountId),
  ]);

  const avgER =
    postMetrics.length > 0
      ? postMetrics.reduce((sum, r) => sum + Number(r.engagement_rate), 0) /
        postMetrics.length
      : 0;
  const er = erScore(avgER);

  const consistency = consistencyScore(postsLast7d);

  const followersToday = accountMetrics.at(-1)?.followers ?? 0;
  const idx7dAgo = Math.max(0, accountMetrics.length - 8);
  const followers7dAgo = accountMetrics[idx7dAgo]?.followers ?? 0;
  const growth = growthScore(followersToday, followers7dAgo);

  const avgReach =
    accountMetrics.length > 0
      ? accountMetrics.reduce((sum, r) => sum + r.total_reach, 0) /
        accountMetrics.length
      : 0;
  const reach = reachScore(avgReach);

  const health = computeHealthScore({ er, consistency, growth, reach });

  await upsertHealthRow(accountId, {
    health_score: health,
    er_score: er,
    consistency_score: consistency,
    growth_score: growth,
    reach_score: reach,
  });

  console.log(
    `[health-recompute] ${accountId}: health=${health} er=${er.toFixed(1)} consistency=${consistency.toFixed(1)} growth=${growth.toFixed(1)} reach=${reach.toFixed(1)}`
  );
}

export async function runHealthRecomputeJob(): Promise<void> {
  const logId = await startSyncLog('health_recompute');
  let totalRecords = 0;
  let jobError: string | null = null;

  try {
    const accounts = await loadActiveAccounts();
    console.log(`[job-health-recompute] Processing ${accounts.length} active accounts`);

    for (const acc of accounts) {
      try {
        await runHealthRecomputeForAccount(acc.id);
        totalRecords++;
      } catch (err) {
        await handleAccountError(acc.id, err);
      }
    }
  } catch (err) {
    jobError = err instanceof Error ? err.message : String(err);
    console.error('[job-health-recompute] Fatal job error:', err);
  }

  await finishSyncLog(
    logId,
    jobError ? 'failed' : 'success',
    totalRecords,
    jobError
  );

  console.log(`[job-health-recompute] Done — ${totalRecords} accounts scored`);
}
