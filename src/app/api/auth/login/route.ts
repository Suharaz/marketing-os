import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import type { TeamMember } from '@/lib/db-types';
import { getSession } from '@/lib/auth/get-session';
import { verifyPassword } from '@/lib/auth/verify-password';
import {
  checkRateLimit,
  recordFailure,
  clearFailures,
} from '@/lib/auth/rate-limit-login';

// Explicit Node runtime — bcryptjs and pg are not Edge-compatible
export const runtime = 'nodejs';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Parse + validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  // Rate limit check
  const rateLimit = checkRateLimit(normalizedEmail);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSec ?? 900),
        },
      }
    );
  }

  // Fetch user — use LOWER() to normalize email comparison
  const result = await db.query<TeamMember>(
    `SELECT id, email, name, role, password_hash
     FROM team_member
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [normalizedEmail]
  );
  const user = result.rows[0] ?? null;

  // Always run bcrypt compare (timing-safe — verifyPassword uses dummy hash if null)
  const passwordOk = await verifyPassword(password, user?.password_hash ?? null);

  if (!user || !passwordOk) {
    recordFailure(normalizedEmail);
    return NextResponse.json(
      { error: 'Email hoặc mật khẩu sai' },
      { status: 401 }
    );
  }

  // Success — clear failures, write session
  clearFailures(normalizedEmail);

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.name = user.name;
  await session.save();

  return NextResponse.json({ ok: true });
}
