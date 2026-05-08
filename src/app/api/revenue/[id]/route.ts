// DELETE /api/revenue/[id] — remove a revenue entry (auth required)

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-session';
import { deleteRevenue } from '@/lib/queries/revenue';
import { invalidateDashboard } from '@/lib/cache/dashboard-cache';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(
  _req: Request,
  context: RouteContext
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  // Light UUID format check — DB FK + PK errors would also catch malformed IDs
  // but rejecting early avoids a round-trip for obviously bad input.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    await deleteRevenue(id);
    invalidateDashboard();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[DELETE /api/revenue/:id]', message);
    return NextResponse.json({ error: 'Failed to delete revenue' }, { status: 500 });
  }
}
