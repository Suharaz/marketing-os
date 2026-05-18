// GET /api/skills — cursor-paginated list cho client load-more.
// Auth-gated. Trả 401 nếu không login.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-session';
import { listSkills } from '@/lib/queries/skill-lib';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cursor = req.nextUrl.searchParams.get('cursor');
    const result = await listSkills(cursor);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/skills]', err);
    return NextResponse.json({ error: 'Failed to list skills' }, { status: 500 });
  }
}
