import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/get-session';

// Explicit Node runtime — getSession uses next/headers cookies()
export const runtime = 'nodejs';

export async function POST(): Promise<NextResponse> {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
