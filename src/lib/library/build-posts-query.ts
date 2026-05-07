// Builds parameterized SQL for the library posts query.
// Returns { sql, params } — never interpolates user input directly.

import type { LibraryFilter } from './parse-filter-params';

export interface BuiltQuery {
  sql: string;
  params: unknown[];
}

const METRICS_LATERAL = `
  LEFT JOIN LATERAL (
    SELECT
      AVG(engagement_rate)::numeric(10,4) AS avg_er,
      SUM(reach)::bigint                  AS total_reach,
      SUM(reactions)::bigint              AS total_reactions,
      SUM(comments)::bigint               AS total_comments,
      SUM(shares)::bigint                 AS total_shares,
      SUM(video_views)::bigint            AS total_video_views
    FROM post_metric_daily
    WHERE post_id = sp.id
  ) metrics ON TRUE`;

/** Map sort key → ORDER BY expression and cursor column alias */
const SORT_MAP = {
  recent: { orderBy: 'sp.published_at DESC, sp.id DESC', cursorCol: 'sp.published_at', castAs: 'timestamptz' },
  er:     { orderBy: 'metrics.avg_er DESC NULLS LAST, sp.id DESC', cursorCol: 'metrics.avg_er', castAs: 'numeric' },
  reach:  { orderBy: 'metrics.total_reach DESC NULLS LAST, sp.id DESC', cursorCol: 'metrics.total_reach', castAs: 'bigint' },
} as const;

export function buildPostsQuery(filter: LibraryFilter): BuiltQuery {
  const params: unknown[] = [];
  const where: string[] = ['1=1'];

  function addParam(v: unknown): string {
    params.push(v);
    return `$${params.length}`;
  }

  // Full-text search
  if (filter.q) {
    const p = addParam(filter.q);
    where.push(`sp.content_tsv @@ websearch_to_tsquery('simple', ${p})`);
  }

  // Platform multi-select
  if (filter.platforms && filter.platforms.length > 0) {
    const p = addParam(filter.platforms);
    where.push(`sa.platform = ANY(${p}::platform_t[])`);
  }

  // Account multi-select
  if (filter.accounts && filter.accounts.length > 0) {
    const p = addParam(filter.accounts);
    where.push(`sp.account_id = ANY(${p}::uuid[])`);
  }

  // Post type multi-select
  if (filter.types && filter.types.length > 0) {
    const p = addParam(filter.types);
    where.push(`sp.post_type = ANY(${p}::post_type_t[])`);
  }

  // Date range
  if (filter.from) {
    const p = addParam(filter.from);
    where.push(`sp.published_at >= ${p}::timestamptz`);
  }
  if (filter.to) {
    // Include the full end day
    const p = addParam(filter.to);
    where.push(`sp.published_at < (${p}::timestamptz + INTERVAL '1 day')`);
  }

  // Campaign tag contains (case-insensitive)
  if (filter.tag) {
    const p = addParam(`%${filter.tag}%`);
    where.push(`sp.campaign_tag ILIKE ${p}`);
  }

  // Cursor pagination — composite cursor "{sortValue}_{id}"
  const sort = filter.sort ?? 'recent';
  const sortDef = SORT_MAP[sort];

  if (filter.cursor) {
    const lastUnderscoreIdx = filter.cursor.lastIndexOf('_');
    if (lastUnderscoreIdx > 0) {
      const rawVal = filter.cursor.slice(0, lastUnderscoreIdx);
      const rawId = filter.cursor.slice(lastUnderscoreIdx + 1);
      const pVal = addParam(rawVal);
      const pId = addParam(rawId);
      // Composite row comparison for stable keyset pagination
      where.push(
        `(${sortDef.cursorCol}, sp.id) < (${pVal}::${sortDef.castAs}, ${pId}::uuid)`
      );
    }
  }

  const whereClause = where.join('\n    AND ');

  const sql = `
SELECT
  sp.id,
  sp.content,
  sp.media_url,
  sp.post_type,
  sp.published_at,
  sp.permalink,
  sp.campaign_tag,
  sa.id   AS account_id,
  sa.name AS account_name,
  sa.platform,
  COALESCE(metrics.avg_er, 0)             AS avg_er,
  COALESCE(metrics.total_reach, 0)        AS total_reach,
  COALESCE(metrics.total_reactions, 0)    AS total_reactions,
  COALESCE(metrics.total_comments, 0)     AS total_comments,
  COALESCE(metrics.total_shares, 0)       AS total_shares,
  COALESCE(metrics.total_video_views, 0)  AS total_video_views
FROM social_post sp
JOIN social_account sa ON sa.id = sp.account_id
${METRICS_LATERAL}
WHERE ${whereClause}
ORDER BY ${sortDef.orderBy}
LIMIT 25`;

  return { sql: sql.trim(), params };
}
