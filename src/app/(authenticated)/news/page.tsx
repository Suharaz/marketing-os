// Tab Tin tức AI — đọc DB (đã được cron ingest từ RSS).
// Server component: dùng cached fetcher (5 phút TTL) → query DB rẻ + tươi.
//
// Filter theo source qua searchParams ?source=... (handled in NewsSourceTabs).

import type { Metadata } from 'next';
import { getAiNews } from '@/lib/news/fetch-news';
import { VALID_SOURCE_IDS } from '@/lib/news/sources';
import { NewsItemCard } from './news-item-card';
import { NewsSourceTabs } from './news-source-tabs';

export const metadata: Metadata = {
  title: 'Tin tức AI — Marketing OS',
};

const NUMBER_FMT = new Intl.NumberFormat('vi-VN');

interface NewsPageProps {
  // Next.js 16: searchParams là Promise — phải await trước khi đọc.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Đảm bảo sourceId từ URL là 1 trong set hợp lệ — chống open-ended input. */
function parseSourceFilter(raw: string | string[] | undefined): string | undefined {
  if (typeof raw !== 'string' || !raw) return undefined;
  return VALID_SOURCE_IDS.has(raw) ? raw : undefined;
}

export default async function NewsPage({ searchParams }: NewsPageProps) {
  const params = await searchParams;
  const sourceFilter = parseSourceFilter(params.source);
  const items = await getAiNews(sourceFilter);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Tin tức AI</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Tổng hợp từ VentureBeat · TechCrunch · The Verge · Marktechpost · cập nhật mỗi giờ
          </p>
        </div>
        <p className="text-xs text-zinc-500 shrink-0">
          {NUMBER_FMT.format(items.length)} bài
        </p>
      </div>

      {/* Source tabs */}
      <NewsSourceTabs />

      {items.length === 0 ? <EmptyState /> : <NewsGrid items={items} />}
    </div>
  );
}

function NewsGrid({ items }: { items: Awaited<ReturnType<typeof getAiNews>> }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map((item) => (
        <NewsItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl bg-white ring-1 ring-zinc-200 px-6 py-12 text-center">
      <p className="text-sm font-medium text-zinc-700">
        Chưa có tin nào
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Cron job chạy mỗi giờ. Nếu vừa migrate xong, đợi tới lần fetch kế tiếp
        hoặc kích hoạt thủ công bằng API/script.
      </p>
    </div>
  );
}
