import { db } from '@/lib/db';

// Raw aggregate row per team member — output of one CTE roundtrip.
// Caller (team-kpi.ts) maps these into TeamMemberKpi shape.
export interface MemberAggregateRow {
  // Identity
  member_id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;

  // Last 7 days post window
  posts_7d: number;
  reach_7d: number;
  avg_reach_7d: number;
  avg_er_7d: number;       // 0..1, AVG of GENERATED engagement_rate

  // Last 30 days post window — used for normalization + role variant
  posts_30d: number;
  reach_30d: number;
  avg_reach_30d: number;
  median_reach_30d: number | null;
  reel_video_share_30d: number;     // 0..1
  top_platform_30d: string | null;
  viral_hits_30d: number;

  // Brief activity last 30 days
  briefs_created_30d: number;
  briefs_published_30d: number;
  brief_actions_30d: number;
  brief_status_changes_30d: number;

  // Top 3 active account names — used as tags
  account_names: string[];
}

// Why one big CTE: a single roundtrip is cheaper than 5 sequential queries
// and keeps "viral baseline" derivation (median × 3) consistent within one snapshot.
const TEAM_KPI_SQL = `
WITH windows AS (
  SELECT NOW() - INTERVAL '7 days'  AS w7,
         NOW() - INTERVAL '30 days' AS w30
),

-- post_metric_daily is keyed (post_id, date) — multiple snapshots per post.
-- DISTINCT ON keeps only the latest row, the canonical "latest per group" PG idiom.
latest_metric AS (
  SELECT DISTINCT ON (post_id)
    post_id, reach, engagement_rate
  FROM post_metric_daily
  ORDER BY post_id, date DESC
),

member_posts AS (
  SELECT
    sa.owner_member_id                      AS member_id,
    sa.platform::TEXT                       AS platform,
    sp.post_type::TEXT                      AS post_type,
    sp.published_at,
    COALESCE(lm.reach, 0)::INT              AS reach,
    COALESCE(lm.engagement_rate, 0)::FLOAT  AS engagement_rate
  FROM social_account sa
  JOIN social_post   sp  ON sp.account_id = sa.id
  LEFT JOIN latest_metric lm ON lm.post_id = sp.id
  WHERE sa.owner_member_id IS NOT NULL
),

agg_30d AS (
  SELECT
    mp.member_id,
    COUNT(*)::INT                           AS posts_30d,
    COALESCE(SUM(mp.reach), 0)::INT         AS reach_30d,
    COALESCE(AVG(mp.reach), 0)::FLOAT       AS avg_reach_30d,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY mp.reach) AS median_reach_30d,
    AVG(
      (mp.platform IN ('facebook','instagram')
        AND mp.post_type IN ('reel','video'))::INT
    )::FLOAT AS reel_video_share_30d,
    MODE() WITHIN GROUP (ORDER BY mp.platform) AS top_platform_30d
  FROM member_posts mp, windows w
  WHERE mp.published_at >= w.w30
  GROUP BY mp.member_id
),

-- Viral count needs the median computed in agg_30d, hence a 2nd pass.
viral_30d AS (
  SELECT
    mp.member_id,
    COUNT(*)::INT AS viral_hits_30d
  FROM member_posts mp
  JOIN agg_30d a USING (member_id), windows w
  WHERE mp.published_at >= w.w30
    AND a.median_reach_30d IS NOT NULL
    AND a.median_reach_30d > 0
    AND mp.reach > 3 * a.median_reach_30d
  GROUP BY mp.member_id
),

agg_7d AS (
  SELECT
    mp.member_id,
    COUNT(*)::INT                                AS posts_7d,
    COALESCE(SUM(mp.reach), 0)::INT              AS reach_7d,
    COALESCE(AVG(mp.reach), 0)::FLOAT            AS avg_reach_7d,
    COALESCE(AVG(mp.engagement_rate), 0)::FLOAT  AS avg_er_7d
  FROM member_posts mp, windows w
  WHERE mp.published_at >= w.w7
  GROUP BY mp.member_id
),

brief_30d AS (
  SELECT
    b.created_by_member_id AS member_id,
    COUNT(*)::INT                                       AS briefs_created_30d,
    COUNT(*) FILTER (WHERE b.status = 'published')::INT AS briefs_published_30d
  FROM briefs b, windows w
  WHERE b.created_by_member_id IS NOT NULL
    AND b.created_at >= w.w30
  GROUP BY b.created_by_member_id
),

brief_activity_30d AS (
  SELECT
    ba.actor_member_id AS member_id,
    COUNT(*)::INT                                              AS brief_actions_30d,
    COUNT(*) FILTER (WHERE ba.action = 'status_changed')::INT  AS brief_status_changes_30d
  FROM brief_activity ba, windows w
  WHERE ba.created_at >= w.w30
    AND ba.actor_member_id IS NOT NULL
  GROUP BY ba.actor_member_id
),

-- Tag pool: alphabetically-sorted active account names per member.
account_tags AS (
  SELECT
    sa.owner_member_id AS member_id,
    array_agg(sa.name ORDER BY sa.name) FILTER (WHERE sa.status = 'active') AS names
  FROM social_account sa
  WHERE sa.owner_member_id IS NOT NULL
  GROUP BY sa.owner_member_id
)

SELECT
  tm.id AS member_id,
  tm.name, tm.email, tm.role,
  tm.created_at::TEXT AS created_at,
  COALESCE(a7.posts_7d, 0) AS posts_7d,
  COALESCE(a7.reach_7d, 0) AS reach_7d,
  COALESCE(a7.avg_reach_7d, 0) AS avg_reach_7d,
  COALESCE(a7.avg_er_7d, 0) AS avg_er_7d,
  COALESCE(a30.posts_30d, 0) AS posts_30d,
  COALESCE(a30.reach_30d, 0) AS reach_30d,
  COALESCE(a30.avg_reach_30d, 0) AS avg_reach_30d,
  a30.median_reach_30d::FLOAT AS median_reach_30d,
  COALESCE(a30.reel_video_share_30d, 0) AS reel_video_share_30d,
  a30.top_platform_30d,
  COALESCE(v30.viral_hits_30d, 0) AS viral_hits_30d,
  COALESCE(b30.briefs_created_30d, 0) AS briefs_created_30d,
  COALESCE(b30.briefs_published_30d, 0) AS briefs_published_30d,
  COALESCE(ba30.brief_actions_30d, 0) AS brief_actions_30d,
  COALESCE(ba30.brief_status_changes_30d, 0) AS brief_status_changes_30d,
  COALESCE(at.names[1:3], ARRAY[]::TEXT[]) AS account_names

FROM team_member tm
LEFT JOIN agg_7d  a7   ON a7.member_id   = tm.id
LEFT JOIN agg_30d a30  ON a30.member_id  = tm.id
LEFT JOIN viral_30d v30 ON v30.member_id = tm.id
LEFT JOIN brief_30d b30 ON b30.member_id = tm.id
LEFT JOIN brief_activity_30d ba30 ON ba30.member_id = tm.id
LEFT JOIN account_tags at ON at.member_id = tm.id
ORDER BY tm.created_at ASC;
`;

// pg returns NUMERIC columns as strings — coerce defensively even though
// SQL ::INT/::FLOAT casts cover most cases.
export async function fetchMemberAggregates(): Promise<MemberAggregateRow[]> {
  const res = await db.query<MemberAggregateRow>(TEAM_KPI_SQL);

  return res.rows.map((row) => ({
    ...row,
    posts_7d: Number(row.posts_7d),
    reach_7d: Number(row.reach_7d),
    avg_reach_7d: Number(row.avg_reach_7d),
    avg_er_7d: Number(row.avg_er_7d),
    posts_30d: Number(row.posts_30d),
    reach_30d: Number(row.reach_30d),
    avg_reach_30d: Number(row.avg_reach_30d),
    median_reach_30d: row.median_reach_30d == null ? null : Number(row.median_reach_30d),
    reel_video_share_30d: Number(row.reel_video_share_30d),
    viral_hits_30d: Number(row.viral_hits_30d),
    briefs_created_30d: Number(row.briefs_created_30d),
    briefs_published_30d: Number(row.briefs_published_30d),
    brief_actions_30d: Number(row.brief_actions_30d),
    brief_status_changes_30d: Number(row.brief_status_changes_30d),
    account_names: row.account_names ?? [],
  }));
}
