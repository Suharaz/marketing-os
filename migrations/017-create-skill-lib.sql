-- Migration 017: Skill library table
-- Up migration
--
-- Skill lib lưu metadata cho file zip/.skill mà user upload. File binary
-- thực sự nằm trên local disk tại $SKILL_STORAGE_PATH/<id>.zip (Docker
-- volume bind từ ./data/skills). Tại sao tách DB / disk:
--   1. Không giới hạn dung lượng → tránh bytea phình DB.
--   2. Stream upload trực tiếp ra disk, không phải buffer in-memory rồi
--      INSERT — quan trọng với file lớn (vài GB).
--   3. sha256 lưu sẵn → cho phép integrity check + dedupe sau này.
--
-- Permission semantics enforce ở app layer:
--   - Upload: bất kỳ team_member nào có session hợp lệ.
--   - Delete: chỉ uploaded_by hoặc role='admin'.

CREATE TABLE IF NOT EXISTS skill_lib (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  description       TEXT,
  original_filename TEXT NOT NULL,
  size_bytes        BIGINT NOT NULL CHECK (size_bytes >= 0),
  sha256            TEXT NOT NULL,
  storage_path      TEXT NOT NULL,
  uploaded_by       UUID REFERENCES team_member(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- List page ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_skill_lib_created_at
  ON skill_lib (created_at DESC);

-- "My uploads" drill-down sau này
CREATE INDEX IF NOT EXISTS idx_skill_lib_uploaded_by
  ON skill_lib (uploaded_by);
