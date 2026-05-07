// Executes the library posts query and handles cursor pagination.
// Returns up to 24 posts + nextCursor (null if no more pages).

import { db } from '@/lib/db';
import { buildPostsQuery } from '@/lib/library/build-posts-query';
import type { LibraryFilter } from '@/lib/library/parse-filter-params';

export interface LibraryPost {
  id: string;
  content: string | null;
  mediaUrl: string | null;
  postType: string;
  publishedAt: string; // ISO string — safe for JSON serialization
  permalink: string | null;
  campaignTag: string | null;
  accountId: string;
  accountName: string;
  platform: string;
  avgEr: number;
  totalReach: number;
  totalReactions: number;
  totalComments: number;
  totalShares: number;
  totalVideoViews: number;
}

export interface LibraryPostsResult {
  posts: LibraryPost[];
  nextCursor: string | null;
}

const PAGE_SIZE = 24;

type LibraryRow = {
  id: string;
  content: string | null;
  media_url: string | null;
  post_type: string;
  published_at: Date;
  permalink: string | null;
  campaign_tag: string | null;
  account_id: string;
  account_name: string;
  platform: string;
  avg_er: string | number;
  total_reach: string | number;
  total_reactions: string | number;
  total_comments: string | number;
  total_shares: string | number;
  total_video_views: string | number;
};

function buildCursor(row: LibraryRow, sort: LibraryFilter['sort']): string {
  let sortValue: string;
  switch (sort) {
    case 'er':
      sortValue = String(row.avg_er ?? 0);
      break;
    case 'reach':
      sortValue = String(row.total_reach ?? 0);
      break;
    case 'recent':
    default:
      // ISO timestamp is safe for string comparison with timestamptz cast
      sortValue = row.published_at instanceof Date
        ? row.published_at.toISOString()
        : String(row.published_at);
      break;
  }
  return `${sortValue}_${row.id}`;
}

function mapRow(row: LibraryRow): LibraryPost {
  return {
    id: row.id,
    content: row.content,
    mediaUrl: row.media_url,
    postType: row.post_type,
    publishedAt: row.published_at instanceof Date
      ? row.published_at.toISOString()
      : String(row.published_at),
    permalink: row.permalink,
    campaignTag: row.campaign_tag,
    accountId: row.account_id,
    accountName: row.account_name,
    platform: row.platform,
    avgEr: Number(row.avg_er ?? 0),
    totalReach: Number(row.total_reach ?? 0),
    totalReactions: Number(row.total_reactions ?? 0),
    totalComments: Number(row.total_comments ?? 0),
    totalShares: Number(row.total_shares ?? 0),
    totalVideoViews: Number(row.total_video_views ?? 0),
  };
}

export async function fetchLibraryPosts(
  filter: LibraryFilter
): Promise<LibraryPostsResult> {
  const { sql, params } = buildPostsQuery(filter);

  const result = await db.query<LibraryRow>(sql, params);
  const rows = result.rows;

  // LIMIT 25 fetched — if 25 returned there's a next page
  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  // Cursor built from the last row of the current page (25th row is the peek-ahead)
  const peekRow = hasMore ? rows[PAGE_SIZE] : undefined;
  const nextCursor = peekRow
    ? buildCursor(peekRow, filter.sort ?? 'recent')
    : null;

  return {
    posts: pageRows.map(mapRow),
    nextCursor,
  };
}

/** Fetch active social accounts for filter sidebar. */
export interface AccountOption {
  id: string;
  name: string;
  platform: string;
}

export async function fetchActiveAccounts(): Promise<AccountOption[]> {
  const res = await db.query<{ id: string; name: string; platform: string }>(
    `SELECT id, name, platform FROM social_account
     WHERE status = 'active'
     ORDER BY name ASC`
  );
  return res.rows;
}
