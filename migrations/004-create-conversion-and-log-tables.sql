-- Migration 004: Manual conversion, API sync log, and alert tables
-- Up migration

CREATE TABLE IF NOT EXISTS manual_conversion (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_account_id UUID REFERENCES social_account(id) ON DELETE SET NULL,
  source_post_id    UUID REFERENCES social_post(id) ON DELETE SET NULL,
  channel_label     TEXT NOT NULL,
  conversion_count  INT NOT NULL DEFAULT 0,
  revenue_vnd       BIGINT NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'VND',
  occurred_at       TIMESTAMPTZ NOT NULL,
  note              TEXT,
  created_by        UUID REFERENCES team_member(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_sync_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type        sync_type_t NOT NULL,
  account_id       UUID REFERENCES social_account(id) ON DELETE SET NULL,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at      TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'running'
                   CHECK (status IN ('running', 'success', 'failed')),
  records_upserted INT NOT NULL DEFAULT 0,
  error_message    TEXT
);

CREATE TABLE IF NOT EXISTS alert (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity   severity_t NOT NULL DEFAULT 'info',
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  account_id UUID REFERENCES social_account(id) ON DELETE SET NULL,
  post_id    UUID REFERENCES social_post(id) ON DELETE SET NULL,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
