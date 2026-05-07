import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-session';
import { markAlertRead } from '@/lib/queries/alerts';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Invalid alert id' }, { status: 400 });
  }

  try {
    await markAlertRead(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[mark-read] DB error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
