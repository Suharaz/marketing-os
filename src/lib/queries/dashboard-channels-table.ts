import { db } from '@/lib/db';

// Channels table cho dashboard — 1 row / channel với:
//   - reach: SUM(total_reach) trong N ngày
//   - engagement rate: SUM(engagement) / SUM(reach) * 100
//   - posts/kpi: COUNT(social_post) / (kpi_per_day * N)
//   - growth: % thay đổi followers so với điểm đầu range
//
// Filter status != 'disconnected' giống ChannelHealth widget. Sort theo reach DESC
// để channel "khỏe" nhất lên đầu — UX nhất quán với health widget.

export interface ChannelTableRow {
  accountId: string;
  name: string;
  platform: string;
  reach: number;
  engagementRate: number;
  postsCount: number;
  kpiTotal: number;
  /** Tăng trưởng followers % trong range. null nếu thiếu data đầu range. */
  growthPercent: number | null;
}

export async function fetchChannelsTable(days: number): Promise<ChannelTableRow[]> {
  const res = await db.query<{
    account_id: string;
    name: string;
    platform: string;
    kpi_posts_per_day: number;
    reach: string | null;
    engagement: string | null;
    posts_count: string;
    follower_start: string | null;
    follower_end: string | null;
  }>(
    `
    SELECT
      sa.id              AS account_id,
      sa.name,
      sa.platform,
      sa.kpi_posts_per_day,
      agg.reach,
      agg.engagement,
      COALESCE(p.posts_count, 0)::TEXT AS posts_count,
      f_start.followers  AS follower_start,
      f_end.followers    AS follower_end
    FROM social_account sa
    -- Reach + engagement summed across range from account_metric_daily (cheaper than join post_metric_daily)
    LEFT JOIN LATERAL (
      SELECT
        SUM(total_reach)::TEXT      AS reach,
        SUM(total_engagement)::TEXT AS engagement
      FROM account_metric_daily
      WHERE account_id = sa.id
        AND date >= CURRENT_DATE - $1::INT
        AND date < CURRENT_DATE
    ) agg ON TRUE
    -- Posts count from social_post (published_at falls in range)
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS posts_count
      FROM social_post
      WHERE account_id = sa.id
        AND published_at >= CURRENT_DATE - $1::INT
        AND published_at < CURRENT_DATE
    ) p ON TRUE
    -- Followers ở đầu range — fallback latest if no exact match
    LEFT JOIN LATERAL (
      SELECT followers FROM account_metric_daily
      WHERE account_id = sa.id AND date <= CURRENT_DATE - $1::INT
      ORDER BY date DESC LIMIT 1
    ) f_start ON TRUE
    -- Followers gần nhất trong range
    LEFT JOIN LATERAL (
      SELECT followers FROM account_metric_daily
      WHERE account_id = sa.id AND date < CURRENT_DATE
      ORDER BY date DESC LIMIT 1
    ) f_end ON TRUE
    WHERE sa.status != 'disconnected'
    ORDER BY COALESCE(agg.reach::NUMERIC, 0) DESC, sa.name ASC
    `,
    [days]
  );

  return res.rows.map((row) => {
    const reach = row.reach !== null ? Number(row.reach) : 0;
    const engagement = row.engagement !== null ? Number(row.engagement) : 0;
    const postsCount = Number(row.posts_count);
    const kpiPerDay = Number(row.kpi_posts_per_day);
    const followerStart = row.follower_start !== null ? Number(row.follower_start) : null;
    const followerEnd = row.follower_end !== null ? Number(row.follower_end) : null;

    let growthPercent: number | null = null;
    if (followerStart !== null && followerStart > 0 && followerEnd !== null) {
      growthPercent = ((followerEnd - followerStart) / followerStart) * 100;
    }

    return {
      accountId: row.account_id,
      name: row.name,
      platform: row.platform,
      reach,
      engagementRate: reach > 0 ? (engagement / reach) * 100 : 0,
      postsCount,
      kpiTotal: kpiPerDay * days,
      growthPercent,
    };
  });
}
