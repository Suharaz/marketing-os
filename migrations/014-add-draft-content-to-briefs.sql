-- Migration 014: draft_content column on briefs
-- Up migration
--
-- Tách "brief" (yêu cầu/spec) khỏi "draft" (nội dung bài viết).
-- Khi brief chuyển status mine → draft, writer bắt đầu viết vào field này.
-- Sau khi publish, draft_content vẫn giữ làm record nội dung đã viết.

ALTER TABLE briefs
  ADD COLUMN IF NOT EXISTS draft_content TEXT;
