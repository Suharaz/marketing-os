-- Migration 018: News articles table
-- Up migration
--
-- Lưu tin tức AI ingest từ RSS feeds (VentureBeat, TechCrunch, Verge,
-- Marktechpost). Mục đích: tích lũy dữ liệu theo thời gian thay vì
-- chỉ cache in-memory như trước → user thấy tin cũ vẫn còn sau restart,
-- có thể filter theo nguồn, sau này có thể làm thêm analytics.
--
-- Dedupe theo `link` (UNIQUE) — RSS có thể trùng <guid> giữa các feed
-- nhưng link bài viết là canonical, hiếm khi trùng cross-source.
--
-- Cron job-news-ingestion chạy mỗi 1h:
--   1. Fetch RSS từng nguồn
--   2. UPSERT ON CONFLICT (link) DO NOTHING — chỉ thêm tin mới
--   3. DELETE rows có published_at < NOW() - 30 days (retention)

CREATE TABLE IF NOT EXISTS news_article (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source       TEXT NOT NULL,
  title        TEXT NOT NULL,
  link         TEXT NOT NULL UNIQUE,
  description  TEXT,
  cover_image  TEXT,
  published_at TIMESTAMPTZ,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- List page ORDER BY published_at DESC NULLS LAST
-- NULLS LAST vì có item thiếu pubDate (parser fallback NULL) → đẩy xuống cuối
CREATE INDEX IF NOT EXISTS idx_news_article_published_at
  ON news_article (published_at DESC NULLS LAST);

-- Filter theo source (tabs UI)
CREATE INDEX IF NOT EXISTS idx_news_article_source
  ON news_article (source);

-- Extend sync_type_t enum để job-news-ingestion log được vào api_sync_log.
-- IF NOT EXISTS để chạy lại migration không bị fail.
ALTER TYPE sync_type_t ADD VALUE IF NOT EXISTS 'news_ingestion';
