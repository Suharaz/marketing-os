// DELETE /api/team-members/[id] — admin-only, with self-delete guard.
//
// Why guard self-delete: if the only admin removes their own row, nobody can
// log in to add a new admin. seed-admin.cjs would re-spawn admin@taki.vn on
// next container boot, but that's a recovery path — better refuse upfront.

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/get-session';
import { getUserRole } from '@/lib/auth/get-role';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(
  _req: Request,
  context: RouteContext
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = await getUserRole(user.userId);
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { id } = await context.params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  // Self-delete guard — admin removing themselves locks everyone out
  if (id === user.userId) {
    return NextResponse.json(
      { error: 'Không thể tự xoá tài khoản của bạn' },
      { status: 400 }
    );
  }

  try {
    const result = await db.query<{ email: string }>(
      `DELETE FROM team_member WHERE id = $1 RETURNING email`,
      [id]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, email: result.rows[0]?.email });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[DELETE /api/team-members/:id]', message);
    return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 });
  }
}
