// DB queries cho table skill_lib. Cursor pagination theo created_at DESC.
// Convention giống `library-posts.ts` — server component fetch list, client
// dùng nextCursor để load more.

import { db } from '@/lib/db';
import type { SkillLib } from '@/lib/db-types';

export interface SkillListItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  original_filename: string;
  size_bytes: number;
  sha256: string;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string; // ISO — JSON-safe
}

export interface SkillListResult {
  items: SkillListItem[];
  nextCursor: string | null;
}

const PAGE_SIZE = 24;

/**
 * Cursor pagination: cursor = ISO timestamp của created_at item cuối page trước.
 * Đơn giản hơn offset (không bị skip/duplicate khi có item mới insert giữa chừng).
 */
export async function listSkills(cursor: string | null = null): Promise<SkillListResult> {
  const params: unknown[] = [PAGE_SIZE + 1]; // +1 để biết còn page sau không
  let whereClause = '';
  if (cursor) {
    params.push(cursor);
    whereClause = `WHERE s.created_at < $2`;
  }

  const sql = `
    SELECT s.id, s.slug, s.name, s.description, s.original_filename,
           s.size_bytes, s.sha256, s.uploaded_by, s.created_at,
           tm.name AS uploaded_by_name
    FROM skill_lib s
    LEFT JOIN team_member tm ON tm.id = s.uploaded_by
    ${whereClause}
    ORDER BY s.created_at DESC
    LIMIT $1
  `;

  const res = await db.query(sql, params);
  const rows = res.rows;

  const hasMore = rows.length > PAGE_SIZE;
  const items = (hasMore ? rows.slice(0, PAGE_SIZE) : rows).map(mapRow);
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? last.created_at : null;

  return { items, nextCursor };
}

export async function getSkillById(id: string): Promise<SkillListItem | null> {
  const res = await db.query(
    `SELECT s.id, s.slug, s.name, s.description, s.original_filename,
            s.size_bytes, s.sha256, s.uploaded_by, s.created_at,
            tm.name AS uploaded_by_name
     FROM skill_lib s
     LEFT JOIN team_member tm ON tm.id = s.uploaded_by
     WHERE s.id = $1
     LIMIT 1`,
    [id],
  );
  return res.rows[0] ? mapRow(res.rows[0]) : null;
}

/**
 * Trả về storage_path để route handler download/file biết file thật trên disk.
 * Tách riêng vì SkillListItem dành cho client/UI — không leak storage path
 * ra ngoài API JSON.
 */
export async function getSkillStoragePath(id: string): Promise<{
  storage_path: string;
  original_filename: string;
  uploaded_by: string | null;
} | null> {
  const res = await db.query<Pick<SkillLib, 'storage_path' | 'original_filename' | 'uploaded_by'>>(
    `SELECT storage_path, original_filename, uploaded_by FROM skill_lib WHERE id = $1 LIMIT 1`,
    [id],
  );
  return res.rows[0] ?? null;
}

export interface InsertSkillInput {
  slug: string;
  name: string;
  description: string | null;
  original_filename: string;
  size_bytes: number;
  sha256: string;
  storage_path: string;
  uploaded_by: string;
}

export async function insertSkill(input: InsertSkillInput): Promise<{ id: string; slug: string }> {
  const res = await db.query<{ id: string; slug: string }>(
    `INSERT INTO skill_lib
       (slug, name, description, original_filename, size_bytes, sha256, storage_path, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, slug`,
    [
      input.slug,
      input.name,
      input.description,
      input.original_filename,
      input.size_bytes,
      input.sha256,
      input.storage_path,
      input.uploaded_by,
    ],
  );
  // INSERT ... RETURNING luôn trả 1 row khi không có constraint failure
  // (failure case sẽ throw, không reach đây). Non-null assertion an toàn.
  const row = res.rows[0];
  if (!row) throw new Error('INSERT returned no row');
  return row;
}

export async function deleteSkill(id: string): Promise<void> {
  await db.query(`DELETE FROM skill_lib WHERE id = $1`, [id]);
}

/**
 * Kiểm tra slug đã tồn tại chưa. Dùng để auto-suffix `-2`, `-3` khi
 * 2 user upload file cùng tên.
 */
export async function slugExists(slug: string): Promise<boolean> {
  const res = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM skill_lib WHERE slug = $1) AS exists`,
    [slug],
  );
  return res.rows[0]?.exists ?? false;
}

/**
 * Generate slug unique bằng cách append `-2`, `-3`, ... nếu base slug đã có.
 * Giới hạn 100 lần thử để khỏi infinite loop trong edge case lạ.
 */
export async function generateUniqueSlug(baseSlug: string): Promise<string> {
  const safeBase = baseSlug || 'skill';
  if (!(await slugExists(safeBase))) return safeBase;
  for (let i = 2; i < 100; i++) {
    const candidate = `${safeBase}-${i}`;
    if (!(await slugExists(candidate))) return candidate;
  }
  // Fallback: append timestamp — gần như chắc chắn unique
  return `${safeBase}-${Date.now()}`;
}

function mapRow(row: Record<string, unknown>): SkillListItem {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    original_filename: row.original_filename as string,
    size_bytes: Number(row.size_bytes), // bigint → number; an toàn vì < Number.MAX_SAFE_INTEGER (9PB)
    sha256: row.sha256 as string,
    uploaded_by: (row.uploaded_by as string | null) ?? null,
    uploaded_by_name: (row.uploaded_by_name as string | null) ?? null,
    created_at: (row.created_at as Date).toISOString(),
  };
}
