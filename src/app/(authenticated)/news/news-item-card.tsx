// Card hiển thị 1 tin tức AI — server component, không có client interactivity.
// Click vào card mở link bài viết ở tab mới (target=_blank).

import { ExternalLink } from 'lucide-react';
import type { NewsItem } from '@/lib/news/types';

/**
 * Format thời gian dạng "Xh trước" / "Xd trước" / "DD/MM" — same pattern
 * như post-card.tsx của library để giữ UX nhất quán.
 */
function formatRelativeDate(isoStr: string): string {
  const d = new Date(isoStr);
  const diffMs = Date.now() - d.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return 'Vừa xong';
  if (diffH < 24) return `${diffH}h trước`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d trước`;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

interface NewsItemCardProps {
  item: NewsItem;
}

export function NewsItemCard({ item }: NewsItemCardProps) {
  return (
    <a
      href={item.link}
      target="_blank"
      // rel noopener: chống tab-nabbing (link mở tab mới có thể chiếm window.opener)
      rel="noopener noreferrer"
      className="group flex flex-col gap-3 rounded-xl bg-white ring-1 ring-zinc-200 p-5 hover:ring-blue-400 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-zinc-900 leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors">
          {item.title}
        </h3>
        <ExternalLink className="size-4 shrink-0 text-zinc-400 group-hover:text-blue-600 mt-0.5" />
      </div>

      {item.excerpt && (
        <p className="text-sm text-zinc-600 line-clamp-3 leading-relaxed">
          {item.excerpt}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-zinc-500 mt-auto pt-2 border-t border-zinc-100">
        <span className="font-medium">VentureBeat AI</span>
        <time dateTime={item.pubDate}>{formatRelativeDate(item.pubDate)}</time>
      </div>
    </a>
  );
}
