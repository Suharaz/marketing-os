-- Migration 009: Extend account_metric_daily for full page insights coverage
-- Up migration
--
-- Adds columns needed by the merged /insights call which fetches all 8 metrics:
--   page_follows, page_daily_follows_unique, page_media_view,
--   page_total_media_view_unique, page_post_engagements, page_total_actions,
--   page_views_total, page_actions_post_reactions_total
--
-- Existing columns (followers, follower_growth, total_reach, total_engagement)
-- are reused. The 4 columns below cover the previously-missing metrics.

ALTER TABLE account_metric_daily
  ADD COLUMN IF NOT EXISTS total_reach_unique   INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_actions        INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS page_views           INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS post_reactions_total INT NOT NULL DEFAULT 0;
