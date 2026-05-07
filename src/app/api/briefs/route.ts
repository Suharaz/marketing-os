// GET  /api/briefs?status=...&cursor=... — list paginated (10/page)
// POST /api/briefs — create new brief, default status=mine
// Auth-gated: 401 if no session.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/get-session';
import { fetchBriefs } from '@/lib/queries/briefs-list';
import { createBrief } from '@/lib/queries/briefs-mutate';
import type { BriefStatusT } from '@/lib/briefs/brief-types';

export const runtime = 'nodejs';

const VALID_STATUSES: BriefStatusT[] = [
  'mine', 'draft', 'submitted', 'published', 'revision',
];

// ─── GET ────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const statusRaw = req.nextUrl.searchParams.get('status') ?? 'mine';
  if (!VALID_STATUSES.includes(statusRaw as BriefStatusT)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  const status = statusRaw as BriefStatusT;
  const cursor = req.nextUrl.searchParams.get('cursor');

  try {
    const result = await fetchBriefs({ status, cursor });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[GET /api/briefs]', message);
    return NextResponse.json({ error: 'Failed to fetch briefs' }, { status: 500 });
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────────
const refLinkSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  label: z.string().nullable(),
});

const attachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  size_bytes: z.number().int().nonnegative(),
  mime_type: z.string(),
  url: z.string(),
});

const createSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().default(''),
  format: z.enum([
    'tiktok', 'fb_reels', 'fb_post', 'yt_shorts', 'yt_long',
    'threads', 'instagram_post', 'instagram_reels',
  ]),
  priority: z.enum(['high', 'medium', 'low']),
  persona_name: z.string().min(1),
  reference_links: z.array(refLinkSchema).default([]),
  attachments: z.array(attachmentSchema).default([]),
  deadline: z.string().nullable().default(null),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const brief = await createBrief(parsed.data, {
      member_id: user.userId,
      name: user.name,
    });
    return NextResponse.json({ brief }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[POST /api/briefs]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
