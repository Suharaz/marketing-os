// GET /api/library — cursor-paginated post list for load-more client calls.
// Auth-gated: returns 401 if session is missing.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-session';
import { parseFilterParams } from '@/lib/library/parse-filter-params';
import { fetchLibraryPosts } from '@/lib/queries/library-posts';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const filter = parseFilterParams(req.nextUrl.searchParams);
    const result = await fetchLibraryPosts(filter);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[GET /api/library]', message);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}
