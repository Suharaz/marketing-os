-- Migration 005: Performance indexes
-- Up migration

-- Posts: filter by account, order by published date descending
CREATE INDEX IF NOT EXISTS idx_post_account_published
  ON social_post (account_id, published_at DESC);

-- Post metrics: range queries by date
CREATE INDEX IF NOT EXISTS idx_post_metric_date
  ON post_metric_daily (date);

-- Account metrics: range queries by date
CREATE INDEX IF NOT EXISTS idx_account_metric_date
  ON account_metric_daily (date);

-- Channel health: lookup by account + date descending
CREATE INDEX IF NOT EXISTS idx_health_account_date
  ON channel_health_daily (account_id, date DESC);

-- Alerts: fast unread filter (partial index)
CREATE INDEX IF NOT EXISTS idx_alert_unread
  ON alert (is_read, created_at DESC)
  WHERE is_read = FALSE;

-- Social account persona_json: GIN index for JSONB filter queries
CREATE INDEX IF NOT EXISTS idx_social_account_persona_gin
  ON social_account USING GIN (persona_json);
