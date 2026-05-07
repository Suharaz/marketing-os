// Cursor-paginated brief list — 10 per page.
// Cursor = "{created_at_iso}_{id}" — composite vì created_at có thể trùng.
// Filter theo status (1 status duy nhất tại 1 thời điểm — match UI tab pattern).

import { db } from '@/lib/db';
import {
  BRIEF_SELECT_SQL,
  mapBriefRow,
  type BriefRow,
} from '@/lib/briefs/brief-row-mapper';
import type { Brief, BriefStatusT } from '@/lib/briefs/brief-types';

const PAGE_SIZE = 8;

export interface BriefsListResult {
  briefs: Brief[];
  nextCursor: string | null;
}

interface CursorParts {
  createdAt: string;
  id: string;
}

/** Parse "iso_uuid" — return null nếu format invalid */
function parseCursor(cursor: string | undefined | null): CursorParts | null {
  if (!cursor) return null;
  // Cursor có dạng "2026-05-07T10:00:00.000Z_abc-123"
  // Tách bằng underscore cuối để tránh underscore trong ISO
  const lastUnderscore = cursor.lastIndexOf('_');
  if (lastUnderscore <= 0) return null;
  const createdAt = cursor.substring(0, lastUnderscore);
  const id = cursor.substring(lastUnderscore + 1);
  if (!createdAt || !id) return null;
  return { createdAt, id };
}

function buildCursor(row: BriefRow): string {
  return `${row.created_at.toISOString()}_${row.id}`;
}

export interface FetchBriefsArgs {
  status: BriefStatusT;
  cursor?: string | null;
}

export async function fetchBriefs({
  status,
  cursor,
}: FetchBriefsArgs): Promise<BriefsListResult> {
  const cursorParts = parseCursor(cursor);

  // Cursor pagination: WHERE (created_at, id) < (cursor_created_at, cursor_id)
  // Tuple compare ổn định hơn OR clause khi có tie-breaker.
  const whereClauses: string[] = ['b.status = $1'];
  const params: unknown[] = [status];

  if (cursorParts) {
    whereClauses.push(`(b.created_at, b.id) < ($2, $3)`);
    params.push(cursorParts.createdAt, cursorParts.id);
  }

  // Fetch PAGE_SIZE + 1 để biết còn page tiếp không (peek-ahead pattern)
  const sql = `
    ${BRIEF_SELECT_SQL}
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY b.created_at DESC, b.id DESC
    LIMIT ${PAGE_SIZE + 1}
  `;

  const result = await db.query<BriefRow>(sql, params);
  const rows = result.rows;

  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor = hasMore && lastRow ? buildCursor(lastRow) : null;

  return {
    briefs: pageRows.map(mapBriefRow),
    nextCursor,
  };
}

/** Lấy 1 brief theo id — dùng khi cần refresh detail view */
export async function fetchBriefById(id: string): Promise<Brief | null> {
  const sql = `${BRIEF_SELECT_SQL} WHERE b.id = $1 LIMIT 1`;
  const result = await db.query<BriefRow>(sql, [id]);
  const row = result.rows[0];
  return row ? mapBriefRow(row) : null;
}
