// Cron scheduler initializer — schedules all ingestion jobs once at server start.
// Singleton-guarded via globalThis.__cron_initialized to survive HMR reloads.
// Only called from instrumentation.ts after confirming nodejs runtime.

import cron from 'node-cron';
import { runPageInsightsJob } from '@/lib/cron/job-page-insights';
import { runPostsIngestionJob } from '@/lib/cron/job-posts-ingestion';
import { runHealthRecomputeJob } from '@/lib/cron/job-health-recompute';
import { runLadipageSyncJob } from '@/lib/cron/job-ladipage-sync';

declare global {
  // eslint-disable-next-line no-var
  var __cron_initialized: boolean | undefined;
}

/**
 * Schedule all cron jobs. Safe to call multiple times — subsequent calls are
 * no-ops thanks to the globalThis singleton guard.
 *
 * Schedules:
 *   Job A — page_insights:    0 2,10,18 * * *   UTC      (3× daily)
 *   Job B — posts_ingestion:  30 2 * * *        UTC      (daily 02:30)
 *   Job C — health_recompute: 0 3 * * *         UTC      (daily 03:00)
 *   Job D — ladipage_sync:    30 23 * * *       VN time  (daily 23:30 Asia/Ho_Chi_Minh)
 */
export function initCrons(): void {
  if (globalThis.__cron_initialized) {
    console.log('[cron] Already initialized — skipping duplicate init');
    return;
  }

  // Job A: page insights — 3× daily
  cron.schedule('0 2,10,18 * * *', () => {
    runPageInsightsJob().catch((err) =>
      console.error('[cron] job-page-insights uncaught error:', err)
    );
  });

  // Job B: posts ingestion — daily at 02:30
  cron.schedule('30 2 * * *', () => {
    runPostsIngestionJob().catch((err) =>
      console.error('[cron] job-posts-ingestion uncaught error:', err)
    );
  });

  // Job C: health recompute — daily at 03:00
  cron.schedule('0 3 * * *', () => {
    runHealthRecomputeJob().catch((err) =>
      console.error('[cron] job-health-recompute uncaught error:', err)
    );
  });

  // Job D: Ladipage conversion sync — daily at 23:30 VN.
  // Container runs UTC, so we pin schedule to Asia/Ho_Chi_Minh explicitly
  // instead of converting to 16:30 UTC (more readable, same result).
  cron.schedule(
    '30 23 * * *',
    () => {
      runLadipageSyncJob().catch((err) =>
        console.error('[cron] job-ladipage-sync uncaught error:', err)
      );
    },
    { timezone: 'Asia/Ho_Chi_Minh' }
  );

  globalThis.__cron_initialized = true;
  console.log('[cron] 4 jobs scheduled');
}
