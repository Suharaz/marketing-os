// PUBLIC API cho UI: lấy tin từ DB (đã được cron ingest từ RSS).
//
// Thay đổi so với version cũ (in-memory only):
//   - KHÔNG fetch trực tiếp RSS endpoint từ request người dùng
//   - Cron job-news-ingestion ăn RSS → ghi DB → page chỉ đọc DB
//   → Tránh hammer endpoint, dữ liệu giàu dần theo thời gian
//
// Vẫn giữ unstable_cache (5 phút) vì:
//   - Query DB tuy nhanh nhưng không free (network + parse)
//   - 1 cache entry per source-filter combination
//   - 5 phút đủ để hấp thụ traffic spike, đủ tươi vì cron chạy 1h/lần

import { unstable_cache } from 'next/cache';
import { listNewsArticles, type StoredNewsItem } from './news-db';

const CACHE_TTL_SECONDS = 300; // 5 phút

/**
 * Lấy danh sách tin tức, optional filter theo source id.
 *
 * @param sourceId — undefined: all sources. 'venturebeat-ai'|'techcrunch-ai'|...
 *
 * Cache key tự động bao gồm sourceId (closure capture) → mỗi filter có
 * cache entry riêng, không bị nhiễm chéo.
 */
export const getAiNews = unstable_cache(
  async (sourceId?: string): Promise<StoredNewsItem[]> => {
    try {
      return await listNewsArticles(sourceId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      console.error('[news/fetch-news] DB query failed:', msg);
      return [];
    }
  },
  ['ai-news-list-v2'],
  { tags: ['news'], revalidate: CACHE_TTL_SECONDS }
);
