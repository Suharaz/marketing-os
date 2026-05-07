// GET /api/briefs/counts — số briefs theo từng status (cho badge tabs).
// Endpoint riêng vì client cần refetch counts sau khi create/update,
// nhưng không cần load lại danh sách.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-session';
import { fetchBriefsCounts } from '@/lib/queries/briefs-counts';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const counts = await fetchBriefsCounts();
    return NextResponse.json({ counts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[GET /api/briefs/counts]', message);
    return NextResponse.json({ error: 'Failed to fetch counts' }, { status: 500 });
  }
}
