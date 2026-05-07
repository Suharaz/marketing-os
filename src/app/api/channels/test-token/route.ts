// POST /api/channels/test-token
// Read-only probe: validate token + show preview of rows that would be UPSERTed to DB
// (account_metric_daily, social_post, post_metric_daily) — same shape as cron output.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/get-session';

export const runtime = 'nodejs';

const FB_VERSION = 'v21.0';

const bodySchema = z.object({
  pageId: z.string().min(1),
  pageToken: z.string().min(1),
});

interface DebugData {
  is_valid?: boolean;
  expires_at?: number;
  scopes?: string[];
  type?: string;
  error?: { message?: string; code?: number };
}

interface PageInfo {
  id?: string;
  name?: string;
  fan_count?: number;
  followers_count?: number;
  category?: string;
  error?: { message?: string; code?: number };
}

interface InsightValue {
  value: number | Record<string, number>;
  end_time: string;
}

interface InsightItem {
  name: string;
  values: InsightValue[];
}

interface InsightsResp {
  data?: InsightItem[];
  error?: { message?: string; code?: number };
}

interface FBPostAttachmentItem {
  media_type?: string;
  url?: string;
}
interface FBPost {
  id: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  attachments?: { data?: FBPostAttachmentItem[] };
  insights?: { data?: InsightItem[] };
}
interface PostsResp {
  data?: FBPost[];
  error?: { message?: string; code?: number };
}

/** Page-level metrics → account_metric_daily columns. Test multiple candidates. */
const PAGE_METRICS = [
  'page_follows',
  'page_daily_follows',
  'page_daily_follows_unique',
  'page_media_view',
  'page_total_media_view_unique',
  'page_post_engagements',
];

/** Post-level metric candidates (probe individually on first post). */
const POST_METRICS = [
  'post_impressions',
  'post_impressions_unique',
  'post_impressions_organic',
  'post_clicks',
  'post_video_views',
  'post_reactions_by_type_total',
  'post_media_view',
  'post_total_media_view_unique',
  'post_activity_by_action_type',
];

/** Sum a metric's values over the response window. */
function sumValues(item: InsightItem | undefined): number {
  if (!item) return 0;
  return item.values.reduce((s, v) => s + (typeof v.value === 'number' ? v.value : 0), 0);
}

/** Pivot insights array → daily rows keyed by date. */
function pivotToDaily(items: InsightItem[]): Map<string, Record<string, number>> {
  const byDate = new Map<string, Record<string, number>>();
  for (const item of items) {
    for (const v of item.values) {
      if (!v.end_time) continue;
      const date = v.end_time.substring(0, 10);
      if (!byDate.has(date)) byDate.set(date, {});
      const row = byDate.get(date)!;
      row[item.name] = typeof v.value === 'number' ? v.value : 0;
    }
  }
  return byDate;
}

function inferPostType(p: FBPost): 'photo' | 'video' | 'reel' | 'status' | 'link' {
  const att = p.attachments?.data?.[0];
  if (att?.media_type === 'video') return 'video';
  if (p.permalink_url?.includes('reel')) return 'reel';
  if (att?.media_type === 'photo') return 'photo';
  if (att?.url) return 'link';
  return 'status';
}

