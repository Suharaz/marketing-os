// Tab Tin tức AI — fetch feed VentureBeat AI, hiển thị grid card.
// Server component: dùng cached fetcher (1h TTL) → không tự gọi endpoint
// nhiều lần khi user F5/navigate liên tục.

import type { Metadata } from 'next';
import { getAiNews } from '@/lib/news/fetch-news';
import { NewsItemCard } from './news-item-card';

export const metadata: Metadata = {
  title: 'Tin tức AI — Marketing OS',
};

const NUMBER_FMT = new Intl.NumberFormat('vi-VN');

export default async function NewsPage() {
  const items = await getAiNews();

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Tin tức AI</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Cập nhật từ VentureBeat · tự refresh mỗi 1 giờ
          </p>
        </div>
        <p className="text-xs text-zinc-500 shrink-0">
          {NUMBER_FMT.format(items.length)} bài
        </p>
      </div>

      {items.length === 0 ? <EmptyState /> : <NewsGrid items={items} />}
    </div>
  );
}

function NewsGrid({ items }: { items: Awaited<ReturnType<typeof getAiNews>> }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        Chưa tải được tin tức
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Endpoint RSS có thể đang chậm hoặc không truy cập được. Thử lại sau ít phút.
      </p>
    </div>
  );
}
