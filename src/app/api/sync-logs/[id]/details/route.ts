// GET /api/sync-logs/[id]/details — return the details JSONB for one
// api_sync_log row. Called on-demand by both the admin /cron-logs table
// AND the per-channel sync log dialog, so the main pages can avoid
// embedding several MB of detail data in the RSC payload.
//
// Auth-only (any logged-in user). Sync call records have access_token
// redacted at write-time (see lib/sync/call-context.ts), so non-admins
// viewing their own channel's sync history is safe.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-session';
import { fetchCronDetails } from '@/lib/queries/cron-history';

export const runtime = 'nodejs';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const details = await fetchCronDetails(id);
  return NextResponse.json({ details });
}
