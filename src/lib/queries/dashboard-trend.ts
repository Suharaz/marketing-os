import { db } from '@/lib/db';

// Daily trend over the last `days` days, EXCLUDING today.
// reach + followers: SUM across accounts from account_metric_daily.
// total_post: counted from social_post.published_at — page-insights cron sets
// account_metric_daily.posts_count to 0 so we can't trust it there.
// conversions: SUM(conversion_count) from landing_page_conversion grouped by occurred_date.
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
    -- Channel scope: every CTE INNER JOINs social_account and filters out
    -- status='disconnected'. Without this, kênh đã hủy kết nối vẫn được tính
    -- vào trend chart. Keeps 'active' + 'token_expired'.
    WITH metric_agg AS (
      SELECT amd.date,
             SUM(amd.total_reach)      AS reach,
             SUM(amd.total_engagement) AS engagement,
             SUM(amd.followers)        AS followers
      FROM account_metric_daily amd
      INNER JOIN social_account sa ON sa.id = amd.account_id
      WHERE amd.date >= CURRENT_DATE - $1::int AND amd.date < CURRENT_DATE
        AND sa.status != 'disconnected'
      GROUP BY amd.date
    ),
    post_agg AS (
      -- Group post by PT date — align với account_metric_daily.date (PT) và
      -- channel-detail.ts:fetchMetrics7d. Nếu để mặc định published_at::date
      -- cast theo container TZ (UTC) thì post sáng VN bị đếm vào ngày UTC kế
      -- tiếp, lệch 1 ngày so với chart channel detail.
      -- KNOWN ISSUE: conv_agg dưới đây dùng VN date (occurred_date là DATE
      -- không có time, không convert TZ được), nên ngày trên chart có thể
      -- vẫn chênh 1 đơn vị giữa conversions và reach/posts.
      SELECT (sp.published_at AT TIME ZONE 'America/Los_Angeles')::date AS date,
             COUNT(*) AS total_post
      FROM social_post sp
      INNER JOIN social_account sa ON sa.id = sp.account_id
      WHERE sp.published_at >= (CURRENT_DATE - $1::int)::timestamptz
        AND sp.published_at <  CURRENT_DATE::timestamptz
        AND sa.status != 'disconnected'
      GROUP BY (sp.published_at AT TIME ZONE 'America/Los_Angeles')::date
    ),
    conv_agg AS (
      SELECT lpc.occurred_date AS date,
             SUM(lpc.conversion_count) AS conversions
      FROM landing_page_conversion lpc
      INNER JOIN social_account sa ON sa.id = lpc.account_id
      WHERE lpc.occurred_date >= CURRENT_DATE - $1::int
        AND lpc.occurred_date <  CURRENT_DATE
        AND sa.status != 'disconnected'
      GROUP BY lpc.occurred_date
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
