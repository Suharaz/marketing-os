// GET /api/admin/cron-status — runtime diagnostic for production cron.
// Reports whether initCrons() ran, container time, and scheduled job count.
// Admin-only. Use this in Coolify/Docker deploys when "cron isn't firing"
// to confirm the scheduler initialized inside the running container.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-session';
import { getUserRole } from '@/lib/auth/get-role';

export const runtime = 'nodejs';

declare global {
  // eslint-disable-next-line no-var
  var __cron_initialized: boolean | undefined;
}

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = await getUserRole(user.userId);
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date();
  return NextResponse.json({
    cronInitialized: globalThis.__cron_initialized === true,
    serverTime: {
      iso: now.toISOString(),
      vnLocal: now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      utcOffsetMinutes: -now.getTimezoneOffset(),
      envTZ: process.env.TZ ?? null,
    },
    runtime: {
      nodeVersion: process.version,
      nextRuntime: process.env.NEXT_RUNTIME ?? null,
      pid: process.pid,
      uptimeSec: Math.floor(process.uptime()),
    },
    schedules: [
      { name: 'page_insights',    cron: '0 2,10,18 * * *', tz: 'UTC' },
      { name: 'posts_ingestion',  cron: '30 2 * * *',      tz: 'UTC' },
      { name: 'health_recompute', cron: '0 3 * * *',       tz: 'UTC' },
      { name: 'ladipage_sync',    cron: '30 23 * * *',     tz: 'Asia/Ho_Chi_Minh' },
    ],
  });
}
