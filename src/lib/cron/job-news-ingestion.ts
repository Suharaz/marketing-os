// Job E — News ingestion. Chạy mỗi 1h (xem schedule trong init.ts).
//
// Flow:
//   1. Loop qua NEWS_SOURCES → fetch RSS song song (Promise.allSettled)
//   2. Parse XML → upsert ON CONFLICT (link) DO NOTHING
//   3. Prune tin > 30 ngày
//   4. Log kết quả vào api_sync_log
//
// Tại sao Promise.allSettled mà không phải .all?
//   - 1 nguồn fail (network, format lỗi) KHÔNG nên block các nguồn khác
//   - User sẽ thấy "3/4 nguồn OK, marktechpost lỗi" thay vì cả job fail
//
// Tại sao prune cuối cùng?
//   - Insert trước → đảm bảo có data mới rồi mới xóa data cũ
//   - Nếu insert fail, prune vẫn chạy → DB không phình bất kể lỗi upstream

import { NEWS_SOURCES } from '@/lib/news/sources';
import { parseRssFeed } from '@/lib/news/rss-parser';
import { upsertNewsItems, pruneOldNewsArticles } from '@/lib/news/news-db';
import { startSyncLog, finishSyncLog } from '@/lib/cron/sync-log';

const REQUEST_TIMEOUT_MS = 15_000;

interface SourceResult {
  sourceId: string;
  fetched: number;   // số item parse được
  inserted: number;  // số item thực sự INSERT (bỏ qua dedupe)
  error?: string;
}

/** Fetch + parse + upsert 1 nguồn. Không throw — trả result để caller log. */
async function ingestOneSource(source: typeof NEWS_SOURCES[number]): Promise<SourceResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'User-Agent': 'MarketingOS-NewsReader/1.0',
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
    });
    if (!res.ok) {
      return { sourceId: source.id, fetched: 0, inserted: 0, error: `HTTP ${res.status}` };
    }

    const xml = await res.text();
    const items = parseRssFeed(xml);
    if (items.length === 0) {
      return { sourceId: source.id, fetched: 0, inserted: 0, error: 'no items parsed' };
    }

    const inserted = await upsertNewsItems(source.id, items);
    return { sourceId: source.id, fetched: items.length, inserted };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return { sourceId: source.id, fetched: 0, inserted: 0, error: msg };
  } finally {
    clearTimeout(timeout);
  }
}

/** PUBLIC entry — gọi từ cron schedule. */
export async function runNewsIngestionJob(): Promise<void> {
  const logId = await startSyncLog('news_ingestion', null);
  let totalInserted = 0;
  const errors: string[] = [];

  try {
    // Song song: 4 nguồn × ~5s = vẫn dưới 15s timeout per source
    const results = await Promise.allSettled(
      NEWS_SOURCES.map((src) => ingestOneSource(src))
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        const { sourceId, fetched, inserted, error } = r.value;
        console.log(
          `[cron/news] ${sourceId}: fetched=${fetched} inserted=${inserted}` +
            (error ? ` error="${error}"` : '')
        );
        totalInserted += inserted;
        if (error) errors.push(`${sourceId}: ${error}`);
      } else {
        // Hiếm — ingestOneSource đã catch nội bộ, fall-through này chỉ
        // xảy ra nếu có lỗi không lường (vd Promise reject ngoài try/catch).
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        errors.push(`unhandled: ${msg}`);
        console.error('[cron/news] unhandled source rejection:', msg);
      }
    }

    const pruned = await pruneOldNewsArticles(30);
    console.log(`[cron/news] pruned ${pruned} old article(s)`);

    // Coi job thành công nếu có ít nhất 1 nguồn OK (totalInserted >= 0 luôn đúng).
    // Status = failed chỉ khi TẤT CẢ nguồn đều lỗi → ghi error_message.
    const allFailed = errors.length === NEWS_SOURCES.length;
    await finishSyncLog(
      logId,
      allFailed ? 'failed' : 'success',
      totalInserted,
      errors.length > 0 ? errors.join(' | ') : null
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error('[cron/news] uncaught error:', err);
    await finishSyncLog(logId, 'failed', totalInserted, msg);
  }
}
