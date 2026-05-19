// Posts domain MCP tools: posts_list, posts_get, posts_top.
// Reuse fetchLibraryPosts (cursor pagination + filter) cho list/top, fetchPost cho detail.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchLibraryPosts } from '@/lib/queries/library-posts';
import { fetchPost } from '@/lib/queries/post-detail';
import type { LibraryFilter } from '@/lib/library/parse-filter-params';

const PLATFORM_ENUM = z.enum([
  'facebook',
  'tiktok',
  'youtube',
  'instagram',
  'threads',
  'zalo',
]);
const POST_TYPE_ENUM = z.enum([
  'photo',
  'video',
  'reel',
  'status',
  'link',
  'album',
  'sticker',
  'share',
]);
const SORT_ENUM = z.enum(['recent', 'er', 'reach']);
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DATE_STRING = z.string().regex(DATE_REGEX, 'Date must be YYYY-MM-DD');

export function registerPostTools(server: McpServer): void {
  // ─── posts_list ───────────────────────────────────────────────────────
  server.registerTool(
    'posts_list',
    {
      title: 'List posts',
      description:
        'List posts with filters (account/platform/type/date range/tag). Cursor pagination. Returns latest metrics per post.',
      inputSchema: {
        accountId: z.string().uuid().optional().describe('Filter by channel UUID'),
        platform: PLATFORM_ENUM.optional().describe('Filter by platform'),
        type: POST_TYPE_ENUM.optional().describe('Filter by post type'),
        from: DATE_STRING.optional().describe('Published from (YYYY-MM-DD)'),
        to: DATE_STRING.optional().describe('Published to (YYYY-MM-DD)'),
        tag: z.string().optional().describe('Campaign tag'),
        sort: SORT_ENUM.optional().describe('Sort: recent (default) | er | reach'),
        cursor: z.string().optional().describe('Pagination cursor from previous response'),
        query: z.string().optional().describe('Full-text search across content'),
      },
    },
    async ({ accountId, platform, type, from, to, tag, sort, cursor, query }) => {
      const filter: LibraryFilter = {
        q: query,
        platforms: platform ? [platform] : undefined,
        accounts: accountId ? [accountId] : undefined,
        types: type ? [type] : undefined,
        from,
        to,
        tag,
        sort: sort ?? 'recent',
        cursor,
      };
      const { posts, nextCursor } = await fetchLibraryPosts(filter);

      return {
        content: [
          {
            type: 'text',
            text: `Found ${posts.length} post(s)${nextCursor ? ' (more available)' : ''}.`,
          },
        ],
        structuredContent: { items: posts, nextCursor },
      };
    }
  );

  // ─── posts_get ────────────────────────────────────────────────────────
  server.registerTool(
    'posts_get',
    {
      title: 'Get post detail',
      description:
        'Get full detail of one post by UUID. Includes latest metric snapshot (reach, impressions, ER, etc).',
      inputSchema: {
        id: z.string().uuid().describe('Post UUID'),
      },
    },
    async ({ id }) => {
      const post = await fetchPost(id);
      if (!post) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Post ${id} not found` }],
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: `Post on ${post.accountName} (${post.platform}, ${post.postType}). Reach ${post.reach ?? '—'}, ER ${post.engagementRate !== null ? (post.engagementRate * 100).toFixed(2) + '%' : '—'}`,
          },
        ],
        structuredContent: { post },
      };
    }
  );

  // ─── posts_top ────────────────────────────────────────────────────────
  server.registerTool(
    'posts_top',
    {
      title: 'Top posts by metric',
      description:
        'Top posts within a date range, sorted by engagement_rate or reach. Optional channel filter.',
      inputSchema: {
        from: DATE_STRING.describe('Start date (YYYY-MM-DD)'),
        to: DATE_STRING.describe('End date (YYYY-MM-DD)'),
        metric: z.enum(['engagement_rate', 'reach']).describe('Sort metric'),
        accountId: z.string().uuid().optional().describe('Filter by channel UUID'),
        limit: z.number().int().min(1).max(20).optional().describe('Max results, default 5'),
      },
    },
    async ({ from, to, metric, accountId, limit }) => {
      const filter: LibraryFilter = {
        sort: metric === 'engagement_rate' ? 'er' : 'reach',
        from,
        to,
        accounts: accountId ? [accountId] : undefined,
      };
      const { posts } = await fetchLibraryPosts(filter);
      const top = posts.slice(0, limit ?? 5);

      return {
        content: [
          {
            type: 'text',
            text: `Top ${top.length} post(s) by ${metric} between ${from} and ${to}.`,
          },
        ],
        structuredContent: { items: top, metric, from, to },
      };
    }
  );
}
