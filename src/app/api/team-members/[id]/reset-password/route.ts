// POST /api/team-members/[id]/reset-password — admin đặt lại MK cho member.
//
// Why endpoint riêng (không gộp với change-password):
// - Admin không biết MK cũ của member → không thể yêu cầu currentPassword
// - Threat model khác: admin có quyền cao, nhưng phải chặn admin tự reset
//   (force admin tự đổi MK qua endpoint self-change, vì chỉ admin biết MK cũ)
// - Pattern theo DELETE /api/team-members/[id] (admin guard + UUID validate)

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/get-session';
import { getUserRole } from '@/lib/auth/get-role';
import { hashPassword } from '@/lib/auth/hash-password';
import { passwordSchema } from '@/lib/validation/password';

export const runtime = 'nodejs';

const bodySchema = z.object({
  newPassword: passwordSchema,
});

// Match same UUID regex pattern with DELETE [id]/route.ts
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Role check từ DB — session không cache role để tránh stale (admin bị
  // hạ quyền nhưng session cũ vẫn còn admin)
  const role = await getUserRole(user.userId);
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { id } = await context.params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  // Force admin tự đổi MK qua endpoint self-change (cần MK cũ).
  // Tránh trường hợp admin bị chiếm cookie → kẻ tấn công reset MK admin
  // mà không cần biết MK cũ.
  if (id === user.userId) {
    return NextResponse.json(
      { error: 'Dùng /settings/account để đổi mật khẩu của bạn' },
      { status: 400 }
    );
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
      { error: parsed.error.issues[0]?.message ?? 'Validation failed' },
      { status: 400 }
    );
  }

  const { newPassword } = parsed.data;

  try {
    const newHash = await hashPassword(newPassword);
    const result = await db.query(
      `UPDATE team_member SET password_hash = $1 WHERE id = $2`,
      [newHash, id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // Chỉ log id, KHÔNG log newPassword
    console.error('[POST /api/team-members/:id/reset-password]', id, message);
    return NextResponse.json(
      { error: 'Không thể reset mật khẩu' },
      { status: 500 }
    );
  }
}
