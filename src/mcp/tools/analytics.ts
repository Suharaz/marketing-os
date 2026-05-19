// Analytics domain MCP tools: analytics_kpi, analytics_trend, analytics_top_performers.
// 100% reuse query layer hiện có (fetchKpiData, fetchTrendData, fetchTopPerformers).

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchKpiData } from '@/lib/queries/dashboard-kpi';
import { fetchTrendData } from '@/lib/queries/dashboard-trend';
import { fetchTopPerformers } from '@/lib/queries/dashboard-top-performers';

const DAYS_ENUM = z.enum(['7', '14', '30', '90']);

export function registerAnalyticsTools(server: McpServer): void {
  // ─── analytics_kpi ────────────────────────────────────────────────────
  server.registerTool(
    'analytics_kpi',
    {
      title: 'Global KPI snapshot',
      description:
        'Global KPI (reach, avg ER, conversions, revenue, total followers) over N days vs prior N days. Excludes disconnected channels.',
      inputSchema: {
        days: DAYS_ENUM.optional().describe('Window in days: 7/14/30/90, default 7'),
      },
    },
    async ({ days }) => {
      const d = Number(days ?? '7');
      const kpi = await fetchKpiData(d);
      const reachDelta = kpi.reachPrev > 0 ? ((kpi.reach - kpi.reachPrev) / kpi.reachPrev) * 100 : null;

      return {
        content: [
          {
            type: 'text',
            text: `KPI (${d}d): reach ${kpi.reach.toLocaleString('vi-VN')}${reachDelta !== null ? ` (${reachDelta >= 0 ? '+' : ''}${reachDelta.toFixed(1)}% vs prev)` : ''}, conv ${kpi.conversions}, revenue ${kpi.revenue.toLocaleString('vi-VN')} VND, followers ${kpi.totalFollowers.toLocaleString('vi-VN')}`,
          },
        ],
        structuredContent: { days: d, kpi },
      };
    }
  );

  // ─── analytics_trend ──────────────────────────────────────────────────
  server.registerTool(
    'analytics_trend',
    {
      title: 'Cross-channel daily trend',
      description:
        'Daily aggregated trend over N days (reach, engagement, followers, total posts, conversions). Excludes today + disconnected channels.',
      inputSchema: {
        days: z.number().int().min(7).max(90).optional().describe('Window 7-90 days, default 30'),
      },
    },
    async ({ days }) => {
      const d = days ?? 30;
      const items = await fetchTrendData(d);
      const totalReach = items.reduce((s, r) => s + r.reach, 0);

      return {
        content: [
          {
            type: 'text',
            text: `Trend ${d}d: ${items.length} data point(s), total reach ${totalReach.toLocaleString('vi-VN')}.`,
          },
        ],
        structuredContent: { days: d, items, totalDays: items.length },
      };
    }
  );

  // ─── analytics_top_performers ─────────────────────────────────────────
  server.registerTool(
    'analytics_top_performers',
    {
      title: 'Top team members by engagement',
      description:
        'Top N team members ranked by total engagement (reactions + comments + shares) of posts on their channels over N days.',
      inputSchema: {
        days: z.number().int().min(7).max(90).optional().describe('Window 7-90 days, default 30'),
        limit: z.number().int().min(1).max(20).optional().describe('Max members, default 5'),
      },
    },
    async ({ days, limit }) => {
      const d = days ?? 30;
      const n = limit ?? 5;
      const items = await fetchTopPerformers(d, n);

      return {
        content: [
          {
            type: 'text',
            text: `Top ${items.length} performer(s) over ${d}d.${items.length > 0 && items[0] ? ` Leader: ${items[0].name} (${items[0].posts} posts).` : ''}`,
          },
        ],
        structuredContent: { days: d, items },
      };
    }
  );
}
