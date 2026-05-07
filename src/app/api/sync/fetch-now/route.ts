// POST /api/sync/fetch-now
// Triggers a manual sync for one social_account.
// Debounced to one trigger per 60s per account to avoid rate-limit abuse.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/get-session';
import { shouldAllowSync } from '@/lib/sync/debounce-store';
import { runManualSync } from '@/lib/sync/run-sync';
import { TokenExpiredError } from '@/lib/fb/types';

export const runtime = 'nodejs';

const bodySchema = z.object({
  accountId: z.string().uuid(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'accountId must be a valid UUID' },
      { status: 400 }
    );
  }

  const { accountId } = parsed.data;

  // Debounce check — 60s window per account
  const debounce = shouldAllowSync(accountId);
  if (!debounce.allowed) {
    return NextResponse.json(
      { error: 'Too many requests — please wait before syncing again' },
      {
        status: 429,
        headers: {
          'Retry-After': String(debounce.retryAfterSec ?? 60),
        },
      }
    );
  }

  try {
    const recordsUpserted = await runManualSync(accountId);
    return NextResponse.json({ ok: true, recordsUpserted });
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      return NextResponse.json(
        { error: 'Page token expired — please reconnect the channel' },
        { status: 401 }
      );
    }

    const message = err instanceof Error ? err.message : 'Sync failed';
    console.error('[POST /api/sync/fetch-now] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
