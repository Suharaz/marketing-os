// Fetch + cache wrapper cho RSS feed VentureBeat AI.
//
// Caching strategy (giống pattern lib/cache/dashboard-cache.ts):
//   - unstable_cache: dedupe + memoize kết quả trong 3600s (1h)
//   - Khi cache còn hiệu lực: trả về kết quả cũ ngay → KHÔNG hit endpoint
//   - Khi cache hết hạn: fetch lại 1 lần, cache tiếp 1h
//   → Đáp ứng yêu cầu "1h fetch 1 lần · lưu fetch trước để tránh request nhiều"
//
// Không lưu DB — toàn bộ chỉ ở memory của process Next.js.

import { unstable_cache } from 'next/cache';
import { parseRssFeed } from './rss-parser';
import type { NewsItem } from './types';

const FEED_URL = 'https://feeds.feedburner.com/venturebeat/SZYF';
const CACHE_TTL_SECONDS = 3600; // 1 giờ — đúng yêu cầu user
const REQUEST_TIMEOUT_MS = 10_000; // 10s — feed nhỏ, không cần lâu hơn

/**
 * Fetch RSS XML thô từ endpoint VentureBeat.
 * Có timeout để tránh treo request nếu upstream chậm/down.
 * Throw lỗi để caller (cached wrapper) có thể bắt và log.
 */
async function fetchRawFeed(): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(FEED_URL, {
      signal: controller.signal,
      // cache: 'no-store' vì lớp cache nằm ở unstable_cache phía trên,
      // không cần fetch-level cache (sẽ chồng cache, khó debug).
      cache: 'no-store',
      headers: {
        // Một số CDN block fetch không có User-Agent
        'User-Agent': 'MarketingOS-NewsReader/1.0',
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
    });

    if (!res.ok) {
      throw new Error(`Upstream returned ${res.status} ${res.statusText}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Inner function: fetch + parse. Tách riêng để unstable_cache wrap được.
 * Nếu fetch lỗi → trả mảng rỗng (không throw) để UI không crash.
 */
async function fetchAndParse(): Promise<NewsItem[]> {
  try {
    const xml = await fetchRawFeed();
    return parseRssFeed(xml);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[news/fetch-news] Failed to fetch RSS feed:', msg);
    return [];
  }
}

/**
 * PUBLIC API — gọi từ Server Component để lấy danh sách tin.
 *
 * Cache key cố định ['news-venturebeat-ai-v1'] vì không có argument biến thiên.
 * Tag 'news' cho phép invalidate thủ công sau này nếu cần (chưa dùng ngay).
 */
export const getAiNews = unstable_cache(
  async () => fetchAndParse(),
  ['news-venturebeat-ai-v1'],
  { tags: ['news'], revalidate: CACHE_TTL_SECONDS }
);
