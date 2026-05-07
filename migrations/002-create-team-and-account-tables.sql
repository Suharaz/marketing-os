-- Migration 002: Team member and social account tables
-- Up migration

CREATE TABLE IF NOT EXISTS team_member (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_account (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform                platform_t NOT NULL,
  external_id             TEXT NOT NULL,
  name                    TEXT NOT NULL,
  persona_json            JSONB,
  access_token_encrypted  BYTEA,
  connected_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at          TIMESTAMPTZ,
  status                  account_status_t NOT NULL DEFAULT 'active',
  owner_member_id         UUID REFERENCES team_member(id) ON DELETE SET NULL,
  UNIQUE (platform, external_id)
);
