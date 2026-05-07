-- Migration 013: Brief activity log + tracking who created
-- Up migration

-- ─── Track creator on briefs ────────────────────────────────────────────────────
ALTER TABLE briefs
  ADD COLUMN IF NOT EXISTS created_by_member_id UUID
    REFERENCES team_member(id) ON DELETE SET NULL;

-- ─── Activity log enum ──────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE brief_activity_action_t AS ENUM (
    'created',          -- brief mới được tạo
    'status_changed',   -- chuyển status (mine → draft, ...)
    'content_edited'    -- sửa title / description / format / priority / deadline / links
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Activity log table ─────────────────────────────────────────────────────────
-- actor_name là snapshot tại thời điểm action — phòng team_member bị xoá
-- vẫn hiển thị được "ai làm gì" trong history.
CREATE TABLE IF NOT EXISTS brief_activity (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id        UUID NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  action          brief_activity_action_t NOT NULL,
  actor_member_id UUID REFERENCES team_member(id) ON DELETE SET NULL,
  actor_name      TEXT,
  from_status     brief_status_t,
  to_status       brief_status_t,
  detail          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brief_activity_brief_created
  ON brief_activity (brief_id, created_at DESC);
