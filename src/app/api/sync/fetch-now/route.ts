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

  // Fire-and-forget: spawn sync in the background, return 202 immediately.
  // Sync can take 5-15 minutes due to FB throttle (25-45s between calls) +
  // pagination + insights + ladipage stages. Blocking the HTTP response
  // would tie up the connection and force the client to wait.
  // Errors (including TokenExpiredError) are logged into api_sync_log by
  // runManualSync itself — clients should poll that table for final status.
  void runManualSync(accountId).catch((err) => {
    if (err instanceof TokenExpiredError) {
      console.warn(`[POST /api/sync/fetch-now] Token expired for ${accountId}`);
      return;
    }
    const message = err instanceof Error ? err.message : 'Sync failed';
    console.error(`[POST /api/sync/fetch-now] Background sync failed for ${accountId}:`, message);
  });

  return NextResponse.json(
    {
      ok: true,
      status: 'processing',
      message: 'Đang đồng bộ ở phía sau — kết quả sẽ cập nhật trong vài phút',
      accountId,
    },
    { status: 202 }
  );
}
