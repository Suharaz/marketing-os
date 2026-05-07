-- Migration 012: Brief content workflow tables
-- Up migration

-- ─── Enums ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE brief_status_t AS ENUM (
    'mine',
    'draft',
    'submitted',
    'published',
    'revision'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE brief_format_t AS ENUM (
    'tiktok',
    'fb_reels',
    'fb_post',
    'yt_shorts',
    'yt_long',
    'threads',
    'instagram_post',
    'instagram_reels'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE brief_priority_t AS ENUM ('high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Personas — reusable across briefs ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS briefs_persona (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  dot_color   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Briefs ───────────────────────────────────────────────────────────────────
-- Rich content (audience_target, deconstruct, reference_links, attachments)
-- stored as JSONB — no join, no schema rigidity, mirrors TS interfaces 1:1.
-- proof_points / rules là TEXT[] vì là array of strings đơn thuần.
CREATE TABLE IF NOT EXISTS briefs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id        TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  status            brief_status_t NOT NULL DEFAULT 'mine',
  format            brief_format_t NOT NULL,
  priority          brief_priority_t NOT NULL DEFAULT 'medium',
  persona_id        UUID NOT NULL REFERENCES briefs_persona(id) ON DELETE RESTRICT,
  assigned_to       TEXT,
  source            TEXT NOT NULL DEFAULT 'Manual',

  -- Rich content (nullable cho briefs đơn giản chưa fill từ Spy Room)
  core_message      TEXT,
  audience_target   JSONB,
  deconstruct       JSONB,
  persona_tone      TEXT,
  proof_points      TEXT[] NOT NULL DEFAULT '{}',
  rules             TEXT[] NOT NULL DEFAULT '{}',

  -- Attachments + workflow
  reference_links   JSONB NOT NULL DEFAULT '[]'::jsonb,
  attachments       JSONB NOT NULL DEFAULT '[]'::jsonb,
  deadline          TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cursor pagination index — sort by created_at DESC, tie-break by id DESC
CREATE INDEX IF NOT EXISTS idx_briefs_status_created
  ON briefs (status, created_at DESC, id DESC);

-- Quick count by status (badge tabs)
CREATE INDEX IF NOT EXISTS idx_briefs_status
  ON briefs (status);

-- Trigger: auto-update updated_at on UPDATE
CREATE OR REPLACE FUNCTION trigger_briefs_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS briefs_set_updated_at ON briefs;
CREATE TRIGGER briefs_set_updated_at
  BEFORE UPDATE ON briefs
  FOR EACH ROW EXECUTE FUNCTION trigger_briefs_set_updated_at();
