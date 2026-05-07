import type { SessionOptions } from 'iron-session';

// Validate SESSION_PASSWORD at module load — fail fast if missing or too short
const sessionPassword = process.env.SESSION_PASSWORD;
if (!sessionPassword || sessionPassword.length < 32) {
  throw new Error(
    'SESSION_PASSWORD env var is required and must be at least 32 characters'
  );
}

export interface FbOAuthPage {
  id: string;
  name: string;
  access_token: string;
  category?: string;
}

export interface SessionData {
  userId: string;
  email: string;
  name: string;
  /** Temporary CSRF state stored during FB OAuth flow — cleared after callback */
  fb_oauth_state?: string;
  /** Short-lived FB OAuth page list — set by callback, consumed by /channels/new?step=pick */
  fb_oauth_pages?: {
    pages: FbOAuthPage[];
    userToken: string;
    expiresAt: number;
  };
}

export const sessionOptions: SessionOptions = {
  cookieName: 'mos_session',
  password: sessionPassword,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
  },
};
