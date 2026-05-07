// GET /api/channels/[id]/sync-log — returns 10 latest sync log entries for an account

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/get-session';

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
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid channel id' }, { status: 400 });
  }

  try {
    const res = await db.query<{
      id: string;
      sync_type: string;
      status: string;
      records_upserted: string | null;
      error_message: string | null;
      started_at: string;
    }>(
      `SELECT id, sync_type, status, records_upserted, error_message, started_at
       FROM api_sync_log
       WHERE account_id = $1
       ORDER BY started_at DESC
       LIMIT 10`,
      [id]
    );

    const entries = res.rows.map((row) => ({
      id: row.id,
      syncType: row.sync_type,
      status: row.status,
      recordsUpserted:
        row.records_upserted !== null ? Number(row.records_upserted) : null,
      errorMessage: row.error_message,
      startedAt: row.started_at,
    }));

    return NextResponse.json({ entries });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[GET /api/channels/[id]/sync-log] Error:', message);
    return NextResponse.json({ error: 'Failed to fetch sync log' }, { status: 500 });
  }
}
