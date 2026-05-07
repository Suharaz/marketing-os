import { NextRequest, NextResponse } from 'next/server';
import { unsealData } from 'iron-session';
import type { SessionData } from '@/lib/auth/session-config';

// Edge runtime — do NOT import bcryptjs, pg, or next/headers cookies() here.

const COOKIE_NAME = 'mos_session';

// ttl must match sessionOptions (7 days in seconds = 604800)
const SESSION_TTL = 60 * 60 * 24 * 7;

export const config = {
  matcher: ['/((?!api/auth|_next|favicon.ico|public|login).*)'],
};

export default async function middleware(
  request: NextRequest
): Promise<NextResponse> {
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
