// POST /api/auth/change-password — user đổi MK của chính mình.
//
// Why bắt nhập MK cũ dù đã có session:
// Session có thể bị cướp (XSS, máy mượn). Yêu cầu MK cũ chứng minh là chủ
// tài khoản thật, không phải kẻ chiếm cookie. Đây là lý do endpoint này
// KHÁC với admin-reset (admin không biết MK cũ → không yêu cầu).

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/get-session';
import { verifyPassword } from '@/lib/auth/verify-password';
import { hashPassword } from '@/lib/auth/hash-password';
import {
  checkRateLimit,
  recordFailure,
  clearFailures,
} from '@/lib/auth/rate-limit-login';
import { passwordSchema } from '@/lib/validation/password';

// bcryptjs + pg không chạy trên Edge runtime
export const runtime = 'nodejs';

const bodySchema = z.object({
  currentPassword: z.string().min(1, 'Thiếu mật khẩu hiện tại'),
  newPassword: passwordSchema,
});

// Rate-limit key prefix để tách namespace với login attempts
const RATE_LIMIT_PREFIX = 'change-pw:';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse + validate body
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

  const { currentPassword, newPassword } = parsed.data;

  // UX: từ chối MK mới == MK cũ ngay tại đây (tránh paste nhầm)
  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: 'Mật khẩu mới phải khác mật khẩu cũ' },
      { status: 400 }
    );
  }

  // Rate-limit check — key theo userId để chặn 1 user spam
  const rateLimitKey = `${RATE_LIMIT_PREFIX}${user.userId}`;
  const rateLimit = checkRateLimit(rateLimitKey);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Quá nhiều lần thử, vui lòng đợi một chút' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSec ?? 900) },
      }
    );
  }

  // Lấy hash hiện tại để verify
  const result = await db.query<{ password_hash: string | null }>(
    `SELECT password_hash FROM team_member WHERE id = $1 LIMIT 1`,
    [user.userId]
  );
  const currentHash = result.rows[0]?.password_hash ?? null;

  const passwordOk = await verifyPassword(currentPassword, currentHash);
  if (!passwordOk) {
    recordFailure(rateLimitKey);
    return NextResponse.json(
      { error: 'Mật khẩu hiện tại không đúng' },
      { status: 401 }
    );
  }

  // Đổi MK
  try {
    const newHash = await hashPassword(newPassword);
    const updateResult = await db.query(
      `UPDATE team_member SET password_hash = $1 WHERE id = $2`,
      [newHash, user.userId]
    );
    // Edge case: user bị admin xoá giữa chừng (sau khi verify MK cũ).
    // Không return 200 vì sẽ lying — không có row nào được update.
    if (updateResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Tài khoản không còn tồn tại' },
        { status: 404 }
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // Chỉ log userId + lỗi, KHÔNG log MK
    console.error('[POST /api/auth/change-password]', user.userId, message);
    return NextResponse.json(
      { error: 'Không thể đổi mật khẩu' },
      { status: 500 }
    );
  }

  // Clear rate-limit khi đổi thành công — tránh user sai 3 lần rồi đúng
  // mà vẫn bị tính 3 lần ở lần sau
  clearFailures(rateLimitKey);

  return NextResponse.json({ ok: true });
}
