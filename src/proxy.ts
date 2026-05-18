import { NextRequest, NextResponse } from 'next/server';
import { unsealData } from 'iron-session';
import type { SessionData } from '@/lib/auth/session-config';

// Next.js 16 proxy convention (replaces deprecated middleware).
// Runtime is Node.js — Edge is not supported here. bcryptjs/pg/next-headers
// could technically be imported now, but we keep this file minimal to stay
// fast on every matched request.

const COOKIE_NAME = 'mos_session';

// ttl must match sessionOptions (7 days in seconds = 604800)
const SESSION_TTL = 60 * 60 * 24 * 7;

// `api/skills/upload` được loại trừ vì Next.js 16 proxy default buffer
// 10MB body (proxyClientMaxBodySize) — sẽ truncate file lớn. Route handler
// tự check session bên trong nên không mất bảo mật.
export const config = {
  matcher: ['/((?!api/auth|api/skills/upload|_next|favicon.ico|public|login).*)'],
};

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Root '/' is the public landing page — let it through unauthenticated.
  // The page itself handles "already logged in" by redirecting to /dashboard,
  // so the proxy would only get in the way here.
  //
  // Why not exclude '/' in the matcher regex above? Next.js path-to-regexp
  // can't anchor to "exactly /" without matching all subpaths too. Easier
  // to short-circuit in the handler.
  if (request.nextUrl.pathname === '/') {
    return NextResponse.next();
  }

  const sessionPassword = process.env.SESSION_PASSWORD;

  // If SESSION_PASSWORD is not configured, always redirect to login
  if (!sessionPassword || sessionPassword.length < 32) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;

  if (cookieValue) {
    try {
      const session = await unsealData<SessionData>(cookieValue, {
        password: sessionPassword,
        ttl: SESSION_TTL,
      });

      if (session.userId) {
        return NextResponse.next();
      }
    } catch {
      // Tampered or expired cookie — fall through to redirect
    }
  }

  return NextResponse.redirect(new URL('/login', request.url));
}
