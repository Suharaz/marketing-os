-- Up Migration
-- Phase 11 (post-MVP): store per-call FB API details for manual sync inspection.
-- Cron jobs leave NULL to avoid log table bloat.

ALTER TABLE api_sync_log
  ADD COLUMN IF NOT EXISTS details jsonb;

CREATE INDEX IF NOT EXISTS idx_api_sync_log_started_at
  ON api_sync_log (started_at DESC);
