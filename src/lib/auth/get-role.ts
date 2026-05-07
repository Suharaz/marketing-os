import { db } from '@/lib/db';

// Lấy role thực tế từ DB cho 1 user (không cache trong session để tránh stale).
// Trả null nếu user không tồn tại.
export async function getUserRole(userId: string): Promise<string | null> {
  const res = await db.query<{ role: string }>(
    `SELECT role FROM team_member WHERE id = $1 LIMIT 1`,
    [userId]
  );
  return res.rows[0]?.role ?? null;
}
