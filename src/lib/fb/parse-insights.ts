// Maps FB page-level insights API response into AccountMetricDaily rows.
// Each FB insight item contains daily data points keyed by end_time.

import type { FBPageInsight } from './types';
import { ptDateKeyFromEndTime } from './pt-date';

export interface ParsedDayInsight {
  date: Date;
  followers: number;
  follower_growth: number;
  total_reach: number;
  total_reach_unique: number;
  total_engagement: number;
  total_actions: number;
  page_views: number;
  post_reactions_total: number;
}

interface DayAccumulator {
  followers: number;
  follower_growth: number;
  total_reach: number;
  total_reach_unique: number;
  total_engagement: number;
  total_actions: number;
  page_views: number;
  post_reactions_total: number;
}

/**
 * FB metric name → our column mapping.
 * Matches the 8 metrics requested in the merged /insights call.
 * `page_actions_post_reactions_total` returns an object keyed by reaction type
 * (love, wow, etc.) — we sum the values; see `coerceValue` below.
 */
const METRIC_MAP: Record<string, keyof DayAccumulator> = {
  page_follows: 'followers',
  page_daily_follows_unique: 'follower_growth',
  page_media_view: 'total_reach',
  page_total_media_view_unique: 'total_reach_unique',
  page_post_engagements: 'total_engagement',
  page_total_actions: 'total_actions',
  page_views_total: 'page_views',
  page_actions_post_reactions_total: 'post_reactions_total',
};

/** Some metrics return scalars, others return objects (e.g. reaction breakdown).
 *  Sum object values so the column always stores a single integer. */
function coerceValue(v: unknown): number {
  if (typeof v === 'number') return v;
  if (v !== null && typeof v === 'object') {
    return Object.values(v as Record<string, unknown>).reduce<number>(
      (s, n) => s + (typeof n === 'number' ? n : 0),
      0
    );
  }
  return 0;
}

/**
 * Parse an array of FBPageInsight items (as returned by /page/insights)
 * into a map of date-string → ParsedDayInsight.
 *
 * FB returns each metric as a separate object with an array of daily values.
 * This function pivots them into per-day rows.
 */
export function parseInsights(insights: FBPageInsight[]): ParsedDayInsight[] {
  // date string (YYYY-MM-DD) → accumulator
  const byDate = new Map<string, DayAccumulator>();

  function ensureDay(endTime: string): DayAccumulator {
    // FB Insights period=day reports in Pacific Time. end_time is PT-midnight
    // marking the END of the report day, expressed in UTC (e.g. "07:00:00+0000"
    // during PDT). substring(0,10) on the UTC string would label data 1 day
    // ahead — must convert to PT calendar date instead.
    const dateKey = ptDateKeyFromEndTime(endTime);
    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, {
        followers: 0,
        follower_growth: 0,
        total_reach: 0,
        total_reach_unique: 0,
        total_engagement: 0,
        total_actions: 0,
        page_views: 0,
        post_reactions_total: 0,
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return byDate.get(dateKey)!;
  }

  for (const insight of insights) {
    const column = METRIC_MAP[insight.name];
    if (!column) continue; // unknown metric — ignore

    for (const point of insight.values) {
      if (!point.end_time) continue;
      const day = ensureDay(point.end_time);
      day[column] = coerceValue(point.value);
    }
  }

  const results: ParsedDayInsight[] = [];
  for (const [dateKey, acc] of byDate.entries()) {
    results.push({
      date: new Date(`${dateKey}T00:00:00.000Z`),
      ...acc,
    });
  }

  // Sort ascending by date
  results.sort((a, b) => a.date.getTime() - b.date.getTime());

  return results;
}
