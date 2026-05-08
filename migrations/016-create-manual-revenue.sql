-- Migration 016: Manual revenue entry table
-- Up migration
--
-- Revenue is entered by hand (form at /revenue/new). Each row attributes
-- an amount in VND to one social_account on a specific date. Unlike
-- landing_page_conversion (auto-pulled from n8n), there's no UNIQUE constraint
-- — a user may legitimately log multiple revenue events for the same
-- (account, date) and we want to keep them separate for audit.

CREATE TABLE IF NOT EXISTS manual_revenue (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES social_account(id) ON DELETE CASCADE,
  amount_vnd  BIGINT NOT NULL CHECK (amount_vnd >= 0),
  occurred_date DATE NOT NULL,
  note        TEXT,
  created_by  UUID REFERENCES team_member(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dashboard KPI window queries: SUM over occurred_date range
CREATE INDEX IF NOT EXISTS idx_manual_revenue_occurred_date
  ON manual_revenue (occurred_date DESC);

-- Per-account drill-down + list page ORDER BY
CREATE INDEX IF NOT EXISTS idx_manual_revenue_account
  ON manual_revenue (account_id, occurred_date DESC);
