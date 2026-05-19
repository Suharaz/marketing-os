// PATCH /api/channels/[id] — update persona_json and/or owner_member_id
// DELETE /api/channels/[id] — set status='disconnected' (keeps posts)

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/get-session';
import { getUserRole } from '@/lib/auth/get-role';

export const runtime = 'nodejs';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Tất cả field đều optional — client gửi field nào thì update field đó.
// owner_member_id null nghĩa là "bỏ gán owner" (kênh thành mồ côi).
// kpi_posts_per_day: số bài/ngày mục tiêu — non-admin cũng được sửa (kênh họ phụ trách).
const patchSchema = z
  .object({
    persona_json: z.record(z.string(), z.unknown()).optional(),
    owner_member_id: z.string().uuid().nullable().optional(),
    kpi_posts_per_day: z.number().int().min(0).max(100).optional(),
  })
  .refine(
    (d) =>
      d.persona_json !== undefined ||
      d.owner_member_id !== undefined ||
      d.kpi_posts_per_day !== undefined,
    {
      message: 'At least one field required',
    }
  );

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid channel id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Đổi owner_member_id là hành động chỉ admin được làm. persona_json (mô tả
  // kênh) thì cho non-admin sửa được — họ vẫn có quyền cập nhật persona kênh
  // họ phụ trách. Check role chỉ khi request có owner_member_id.
  if (parsed.data.owner_member_id !== undefined) {
    const role = await getUserRole(user.userId);
    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Chỉ admin được đổi người phụ trách kênh.' },
        { status: 403 }
      );
    }
  }

  // Build dynamic SET clause — chỉ update field nào client gửi lên
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (parsed.data.persona_json !== undefined) {
    sets.push(`persona_json = $${i++}`);
    values.push(JSON.stringify(parsed.data.persona_json));
  }
  if (parsed.data.owner_member_id !== undefined) {
    sets.push(`owner_member_id = $${i++}`);
    values.push(parsed.data.owner_member_id);
  }
  if (parsed.data.kpi_posts_per_day !== undefined) {
    sets.push(`kpi_posts_per_day = $${i++}`);
    values.push(parsed.data.kpi_posts_per_day);
  }

  values.push(id);

  try {
    // Nếu owner_member_id được gửi và không null → verify FK tồn tại để báo lỗi rõ ràng
    if (parsed.data.owner_member_id) {
      const check = await db.query(
        `SELECT 1 FROM team_member WHERE id = $1`,
        [parsed.data.owner_member_id]
      );
      if (check.rowCount === 0) {
        return NextResponse.json(
          { error: 'Team member not found' },
          { status: 400 }
        );
      }
    }

    const result = await db.query(
      `UPDATE social_account
       SET ${sets.join(', ')}
       WHERE id = $${i}
       RETURNING id`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[PATCH /api/channels/[id]] Error:', message);
    return NextResponse.json({ error: 'Failed to update channel' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Hủy kết nối kênh là destructive action → chỉ admin mới được làm.
  const role = await getUserRole(user.userId);
  if (role !== 'admin') {
    return NextResponse.json(
      { error: 'Chỉ admin được hủy kết nối kênh.' },
      { status: 403 }
    );
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid channel id' }, { status: 400 });
  }

  try {
    const result = await db.query(
      `UPDATE social_account
       SET status = 'disconnected'
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[DELETE /api/channels/[id]] Error:', message);
    return NextResponse.json({ error: 'Failed to disconnect channel' }, { status: 500 });
  }
}
