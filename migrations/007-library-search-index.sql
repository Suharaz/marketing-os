-- Phase 08: Add full-text search index on social_post.content
-- Uses 'simple' dictionary (no Vietnamese stemming needed for MVP)
-- GIN index for efficient @@ operator queries

ALTER TABLE social_post
  ADD COLUMN IF NOT EXISTS content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('simple', COALESCE(content, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_post_content_tsv ON social_post USING GIN (content_tsv);
