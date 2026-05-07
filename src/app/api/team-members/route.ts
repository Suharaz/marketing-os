// GET  /api/team-members — list all team members
// POST /api/team-members — create new team member (admin only)

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/get-session';
import { fetchTeamMembers } from '@/lib/queries/team-members';
import { hashPassword } from '@/lib/auth/hash-password';

export const runtime = 'nodejs';

// Postgres error code 23505 = unique_violation (email đã tồn tại)
const PG_UNIQUE_VIOLATION = '23505';

const createSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(255),
  // role: 'admin' = full quyền; 'member' = chỉ xem/thao tác kênh được gán
  role: z.enum(['admin', 'member']),
  password: z.string().min(8).max(72), // bcrypt giới hạn 72 bytes
});

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const members = await fetchTeamMembers();
    return NextResponse.json({ members });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[GET /api/team-members] Error:', message);
    return NextResponse.json(
      { error: 'Failed to fetch team members' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Chỉ admin mới được tạo user — check role từ DB (session không lưu role để tránh stale)
  const roleCheck = await db.query<{ role: string }>(
    `SELECT role FROM team_member WHERE id = $1`,
    [user.userId]
  );
  if (roleCheck.rows[0]?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, name, role, password } = parsed.data;

  try {
    const passwordHash = await hashPassword(password);
    const result = await db.query<{ id: string }>(
      `INSERT INTO team_member (email, name, role, password_hash)
       VALUES (LOWER($1), $2, $3, $4)
       RETURNING id`,
      [email, name, role, passwordHash]
    );

    return NextResponse.json(
      { id: result.rows[0]?.id, ok: true },
      { status: 201 }
    );
  } catch (err) {
    // Bắt lỗi duplicate email rõ ràng → 409 thay vì 500
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === PG_UNIQUE_VIOLATION
    ) {
      return NextResponse.json(
        { error: 'Email đã tồn tại trong hệ thống.' },
        { status: 409 }
      );
    }

    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[POST /api/team-members] Error:', message);
    return NextResponse.json(
      { error: 'Failed to create team member' },
      { status: 500 }
    );
  }
}
