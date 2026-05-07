// Maps a raw FBPagePost from Graph API into the shape needed for social_post UPSERT.
// Post type is inferred from attachments.media_type; insights are extracted inline.
//
// Insight metric mapping (curl spec → DB column):
//   post_media_view              → impressions
//   post_total_media_view_unique → reach
//   post_clicks_by_type   (obj)  → clicks  (sum of values)
//   post_reactions_by_type_total → reactions  (sum of values)
//
// Object-shaped metrics (post_clicks_by_type may be `{}`, post_reactions_by_type_total
// is `{like: N, love: N, ...}`) are summed across keys.

import type { FBAttachment, FBAttachmentMediaType, FBPagePost } from './types';
import type { PostTypeT } from '@/lib/db-types';

export interface ParsedPost {
  external_id: string;
  content: string | null;
  media_url: string | null;
  post_type: PostTypeT;
  published_at: Date;
  permalink: string | null;
  /** Raw insight metrics extracted from embedded field-expansion response */
  metrics: ParsedPostMetrics;
}

export interface ParsedPostMetrics {
  impressions: number;
  reach: number;
  clicks: number;
  /** Not exposed by current insight metric set — kept on schema for compatibility */
  video_views: number;
  /** Sum of all reaction types from post_reactions_by_type_total
   *  (falls back to reactions.summary.total_count when insights null/0) */
  reactions: number;
  comments: number;
  shares: number;
}

/** Map FB attachment.media_type → our DB enum. Reels share `video_inline`
 *  with regular videos; reel detection happens via permalink URL. */
const MEDIA_TYPE_MAP: Record<FBAttachmentMediaType, PostTypeT> = {
  photo: 'photo',
  album: 'album',
  video_inline: 'video',
  link: 'link',
  sticker: 'sticker',
  share: 'share',
};

function inferPostType(post: FBPagePost): PostTypeT {
  // Reels detected by URL first — overrides media_type which is video_inline
  if (post.permalink_url?.includes('/reel/')) return 'reel';

  const mediaType = post.attachments?.data?.[0]?.media_type;
  if (mediaType && mediaType in MEDIA_TYPE_MAP) {
    return MEDIA_TYPE_MAP[mediaType];
  }
  return 'status';
}

/** Pick the best media URL: full_picture → attachment.media.source (video) →
 *  attachment.media.image.src (thumbnail) → legacy attachment.url. */
function pickMediaUrl(post: FBPagePost): string | null {
  if (post.full_picture) return post.full_picture;
  const att: FBAttachment | undefined = post.attachments?.data?.[0];
  return att?.media?.source ?? att?.media?.image?.src ?? att?.url ?? null;
}

/** Sum a numeric-or-object insight value. Returns 0 for null/undefined. */
function sumInsightValue(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).reduce<number>(
      (sum, v) => sum + (typeof v === 'number' ? v : 0),
      0
    );
  }
  return 0;
}

/** Pick an insight item by name, preferring `period: lifetime` when multiple
 *  periods are returned (curl spec uses lifetime; daily rows are noise here). */
function getInsight(
  insights: FBPagePost['insights'],
  metricName: string
): unknown {
  const items = insights?.data?.filter((d) => d.name === metricName) ?? [];
  if (items.length === 0) return undefined;
  // Prefer lifetime when multiple periods are returned for same metric
  const lifetime = items.find((d) => d.period === 'lifetime');
  const chosen = lifetime ?? items[0];
  return chosen?.values?.[0]?.value;
}

/** Parse a single FBPagePost into a ParsedPost ready for DB UPSERT.
 *  Reads insights + comments + shares + reactions from embedded fields.
 *  `fallbackInsights` is used when /posts had to drop the insights expansion
 *  due to error #100 — caller probes per-metric and passes the result here. */
export function parsePost(
  post: FBPagePost,
  fallbackInsights: Record<string, number> = {}
): ParsedPost {
  const impressions =
    sumInsightValue(getInsight(post.insights, 'post_media_view')) ||
    fallbackInsights['post_media_view'] ||
    0;
  const reach =
    sumInsightValue(getInsight(post.insights, 'post_total_media_view_unique')) ||
    fallbackInsights['post_total_media_view_unique'] ||
    0;
  const clicks =
    sumInsightValue(getInsight(post.insights, 'post_clicks_by_type')) ||
    fallbackInsights['post_clicks_by_type'] ||
    0;
  const reactionsFromInsight =
    sumInsightValue(getInsight(post.insights, 'post_reactions_by_type_total')) ||
    fallbackInsights['post_reactions_by_type_total'] ||
    0;
  // reactions.summary is current count — used when insights aggregate is 0/null
  const reactions =
    reactionsFromInsight || post.reactions?.summary?.total_count || 0;

  return {
    external_id: post.id,
    content: post.message ?? post.story ?? null,
    media_url: pickMediaUrl(post),
    post_type: inferPostType(post),
    published_at: new Date(post.created_time),
    permalink: post.permalink_url ?? null,
    metrics: {
      impressions,
      reach,
      clicks,
      video_views: 0,
      reactions,
      comments: post.comments?.summary?.total_count ?? 0,
      shares: post.shares?.count ?? 0,
    },
  };
}
