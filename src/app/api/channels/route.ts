// POST /api/channels
// Accepts a selected FB page, encrypts the page token, and UPSERTs social_account.
// ON CONFLICT (platform, external_id) → re-connects an existing page (refreshes token).

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/get-session';
import { encryptToken } from '@/lib/fb/token-encryption';

export const runtime = 'nodejs';

const channelSchema = z.object({
  pageId: z.string().min(1),
  pageToken: z.string().min(1),
  name: z.string().min(1).max(255),
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

  const parsed = channelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { pageId, pageToken, name } = parsed.data;

  try {
    // Encrypt page token via pgcrypto — never store plaintext
    const encryptedToken = await encryptToken(pageToken);

    const result = await db.query<{ id: string }>(
      `INSERT INTO social_account
         (platform, external_id, name, access_token_encrypted, status, owner_member_id)
       VALUES ('facebook', $1, $2, $3, 'active', $4)
       ON CONFLICT (platform, external_id)
       DO UPDATE SET
         name                    = EXCLUDED.name,
         access_token_encrypted  = EXCLUDED.access_token_encrypted,
         status                  = 'active',
         owner_member_id         = EXCLUDED.owner_member_id,
         connected_at            = NOW()
       RETURNING id`,
      [pageId, name, encryptedToken, user.userId]
    );

    const accountId = result.rows[0]?.id;
    if (!accountId) {
      throw new Error('UPSERT returned no id');
    }

    return NextResponse.json({ accountId }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[POST /api/channels] Error:', message);
    return NextResponse.json({ error: 'Failed to save channel' }, { status: 500 });
  }
}
