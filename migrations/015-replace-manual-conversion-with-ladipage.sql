-- Migration 015: Replace manual_conversion with auto-fetched landing_page_conversion
-- Up migration
--
-- Context: Conversion tracking shifts from manual entry (form) to scheduled
-- pull from n8n webhook (Ladipage). One row per (page, day) so re-runs UPSERT
-- instead of inserting duplicates.

-- 1. Drop legacy table (data confirmed as non-critical by user)
DROP TABLE IF EXISTS manual_conversion CASCADE;

-- 2. Extend sync_type_t enum so api_sync_log can tag this new job
ALTER TYPE sync_type_t ADD VALUE IF NOT EXISTS 'ladipage';

-- 3. Create new table — UPSERT target for the cron job
CREATE TABLE IF NOT EXISTS landing_page_conversion (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       UUID NOT NULL REFERENCES social_account(id) ON DELETE CASCADE,
  occurred_date    DATE NOT NULL,
  conversion_count INT  NOT NULL DEFAULT 0,
  raw_response     JSONB,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, occurred_date)
);

-- 4. Index for dashboard KPI window queries
CREATE INDEX IF NOT EXISTS idx_landing_page_conversion_occurred_date
  ON landing_page_conversion (occurred_date DESC);

-- 5. Index for per-account drill-down queries
CREATE INDEX IF NOT EXISTS idx_landing_page_conversion_account
  ON landing_page_conversion (account_id, occurred_date DESC);
