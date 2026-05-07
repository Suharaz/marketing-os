// GET /api/auth/fb/connect
// Generates a CSRF state token, stores it in the iron-session, then redirects
// the browser to the Facebook OAuth dialog.
// Requires an active admin session — returns 401 if unauthenticated.

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getCurrentUser, getSession } from '@/lib/auth/get-session';
import { buildAuthUrl } from '@/lib/fb/oauth-flow';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Generate a 16-byte (32 hex char) CSRF state token
  const state = randomBytes(16).toString('hex');

  // Persist state in the session for verification in the callback
  const session = await getSession();
  session.fb_oauth_state = state;
  await session.save();

  const authUrl = buildAuthUrl(state);
  return NextResponse.redirect(authUrl);
}
