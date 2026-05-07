import { db } from '@/lib/db';

// Daily trend over the last `days` days, EXCLUDING today.
// reach + followers: SUM across accounts from account_metric_daily.
// total_post: counted from social_post.published_at — page-insights cron sets
// account_metric_daily.posts_count to 0 so we can't trust it there.
// conversions: SUM(conversion_count) from manual_conversion grouped by occurred_at::date.
export interface TrendDataPoint {
  date: string;
  reach: number;
  engagement: number;
  followers: number;
  totalPost: number;
  conversions: number;
}

export async function fetchTrendData(days: number): Promise<TrendDataPoint[]> {
  const res = await db.query<{
    date: string;
    reach: string;
    engagement: string;
    followers: string;
    total_post: string;
    conversions: string;
  }>(
    `
    WITH metric_agg AS (
      SELECT date,
             SUM(total_reach)      AS reach,
             SUM(total_engagement) AS engagement,
             SUM(followers)        AS followers
      FROM account_metric_daily
      WHERE date >= CURRENT_DATE - $1::int AND date < CURRENT_DATE
      GROUP BY date
    ),
    post_agg AS (
      SELECT published_at::date AS date,
             COUNT(*) AS total_post
      FROM social_post
      WHERE published_at >= (CURRENT_DATE - $1::int)::timestamptz
        AND published_at <  CURRENT_DATE::timestamptz
      GROUP BY published_at::date
    ),
    conv_agg AS (
      SELECT occurred_at::date AS date,
             SUM(conversion_count) AS conversions
      FROM manual_conversion
      WHERE occurred_at >= (CURRENT_DATE - $1::int)::timestamptz
        AND occurred_at <  CURRENT_DATE::timestamptz
      GROUP BY occurred_at::date
    )
    -- FULL OUTER JOIN across all 3 sources so a date that appears in any
    -- source still produces a row (with 0 for missing series).
    SELECT
      COALESCE(m.date, p.date, c.date)::text AS date,
      COALESCE(m.reach, 0)        AS reach,
      COALESCE(m.engagement, 0)   AS engagement,
      COALESCE(m.followers, 0)    AS followers,
      COALESCE(p.total_post, 0)   AS total_post,
      COALESCE(c.conversions, 0)  AS conversions
    FROM metric_agg m
    FULL OUTER JOIN post_agg p ON p.date = m.date
    FULL OUTER JOIN conv_agg c ON c.date = COALESCE(m.date, p.date)
    ORDER BY date ASC
  `,
    [days]
  );

  return res.rows.map((row) => ({
    date: row.date,
    reach: Number(row.reach),
    engagement: Number(row.engagement),
    followers: Number(row.followers),
    totalPost: Number(row.total_post),
    conversions: Number(row.conversions),
  }));
}
