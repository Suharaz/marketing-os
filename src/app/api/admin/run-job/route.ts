// POST /api/admin/run-job — trigger a cron job manually.
// Body: { job: 'page_insights' | 'posts' | 'health' | 'ladipage' }
// Admin-only. Used to verify the scheduler is unrelated to job code
// (if cron doesn't auto-fire in prod, this still works → instrumentation issue).

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/get-session';
import { getUserRole } from '@/lib/auth/get-role';

export const runtime = 'nodejs';

const bodySchema = z.object({
  job: z.enum(['page_insights', 'posts', 'health', 'ladipage']),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = await getUserRole(user.userId);
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'job phải là một trong: page_insights, posts, health, ladipage' }, { status: 400 });
  }

  const { job } = parsed.data;
  const startedAt = Date.now();

  try {
    // Fire-and-await — caller waits for completion so they see in the UI
    // whether the run actually succeeded. Most jobs finish in under 30s.
    switch (job) {
      case 'page_insights': {
        const { runPageInsightsJob } = await import('@/lib/cron/job-page-insights');
        await runPageInsightsJob();
        break;
      }
      case 'posts': {
        const { runPostsIngestionJob } = await import('@/lib/cron/job-posts-ingestion');
        await runPostsIngestionJob();
        break;
      }
      case 'health': {
        const { runHealthRecomputeJob } = await import('@/lib/cron/job-health-recompute');
        await runHealthRecomputeJob();
        break;
      }
      case 'ladipage': {
        const { runLadipageSyncJob } = await import('@/lib/cron/job-ladipage-sync');
        await runLadipageSyncJob();
        break;
      }
    }
    return NextResponse.json({
      ok: true,
      job,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, job, error: msg, durationMs: Date.now() - startedAt },
      { status: 500 }
    );
  }
}
