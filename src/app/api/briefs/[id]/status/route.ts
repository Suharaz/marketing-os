// PATCH /api/briefs/[id]/status — đổi status của 1 brief.
// Body: { status: BriefStatusT }
// Response: { brief: Brief } — brief đã update để client patch state ngay.

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/get-session';
import { updateBriefStatus } from '@/lib/queries/briefs-mutate';

export const runtime = 'nodejs';

const bodySchema = z.object({
  status: z.enum(['mine', 'draft', 'submitted', 'published', 'revision']),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing brief id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const brief = await updateBriefStatus(id, parsed.data.status, {
      member_id: user.userId,
      name: user.name,
    });
    if (!brief) {
      return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
    }
    return NextResponse.json({ brief });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[PATCH /api/briefs/[id]/status]', message, err);
    return NextResponse.json(
      { error: `Failed to update status: ${message}` },
      { status: 500 }
    );
  }
}
