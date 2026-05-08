// GET  /api/revenue          — list 50 most recent (auth required)
// POST /api/revenue          — create new revenue entry (auth required)

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-session';
import { fetchRecentRevenue, createRevenue } from '@/lib/queries/revenue';
import { revenueInputSchema } from '@/lib/validation/revenue-schema';

export const runtime = 'nodejs';

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await fetchRecentRevenue(50);
    return NextResponse.json({ items: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[GET /api/revenue]', message);
    return NextResponse.json({ error: 'Failed to fetch revenue' }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = revenueInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const id = await createRevenue(parsed.data, user.userId);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[POST /api/revenue]', message);
    return NextResponse.json({ error: 'Failed to create revenue' }, { status: 500 });
  }
}
