// Channels domain MCP tools:
//   channels_list, channels_get, channels_health, channels_metrics
// Pattern: thin adapter — validate input (zod) → gọi query → redact → format response.
// SQL ở src/lib/queries/*. PII redact ở src/mcp/redact.ts.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  fetchChannelsList,
  type ChannelsListFilter,
} from '@/lib/queries/channels-list';
import {
  fetchChannel,
  fetchMetricsRange,
} from '@/lib/queries/channel-detail';
import { fetchChannelHealthDetail } from '@/lib/queries/dashboard-channel-health';
import { redactChannelListItem, redactChannelDetail } from '../redact';

// Enum tái sử dụng nhiều tools — single source of truth.
const PLATFORM_ENUM = z.enum([
  'facebook',
  'tiktok',
  'youtube',
  'instagram',
  'threads',
  'zalo',
]);
const STATUS_ENUM = z.enum(['active', 'token_expired', 'disconnected']);
const DAYS_ENUM = z.enum(['7', '14', '30', '90']);

export function registerChannelTools(server: McpServer): void {
  // ─── channels_list ────────────────────────────────────────────────────
  server.registerTool(
    'channels_list',
    {
      title: 'List channels',
      description:
        'List social media channels with filters. Returns followers, health score, 7-day reach, 30-day ER, owner, 30-day leads.',
      inputSchema: {
        platform: PLATFORM_ENUM.optional().describe('Filter by platform'),
        status: STATUS_ENUM.optional().describe('Filter by status (default: hide disconnected)'),
        sort: z.enum(['name', 'health', 'followers']).optional().describe('Sort order, default: name'),
        limit: z.number().int().min(1).max(100).optional().describe('Max results, default 20'),
      },
    },
    async ({ platform, status, sort, limit }) => {
      const filter: ChannelsListFilter = {
        platform: platform ?? null,
        status: status ?? null,
        sort: sort ?? null,
      };
      const all = await fetchChannelsList(filter);
      const items = all.slice(0, limit ?? 20).map(redactChannelListItem);

      return {
        content: [
          {
            type: 'text',
            text: `Found ${items.length} channel(s)${all.length > items.length ? ` (of ${all.length} total)` : ''}.`,
          },
        ],
        structuredContent: { items, totalCount: all.length },
      };
    }
  );

  // ─── channels_get ─────────────────────────────────────────────────────
  server.registerTool(
    'channels_get',
    {
      title: 'Get channel detail',
      description:
        'Get full detail of one channel by UUID. Includes account info, latest followers/health, owner. PII fields are redacted.',
      inputSchema: {
        id: z.string().uuid().describe('Channel UUID'),
      },
    },
    async ({ id }) => {
      const channel = await fetchChannel(id);
      if (!channel) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Channel ${id} not found` }],
        };
      }
      const safe = redactChannelDetail(channel as unknown as Record<string, unknown>);
      return {
        content: [
          {
            type: 'text',
            text: `Channel "${channel.name}" (${channel.platform}, status=${channel.status}, followers=${channel.followers ?? '—'}, health=${channel.healthScore ?? '—'})`,
          },
        ],
        structuredContent: { channel: safe },
      };
    }
  );

  // ─── channels_health ──────────────────────────────────────────────────
  server.registerTool(
    'channels_health',
    {
      title: 'Channels health snapshot',
      description:
        'Get health scores with sub-scores (ER, consistency, growth, reach) and prior-week comparison. Optional accountId filter.',
      inputSchema: {
        accountId: z.string().uuid().optional().describe('Filter by channel UUID (omit for all)'),
      },
    },
    async ({ accountId }) => {
      const items = await fetchChannelHealthDetail(accountId);
      const dropped = items.filter((i) => i.priorHealthScore !== null && i.priorHealthScore - i.healthScore >= 10);

      return {
        content: [
          {
            type: 'text',
            text: `Found ${items.length} channel(s)${dropped.length > 0 ? `. ${dropped.length} dropped ≥10pts vs prior week.` : '.'}`,
          },
        ],
        structuredContent: { items },
      };
    }
  );

  // ─── channels_metrics ─────────────────────────────────────────────────
  server.registerTool(
    'channels_metrics',
    {
      title: 'Channel metrics trend (N days)',
      description:
        'Per-day metrics (followers/reach/engagement/posts) for one channel over N days (7/14/30/90). Excludes today.',
      inputSchema: {
        accountId: z.string().uuid().describe('Channel UUID'),
        days: DAYS_ENUM.optional().describe('Window in days: 7/14/30/90, default 7'),
      },
    },
    async ({ accountId, days }) => {
      const d = Number(days ?? '7');
      const items = await fetchMetricsRange(accountId, d);
      const totalReach = items.reduce((s, r) => s + (r.totalReach ?? 0), 0);

      return {
        content: [
          {
            type: 'text',
            text: `Channel ${accountId}: ${items.length} day(s), total reach ${totalReach.toLocaleString('vi-VN')}`,
          },
        ],
        structuredContent: { accountId, days: d, items },
      };
    }
  );
}
