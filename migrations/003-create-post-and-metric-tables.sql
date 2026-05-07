-- Migration 003: Social post and metric tables
-- Up migration

CREATE TABLE IF NOT EXISTS social_post (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID NOT NULL REFERENCES social_account(id) ON DELETE CASCADE,
  external_id  TEXT NOT NULL,
  content      TEXT,
  media_url    TEXT,
  post_type    post_type_t NOT NULL DEFAULT 'status',
  published_at TIMESTAMPTZ NOT NULL,
  permalink    TEXT,
  campaign_tag TEXT,
  UNIQUE (account_id, external_id)
);

CREATE TABLE IF NOT EXISTS post_metric_daily (
  post_id         UUID NOT NULL REFERENCES social_post(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  reactions       INT NOT NULL DEFAULT 0,
  comments        INT NOT NULL DEFAULT 0,
  shares          INT NOT NULL DEFAULT 0,
  reach           INT NOT NULL DEFAULT 0,
  impressions     INT NOT NULL DEFAULT 0,
  clicks          INT NOT NULL DEFAULT 0,
  video_views     INT NOT NULL DEFAULT 0,
  engagement_rate NUMERIC(6,4) GENERATED ALWAYS AS (
    CASE WHEN reach > 0
      THEN ROUND((reactions + comments + shares)::NUMERIC / reach, 4)
      ELSE 0
    END
  ) STORED,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, date)
);

CREATE TABLE IF NOT EXISTS account_metric_daily (
  account_id       UUID NOT NULL REFERENCES social_account(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  followers        INT NOT NULL DEFAULT 0,
  follower_growth  INT NOT NULL DEFAULT 0,
  posts_count      INT NOT NULL DEFAULT 0,
  total_reach      INT NOT NULL DEFAULT 0,
  total_engagement INT NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, date)
);

CREATE TABLE IF NOT EXISTS channel_health_daily (
  account_id         UUID NOT NULL REFERENCES social_account(id) ON DELETE CASCADE,
  date               DATE NOT NULL,
  health_score       NUMERIC(5,2) NOT NULL DEFAULT 0,
  er_score           NUMERIC(5,2) NOT NULL DEFAULT 0,
  consistency_score  NUMERIC(5,2) NOT NULL DEFAULT 0,
  growth_score       NUMERIC(5,2) NOT NULL DEFAULT 0,
  reach_score        NUMERIC(5,2) NOT NULL DEFAULT 0,
  computed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, date)
);
