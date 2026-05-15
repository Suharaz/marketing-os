import { db } from '@/lib/db';

// Hàng hiển thị trên widget Top Performers ở dashboard.
// Score 0–100 chuẩn hóa theo top performer trong cùng kỳ:
//   score = round(member_engagement / max_engagement_in_team * 100, 1)
// → top luôn = 100, người khác scale theo. Không cần tập huấn lịch sử.
export interface TopPerformerRow {
  id: string;
  rank: number;
  name: string;
  posts: number;   // số bài đăng trong window (exclude today)
  score: number;   // 0–100 normalized
}

interface DbRow {
  id: string;
  name: string;
  posts_count: string; // pg trả COUNT() dạng bigint → string
  engagement: string;  // pg trả SUM() dạng numeric → string
  score: string;       // ROUND(...) NUMERIC → string
}

// Top N member theo engagement trong `days` ngày qua, EXCLUDING today.
// Window math:
//   [CURRENT_DATE - days, CURRENT_DATE)  ← exclusive of today, đồng bộ với fetchKpiData
//
// JOIN logic:
//   team_member ⨝ social_account  (qua owner_member_id) — INNER → loại admin không quản kênh
//   social_account ⨝ social_post  — INNER + filter window → loại member không đăng bài
//   social_post ⟕ post_metric_daily — LEFT vì post mới đăng có thể chưa có metric
//
// Score normalize qua window function MAX() OVER () — 1 query duy nhất, no second pass.
export async function fetchTopPerformers(
  days: number,
  limit = 5
): Promise<TopPerformerRow[]> {
  const res = await db.query<DbRow>(
    `
    WITH member_stats AS (
      SELECT
        tm.id,
        tm.name,
        COUNT(DISTINCT sp.id) AS posts_count,
        COALESCE(SUM(pmd.reactions + pmd.comments + pmd.shares), 0) AS engagement
      FROM team_member tm
      -- Filter sa.status != 'disconnected' để member chỉ tính điểm trên kênh
      -- còn hoạt động. Kênh disconnected thì coi như không có data hôm nay.
      INNER JOIN social_account sa ON sa.owner_member_id = tm.id
        AND sa.status != 'disconnected'
      INNER JOIN social_post sp ON sp.account_id = sa.id
        AND sp.published_at >= CURRENT_DATE - $1::int
        AND sp.published_at < CURRENT_DATE
      LEFT JOIN post_metric_daily pmd ON pmd.post_id = sp.id
        AND pmd.date >= CURRENT_DATE - $1::int
        AND pmd.date < CURRENT_DATE
      GROUP BY tm.id, tm.name
      HAVING COUNT(DISTINCT sp.id) > 0
    )
    SELECT
      id,
      name,
      posts_count,
      engagement,
      CASE
        WHEN MAX(engagement) OVER () > 0
        THEN ROUND(engagement::NUMERIC / MAX(engagement) OVER () * 100, 1)
        ELSE 0
      END AS score
    FROM member_stats
    ORDER BY engagement DESC, posts_count DESC
    LIMIT $2
    `,
    [days, limit]
  );

  return res.rows.map((r, i) => ({
    id: r.id,
    rank: i + 1,
    name: r.name,
    posts: Number(r.posts_count),
    score: Number(r.score),
  }));
}
