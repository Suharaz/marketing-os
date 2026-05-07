// GET /api/briefs/[id]/activity — danh sách activity log của 1 brief.
// Sort newest first. Trả về toàn bộ history (small data, không pagination).

import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-session';
import { fetchActivityForBrief } from '@/lib/queries/briefs-activity';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing brief id' }, { status: 400 });

  try {
    const activity = await fetchActivityForBrief(id);
    return NextResponse.json({ activity });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[GET /api/briefs/[id]/activity]', message);
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
