import { db } from '@/lib/db';

// All KPIs over the last `days` days, EXCLUDING today (today is still syncing).
// Previous-period delta compares against the prior `days`-day window of equal length.
//
// Window math:
//   current  = [CURRENT_DATE - days,    CURRENT_DATE)        ← exclusive of today
//   previous = [CURRENT_DATE - 2*days,  CURRENT_DATE - days) ← prior equal window
export interface KpiData {
  reach: number;
  reachPrev: number;
  avgEr: number;
  avgErPrev: number;
  conversions: number;
  conversionsPrev: number;
  totalFollowers: number;
  totalFollowersPrev: number;
}

export async function fetchKpiData(days: number): Promise<KpiData> {
  const [reachRes, erRes, convRes, followersRes] = await Promise.all([
    db.query<{ reach: string; reach_prev: string }>(
      `
      SELECT
        COALESCE(SUM(total_reach) FILTER (
          WHERE date >= CURRENT_DATE - $1::int AND date < CURRENT_DATE
        ), 0) AS reach,
        COALESCE(SUM(total_reach) FILTER (
          WHERE date >= CURRENT_DATE - ($1::int * 2) AND date < CURRENT_DATE - $1::int
        ), 0) AS reach_prev
      FROM account_metric_daily
    `,
      [days]
    ),
    db.query<{ avg_er: string; avg_er_prev: string }>(
      `
      SELECT
        COALESCE(AVG(engagement_rate) FILTER (
          WHERE date >= CURRENT_DATE - $1::int AND date < CURRENT_DATE
        ), 0) AS avg_er,
        COALESCE(AVG(engagement_rate) FILTER (
          WHERE date >= CURRENT_DATE - ($1::int * 2) AND date < CURRENT_DATE - $1::int
        ), 0) AS avg_er_prev
      FROM post_metric_daily
    `,
      [days]
    ),
    // Conversions = SUM(conversion_count) from manual_conversion in window.
    db.query<{ conv: string; conv_prev: string }>(
      `
      SELECT
        COALESCE(SUM(conversion_count) FILTER (
          WHERE occurred_at >= CURRENT_DATE - $1::int AND occurred_at < CURRENT_DATE
        ), 0) AS conv,
        COALESCE(SUM(conversion_count) FILTER (
          WHERE occurred_at >= CURRENT_DATE - ($1::int * 2) AND occurred_at < CURRENT_DATE - $1::int
        ), 0) AS conv_prev
      FROM manual_conversion
    `,
      [days]
    ),
    // Followers — current = latest snapshot per account.
    // Previous = latest snapshot per account on/before (CURRENT_DATE - days).
    // Delta tells us net follower growth across the window.
    db.query<{ total_followers: string; total_followers_prev: string }>(
      `
      WITH latest_now AS (
        SELECT DISTINCT ON (account_id) account_id, followers
        FROM account_metric_daily
        WHERE date < CURRENT_DATE
        ORDER BY account_id, date DESC
      ),
      latest_prev AS (
        SELECT DISTINCT ON (account_id) account_id, followers
        FROM account_metric_daily
        WHERE date < CURRENT_DATE - $1::int
        ORDER BY account_id, date DESC
      )
      SELECT
        COALESCE((SELECT SUM(followers) FROM latest_now), 0)  AS total_followers,
        COALESCE((SELECT SUM(followers) FROM latest_prev), 0) AS total_followers_prev
    `,
      [days]
    ),
  ]);

  const reachRow = reachRes.rows[0];
  const erRow = erRes.rows[0];
  const convRow = convRes.rows[0];
  const followersRow = followersRes.rows[0];

  return {
    reach: Number(reachRow?.reach ?? 0),
    reachPrev: Number(reachRow?.reach_prev ?? 0),
    avgEr: Number(erRow?.avg_er ?? 0),
    avgErPrev: Number(erRow?.avg_er_prev ?? 0),
    conversions: Number(convRow?.conv ?? 0),
    conversionsPrev: Number(convRow?.conv_prev ?? 0),
    totalFollowers: Number(followersRow?.total_followers ?? 0),
    totalFollowersPrev: Number(followersRow?.total_followers_prev ?? 0),
  };
}
