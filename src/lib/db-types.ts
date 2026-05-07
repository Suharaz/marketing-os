// TypeScript interfaces matching database table columns (snake_case)
// All uuid columns typed as string; timestamptz as Date; bytea as Buffer

// ─── Enums ────────────────────────────────────────────────────────────────────

export type PlatformT =
  | 'facebook'
  | 'tiktok'
  | 'youtube'
  | 'instagram'
  | 'threads'
  | 'zalo';

export type AccountStatusT = 'active' | 'token_expired' | 'disconnected';

export type PostTypeT =
  | 'photo'
  | 'video'
  | 'reel'
  | 'status'
  | 'link'
  | 'album'
  | 'sticker'
  | 'share';

export type SeverityT = 'info' | 'warning' | 'critical';

export type SyncTypeT =
  | 'page_insights'
  | 'posts'
  | 'health_recompute'
  | 'manual_refresh';

export type SyncStatusT = 'running' | 'success' | 'failed';

// ─── Tables ───────────────────────────────────────────────────────────────────

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: string;
  password_hash: string | null;
  created_at: Date;
}

export interface SocialAccount {
  id: string;
  platform: PlatformT;
  external_id: string;
  name: string;
  /** Arbitrary JSON metadata (audience, location, category, etc.) */
  persona_json: Record<string, unknown> | null;
  /** pgcrypto pgp_sym_encrypt output — opaque bytes at app layer */
  access_token_encrypted: Buffer | null;
  connected_at: Date;
  last_synced_at: Date | null;
  status: AccountStatusT;
  owner_member_id: string | null;
}

export interface SocialPost {
  id: string;
  account_id: string;
  external_id: string;
  content: string | null;
  media_url: string | null;
  post_type: PostTypeT;
  published_at: Date;
  permalink: string | null;
  campaign_tag: string | null;
}

export interface PostMetricDaily {
  post_id: string;
  date: Date;
  reactions: number;
  comments: number;
  shares: number;
  reach: number;
  impressions: number;
  clicks: number;
  video_views: number;
  /** GENERATED ALWAYS AS STORED — read-only, never write */
  engagement_rate: number;
  updated_at: Date;
}

export interface AccountMetricDaily {
  account_id: string;
  date: Date;
  followers: number;
  follower_growth: number;
  posts_count: number;
  total_reach: number;
  total_reach_unique: number;
  total_engagement: number;
  total_actions: number;
  page_views: number;
  post_reactions_total: number;
  updated_at: Date;
}

export interface ChannelHealthDaily {
  account_id: string;
  date: Date;
  health_score: number;
  er_score: number;
  consistency_score: number;
  growth_score: number;
  reach_score: number;
  computed_at: Date;
}

export interface ManualConversion {
  id: string;
  source_account_id: string | null;
  source_post_id: string | null;
  channel_label: string;
  conversion_count: number;
  revenue_vnd: number;
  currency: string;
  occurred_at: Date;
  note: string | null;
  created_by: string | null;
  created_at: Date;
}

export interface ApiSyncLog {
  id: string;
  sync_type: SyncTypeT;
  account_id: string | null;
  started_at: Date;
  finished_at: Date | null;
  status: SyncStatusT;
  records_upserted: number;
  error_message: string | null;
}

export interface Alert {
  id: string;
  severity: SeverityT;
  type: string;
  title: string;
  message: string;
  account_id: string | null;
  post_id: string | null;
  is_read: boolean;
  created_at: Date;
}
