// PATCH /api/briefs/[id] — sửa content fields (title, description, format,
// priority, deadline, links, attachments). Status không update qua endpoint này.

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/get-session';
import { updateBriefContent } from '@/lib/queries/briefs-mutate';

export const runtime = 'nodejs';

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

const updateSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().default(''),
  format: z.enum([
    'tiktok', 'fb_reels', 'fb_post', 'yt_shorts', 'yt_long',
    'threads', 'instagram_post', 'instagram_reels',
  ]),
  priority: z.enum(['high', 'medium', 'low']),
  reference_links: z.array(refLinkSchema).default([]),
  attachments: z.array(attachmentSchema).default([]),
  deadline: z.string().nullable().default(null),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing brief id' }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const brief = await updateBriefContent(id, parsed.data, {
      member_id: user.userId,
      name: user.name,
    });
    if (!brief) {
      return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
    }
    return NextResponse.json({ brief });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[PATCH /api/briefs/[id]]', message, err);
    // Trả message thật để UI hiện được lỗi cụ thể (dev tool nội bộ, không lộ secret)
    return NextResponse.json(
      { error: `Failed to update brief: ${message}` },
      { status: 500 }
    );
  }
}