function sumReactions(item: InsightItem | undefined): number {
  if (!item) return 0;
  const v = item.values[0]?.value;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v) {
    return Object.values(v).reduce((s, n) => s + (typeof n === 'number' ? n : 0), 0);
  }
  return 0;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }
  const { pageId, pageToken } = parsed.data;

  try {
    const since = Math.floor((Date.now() - 7 * 86_400_000) / 1000);
    const today = new Date().toISOString().slice(0, 10);
    const base = `https://graph.facebook.com/${FB_VERSION}`;
    const t = encodeURIComponent(pageToken);
    const id = encodeURIComponent(pageId);

    // Each page metric called individually so 1 dead metric doesn't kill batch
    const metricCalls = PAGE_METRICS.map((m) =>
      fetch(`${base}/${id}/insights?metric=${m}&period=day&since=${since}&access_token=${t}`, {
        signal: AbortSignal.timeout(15_000),
      }).then((r) => r.json().catch(() => ({})))
    );

    const [debugRes, pageRes, postsRes, ...metricResults] = await Promise.all([
      fetch(`${base}/debug_token?input_token=${t}&access_token=${t}`, {
        signal: AbortSignal.timeout(15_000),
      }),
      fetch(
        `${base}/${id}?fields=id,name,fan_count,followers_count,category&access_token=${t}`,
        { signal: AbortSignal.timeout(15_000) }
      ),
      // Posts metadata WITHOUT insights expansion — never fail from bad metric
      fetch(
        `${base}/${id}/posts?limit=5&fields=id,message,created_time,permalink_url,attachments&access_token=${t}`,
        { signal: AbortSignal.timeout(15_000) }
      ),
      ...metricCalls,
    ]);

    const debugBody = (await debugRes.json().catch(() => ({}))) as { data?: DebugData };
    const pageBody = (await pageRes.json().catch(() => ({}))) as PageInfo;
    const postsBody = (await postsRes.json().catch(() => ({}))) as PostsResp;
    const debug = debugBody.data ?? {};

    if (debug.error?.message || debug.is_valid === false) {
      return NextResponse.json({
        valid: false,
        error: debug.error?.message || 'Token không hợp lệ',
      });
    }
    if (pageBody.error?.message || !pageBody.id) {
      return NextResponse.json({
        valid: false,
        error: pageBody.error?.message || 'Không truy cập được page',
      });
    }
    if (pageBody.id !== pageId) {
      return NextResponse.json({
        valid: false,
        error: `Page ID không khớp (token thuộc page ${pageBody.id})`,
      });
    }

    // Per-metric status (for diagnostics — show user which metrics work)
    const metricStatus = PAGE_METRICS.map((m, i) => {
      const r = metricResults[i] as InsightsResp;
      return {
        metric: m,
        ok: !r?.error?.message && (r?.data?.length ?? 0) > 0,
        error: r?.error?.message ?? null,
      };
    });

    // Build account_metric_daily preview rows
    const allItems: InsightItem[] = [];
    metricResults.forEach((r) => {
      const body = r as InsightsResp;
      if (body.data) allItems.push(...body.data);
    });
    const dailyMap = pivotToDaily(allItems);

    const followersFallback = pageBody.followers_count ?? pageBody.fan_count ?? null;
    const accountMetricDailyPreview = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, row]) => ({
        date,
        // page_follows is daily count (treated as snapshot ~= followers)
        followers:
          row.page_follows ??
          row.page_daily_follows_unique ??
          followersFallback ??
          null,
        follower_growth: row.page_daily_follows ?? row.page_daily_follows_unique ?? 0,
        total_reach: row.page_media_view ?? row.page_total_media_view_unique ?? 0,
        total_engagement: row.page_post_engagements ?? 0,
      }));

    // Build social_post preview from metadata (no insights dependency)
    const socialPostPreview = (postsBody.data ?? []).map((p) => {
      const att = p.attachments?.data?.[0];
      return {
        external_id: p.id,
        content: p.message ? p.message.slice(0, 80) : null,
        media_url: att?.url ?? null,
        post_type: inferPostType(p),
        published_at: p.created_time ?? null,
        permalink: p.permalink_url ?? null,
      };
    });

    // Probe each post-level metric on first post to find which work
    const firstPostId = postsBody.data?.[0]?.id;
    let postMetricStatus: Array<{ metric: string; ok: boolean; error: string | null; value: number }> = [];
    let postMetricDailyPreview: Array<{
      external_id: string;
      date: string;
      reactions: number;
      comments: number;
      shares: number;
      reach: number;
      impressions: number;
      clicks: number;
      video_views: number;
    }> = [];

    if (firstPostId) {
      const fid = encodeURIComponent(firstPostId);
      const postProbeResults = await Promise.all(
        POST_METRICS.map((m) =>
          fetch(`${base}/${fid}/insights?metric=${m}&access_token=${t}`, {
            signal: AbortSignal.timeout(15_000),
          }).then((r) => r.json().catch(() => ({})))
        )
      );

      postMetricStatus = POST_METRICS.map((m, i) => {
        const r = postProbeResults[i] as InsightsResp;
        const item = r?.data?.[0];
        const value =
          item && typeof item.values[0]?.value === 'number'
            ? (item.values[0].value as number)
            : item && typeof item.values[0]?.value === 'object'
            ? Object.values(item.values[0].value as Record<string, number>).reduce(
                (s, n) => s + (typeof n === 'number' ? n : 0),
                0
              )
            : 0;
        return {
          metric: m,
          ok: !r?.error?.message && !!item,
          error: r?.error?.message ?? null,
          value,
        };
      });

      // Build post_metric_daily preview using working metrics
      // For each post in the list, fetch insights with only working metrics
      const workingMetrics = postMetricStatus.filter((p) => p.ok).map((p) => p.metric);
      if (workingMetrics.length > 0) {
        const expansion = workingMetrics.join(',');
        const enrichedRes = await fetch(
          `${base}/${id}/posts?limit=5&fields=id,insights.metric(${expansion})&access_token=${t}`,
          { signal: AbortSignal.timeout(15_000) }
        );
        const enrichedBody = (await enrichedRes.json().catch(() => ({}))) as PostsResp;

        postMetricDailyPreview = (enrichedBody.data ?? []).map((p) => {
          const insightsData = p.insights?.data ?? [];
          const find = (n: string) => insightsData.find((i) => i.name === n);
          return {
            external_id: p.id,
            date: today,
            reactions: sumReactions(find('post_reactions_by_type_total')),
            comments: 0, // separate call (?fields=comments.summary(true)) — not implemented
            shares: 0,
            reach: sumValues(find('post_impressions_unique')) || sumValues(find('post_total_media_view_unique')),
            impressions: sumValues(find('post_impressions')) || sumValues(find('post_media_view')),
            clicks: sumValues(find('post_clicks')),
            video_views: sumValues(find('post_video_views')),
          };
        });
      }
    }

    return NextResponse.json({
      valid: true,
      page: {
        id: pageBody.id,
        name: pageBody.name,
        fanCount: pageBody.fan_count ?? pageBody.followers_count ?? null,
        category: pageBody.category ?? null,
      },
      token: {
        type: debug.type ?? 'PAGE',
        expiresAt: debug.expires_at ?? 0,
        scopes: debug.scopes ?? [],
      },
      diagnostics: {
        metricStatus,
        postMetricStatus,
        postsError: postsBody.error?.message ?? null,
      },
      preview: {
        account_metric_daily: accountMetricDailyPreview,
        social_post: socialPostPreview,
        post_metric_daily: postMetricDailyPreview,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return NextResponse.json({ valid: false, error: message }, { status: 500 });
  }
}
