// Aggregated counts for the library stats cards.
// Reuses LibraryFilter so stats reflect the user's active filters
// (search query, platform, account, type, date range, tag).

import { db } from '@/lib/db';
import type { LibraryFilter } from '@/lib/library/parse-filter-params';

export interface LibraryStats {
  total: number;
  thisWeek: number;
  prevWeek: number;
  viral: number;
}

// 5% engagement rate is the "viral" threshold used in the design mock.
const VIRAL_ER_THRESHOLD = 0.05;

interface FilterClause {
  sql: string;
  params: unknown[];
}

function buildFilterClause(filter: LibraryFilter): FilterClause {
  const params: unknown[] = [];
  const where: string[] = ['1=1'];

  function addParam(v: unknown): string {
    params.push(v);
    return `$${params.length}`;
  }

  if (filter.q) {
    const p = addParam(filter.q);
    where.push(`sp.content_tsv @@ websearch_to_tsquery('simple', ${p})`);
  }

  if (filter.platforms && filter.platforms.length > 0) {
    const p = addParam(filter.platforms);
    where.push(`sa.platform = ANY(${p}::platform_t[])`);
  }

  if (filter.accounts && filter.accounts.length > 0) {
    const p = addParam(filter.accounts);
    where.push(`sp.account_id = ANY(${p}::uuid[])`);
  }

  if (filter.types && filter.types.length > 0) {
    const p = addParam(filter.types);
    where.push(`sp.post_type = ANY(${p}::post_type_t[])`);
  }

  if (filter.from) {
    const p = addParam(filter.from);
    where.push(`sp.published_at >= ${p}::timestamptz`);
  }
  if (filter.to) {
    const p = addParam(filter.to);
    where.push(`sp.published_at < (${p}::timestamptz + INTERVAL '1 day')`);
  }

  if (filter.tag) {
    const p = addParam(`%${filter.tag}%`);
    where.push(`sp.campaign_tag ILIKE ${p}`);
  }

  return { sql: where.join(' AND '), params };
}

/**
 * Fetch total / this-week / previous-week / viral counts in a single query.
 * Single round-trip → cheaper than 4 separate counts.
 */
export async function fetchLibraryStats(
  filter: LibraryFilter
): Promise<LibraryStats> {
  const { sql: whereSql, params } = buildFilterClause(filter);

  const query = `
    WITH posts AS (
      SELECT sp.id, sp.published_at
      FROM social_post sp
      JOIN social_account sa ON sa.id = sp.account_id
      WHERE ${whereSql}
    ),
    er AS (
      SELECT
        post_id,
        AVG(engagement_rate)::numeric(10,4) AS avg_er
      FROM post_metric_daily
      WHERE post_id IN (SELECT id FROM posts)
      GROUP BY post_id
    )
    SELECT
      (SELECT COUNT(*)::bigint FROM posts) AS total,
      (SELECT COUNT(*)::bigint FROM posts
        WHERE published_at >= NOW() - INTERVAL '7 days') AS this_week,
      (SELECT COUNT(*)::bigint FROM posts
        WHERE published_at >= NOW() - INTERVAL '14 days'
          AND published_at <  NOW() - INTERVAL '7 days') AS prev_week,
      (SELECT COUNT(*)::bigint FROM er WHERE avg_er >= $${params.length + 1}::numeric) AS viral
  `;

  const result = await db.query<{
    total: string | number;
    this_week: string | number;
    prev_week: string | number;
    viral: string | number;
  }>(query, [...params, VIRAL_ER_THRESHOLD]);

  const row = result.rows[0];
  return {
    total: Number(row?.total ?? 0),
    thisWeek: Number(row?.this_week ?? 0),
    prevWeek: Number(row?.prev_week ?? 0),
    viral: Number(row?.viral ?? 0),
  };
}
