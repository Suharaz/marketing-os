/**
 * CLI helper to run a single cron job manually for testing/debugging.
 *
 * Usage:
 *   npx tsx scripts/run-job-once.ts page_insights
 *   npx tsx scripts/run-job-once.ts posts
 *   npx tsx scripts/run-job-once.ts health
 *
 * Requires DATABASE_URL and ENCRYPTION_KEY in environment (via .env or shell).
 */

import 'dotenv/config';

const JOB = process.argv[2];

const VALID_JOBS = ['page_insights', 'posts', 'health'] as const;
type JobName = (typeof VALID_JOBS)[number];

function isValidJob(val: string | undefined): val is JobName {
  return VALID_JOBS.includes(val as JobName);
}

if (!isValidJob(JOB)) {
  console.error(
    `Usage: npx tsx scripts/run-job-once.ts <job>\n` +
      `Valid jobs: ${VALID_JOBS.join(' | ')}`
  );
  process.exit(1);
}

async function main(): Promise<void> {
  console.log(`[run-job-once] Running job: ${JOB}`);
  const start = Date.now();

  switch (JOB) {
    case 'page_insights': {
      const { runPageInsightsJob } = await import('../src/lib/cron/job-page-insights');
      await runPageInsightsJob();
      break;
    }
    case 'posts': {
      const { runPostsIngestionJob } = await import('../src/lib/cron/job-posts-ingestion');
      await runPostsIngestionJob();
      break;
    }
    case 'health': {
      const { runHealthRecomputeJob } = await import('../src/lib/cron/job-health-recompute');
      await runHealthRecomputeJob();
      break;
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`[run-job-once] Completed in ${elapsed}s`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[run-job-once] Fatal error:', err);
  process.exit(1);
});
