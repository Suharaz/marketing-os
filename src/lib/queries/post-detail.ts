// Post detail query — single post + latest metric snapshot.
// Pattern: LATERAL JOIN giống fetchRecentPosts (channel-detail.ts:183) nhưng cho 1 post.
// Dùng bởi MCP tool `posts_get`.

import { db } from '@/lib/db';

export interface PostDetail {
  id: string;
  accountId: string;
  accountName: string;
  platform: string;
  externalId: string;
  content: string | null;
  mediaUrl: string | null;
  postType: string;
  publishedAt: string | null;
  permalink: string | null;
  campaignTag: string | null;
  // Snapshot mới nhất từ post_metric_daily
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  reach: number | null;
  impressions: number | null;
  clicks: number | null;
  videoViews: number | null;
  engagementRate: number | null;
  metricDate: string | null;
}

export async function fetchPost(id: string): Promise<PostDetail | null> {
  const res = await db.query<{
    id: string;
    account_id: string;
    account_name: string;
    platform: string;
    external_id: string;
    content: string | null;
    media_url: string | null;
    post_type: string;
    published_at: string | null;
    permalink: string | null;
    campaign_tag: string | null;
    reactions: number | null;
    comments: number | null;
    shares: number | null;
    reach: number | null;
    impressions: number | null;
    clicks: number | null;
    video_views: number | null;
    engagement_rate: string | null;
    metric_date: string | null;
  }>(
    `SELECT sp.id, sp.account_id, sa.name AS account_name, sa.platform,
            sp.external_id, sp.content, sp.media_url, sp.post_type,
            sp.published_at, sp.permalink, sp.campaign_tag,
            pm.reactions, pm.comments, pm.shares,
            pm.reach, pm.impressions, pm.clicks, pm.video_views,
            pm.engagement_rate,
            to_char(pm.date, 'YYYY-MM-DD') AS metric_date
     FROM social_post sp
     INNER JOIN social_account sa ON sa.id = sp.account_id
     LEFT JOIN LATERAL (
       SELECT date, reactions, comments, shares, reach, impressions,
              clicks, video_views, engagement_rate
       FROM post_metric_daily
       WHERE post_id = sp.id
       ORDER BY date DESC
       LIMIT 1
     ) pm ON TRUE
     WHERE sp.id = $1`,
    [id]
  );

  const row = res.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    accountId: row.account_id,
    accountName: row.account_name,
    platform: row.platform,
    externalId: row.external_id,
    content: row.content,
    mediaUrl: row.media_url,
    postType: row.post_type,
    publishedAt: row.published_at,
    permalink: row.permalink,
    campaignTag: row.campaign_tag,
    reactions: row.reactions,
    comments: row.comments,
    shares: row.shares,
    reach: row.reach,
    impressions: row.impressions,
    clicks: row.clicks,
    videoViews: row.video_views,
    engagementRate: row.engagement_rate !== null ? Number(row.engagement_rate) : null,
    metricDate: row.metric_date,
  };
}
