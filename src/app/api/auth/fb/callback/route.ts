// GET /api/auth/fb/callback?code=...&state=...
// Verifies CSRF state, exchanges code for tokens, lists pages.
// Stores page list in short-lived iron-session field, then redirects to /channels/new?step=pick.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getSession } from '@/lib/auth/get-session';
import {
  exchangeCodeForUserToken,
  extendUserToken,
  listUserPages,
} from '@/lib/fb/oauth-flow';
import type { FBPage } from '@/lib/fb/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.nextUrl.origin));
  }

  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  if (errorParam) {
    const url = new URL('/channels/new', req.nextUrl.origin);
    url.searchParams.set('step', 'connect');
    url.searchParams.set('error', errorParam);
    return NextResponse.redirect(url);
  }

  if (!code || !state) {
    const url = new URL('/channels/new', req.nextUrl.origin);
    url.searchParams.set('step', 'connect');
    url.searchParams.set('error', 'missing_params');
    return NextResponse.redirect(url);
  }

  const session = await getSession();
  const expectedState = session.fb_oauth_state;

  if (!expectedState || expectedState !== state) {
    const url = new URL('/channels/new', req.nextUrl.origin);
    url.searchParams.set('step', 'connect');
    url.searchParams.set('error', 'invalid_state');
    return NextResponse.redirect(url);
  }

  // Clear CSRF state immediately
  session.fb_oauth_state = undefined;

  try {
    const shortToken = await exchangeCodeForUserToken(code);
    const userToken = await extendUserToken(shortToken);
    const pages: FBPage[] = await listUserPages(userToken);

    // Store pages in session — expires in 5 minutes. Token stays server-side only.
    session.fb_oauth_pages = {
      pages: pages.slice(0, 30).map((p) => ({
        id: p.id,
        name: p.name,
        access_token: p.access_token,
        category: p.category,
      })),
      userToken,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };

    await session.save();

    const redirectUrl = new URL('/channels/new', req.nextUrl.origin);
    redirectUrl.searchParams.set('step', 'pick');
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    // Clear partial state on error
    session.fb_oauth_pages = undefined;
    await session.save();

    const message = err instanceof Error ? err.message : 'oauth_failed';
    const url = new URL('/channels/new', req.nextUrl.origin);
    url.searchParams.set('step', 'connect');
    url.searchParams.set('error', encodeURIComponent(message));
    return NextResponse.redirect(url);
  }
}
