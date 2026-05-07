import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, type SessionData } from './session-config';

/**
 * Returns the iron-session instance for the current request.
 * Server-only — do NOT import in client components or middleware.
 */
export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

/**
 * Returns the current user from session, or null if not authenticated.
 */
export async function getCurrentUser(): Promise<SessionData | null> {
  const session = await getSession();
  if (!session.userId) return null;
  return {
    userId: session.userId,
    email: session.email,
    name: session.name,
  };
}
