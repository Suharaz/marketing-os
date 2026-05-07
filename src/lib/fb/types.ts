// Facebook Graph API response shapes used across the FB integration layer.
// Only fields actually consumed by this app are typed; extras are ignored.

/** FB media_type values seen in /posts attachments expansion.
 *  `video_inline` covers regular videos and reels (reel detected via URL).
 *  `share` = link/post share preview; `sticker` = standalone sticker post. */
export type FBAttachmentMediaType =
  | 'photo'
  | 'album'
  | 'video_inline'
  | 'link'
  | 'sticker'
  | 'share';

export interface FBAttachmentMedia {
  /** Image preview (also present on video attachments — thumbnail) */
  image?: { src?: string; height?: number; width?: number };
  /** Direct video URL (only for video_inline) */
  source?: string;
}

export interface FBAttachment {
  media_type?: FBAttachmentMediaType;
  /** Raw type slug (less reliable than media_type — kept for diagnostics) */
  type?: string;
  title?: string;
  description?: string;
  /** Legacy field used by old posts query — superseded by `media` */
  url?: string;
  media?: FBAttachmentMedia;
  /** Album/carousel children — first item already gives a usable preview */
  subattachments?: { data: FBAttachment[] };
}

export interface FBInsightValue {
  value: number | Record<string, number>;
  end_time?: string;
}

export interface FBInsightItem {
  name: string;
  /** Aggregation period — `lifetime` (cumulative) or `day` (per-day buckets).
   *  Same metric may appear with both periods; consumers usually want lifetime. */
  period?: 'lifetime' | 'day' | 'week' | 'days_28';
  values: FBInsightValue[];
}

export interface FBPagePost {
  id: string;
  message?: string;
  /** Auto-generated story text when message is absent
   *  (e.g. "X added a new photo"). Used as fallback for `content`. */
  story?: string;
  created_time: string;
  permalink_url: string;
  /** Thumbnail URL chosen by FB — preferred for media_url */
  full_picture?: string;
  attachments?: { data: FBAttachment[] };
  /** Nested insights from field expansion — only present on posts queries */
  insights?: { data: FBInsightItem[] };
  /** Comments summary from ?fields=comments.summary(true) expansion */
  comments?: { summary?: { total_count?: number } };
  /** Shares from ?fields=shares expansion */
  shares?: { count?: number };
  /** Reactions summary from ?fields=reactions.summary(true) — current count.
   *  Differs from insights `post_reactions_by_type_total` (lifetime aggregate);
   *  used as fallback when insights returns null/0. */
  reactions?: { summary?: { total_count?: number } };
}

/**
 * Reels — fetched from /{pageId}/video_reels endpoint (separate from /posts).
 * Reels often miss from /posts (especially Instagram cross-posts), so this is
 * the source of truth for short-form video content.
 */
export interface FBPageReel {
  id: string;
  /** Reels use `description` instead of `message` */
  description?: string;
  created_time: string;
  permalink_url: string;
  /** Duration in seconds */
  length?: number;
  /** Comments summary from ?fields=comments.summary(true) expansion */
  comments?: { summary?: { total_count?: number } };
  /** Shares from ?fields=shares expansion */
  shares?: { count?: number };
}

export interface FBPageInsight {
  name: string;
  /** `value` may be a scalar (most metrics) or an object keyed by sub-type
   *  (e.g. `page_actions_post_reactions_total` returns reaction-type breakdown). */
  values: Array<{ value: number | Record<string, number>; end_time: string }>;
}

export interface FBPage {
  id: string;
  name: string;
  /** Page-scoped access token returned by /me/accounts */
  access_token: string;
  category?: string;
}

export interface FBPaginatedResponse<T> {
  data: T[];
  paging?: {
    cursors?: { before: string; after: string };
    next?: string;
  };
}

/** Structured error returned by FB Graph API */
export interface FBApiError {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

/** Error thrown when a Page Access Token has expired or been revoked */
export class TokenExpiredError extends Error {
  readonly accountId?: string;
  constructor(message: string, accountId?: string) {
    super(message);
    this.name = 'TokenExpiredError';
    this.accountId = accountId;
  }
}
