// Card hiển thị 1 tin tức AI — server component, không có client interactivity.
// Click vào card mở link bài viết ở tab mới (target=_blank).
//
// Cover image: render <img> nếu có URL, else fallback gradient theo source.

import { ExternalLink } from 'lucide-react';
import { getSourceById } from '@/lib/news/sources';
import type { StoredNewsItem } from '@/lib/news/news-db';

/** Format "Xh trước" / "Xd trước" / "DD/MM" — pattern giống library/post-card. */
function formatRelativeDate(isoStr: string | null): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
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

const FALLBACK_GRADIENT = 'from-zinc-400 to-zinc-600';

interface NewsItemCardProps {
  item: StoredNewsItem;
}

export function NewsItemCard({ item }: NewsItemCardProps) {
  const source = getSourceById(item.source);
  const sourceName = source?.name ?? item.source;
  const gradient = source?.gradient ?? FALLBACK_GRADIENT;

  return (
    <a
      href={item.link}
      target="_blank"
      // rel noopener: chống tab-nabbing
      rel="noopener noreferrer"
      className="group flex flex-col rounded-xl bg-white ring-1 ring-zinc-200 overflow-hidden hover:ring-blue-400 hover:shadow-md transition-all"
    >
      {/* Cover image — aspect 16/9 cố định để grid đều nhau */}
      <div className={`relative aspect-[16/9] w-full bg-gradient-to-br ${gradient}`}>
        {item.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          // Lý do dùng <img> thay vì <Image>:
          //   - URL ngoại đa dạng (4 nguồn) → cấu hình remotePatterns phức tạp
          //   - Tin tức không cần optimization aggressive
          //   - Tránh build error nếu domain mới được thêm
          <img
            src={item.coverImage}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/80 text-xs font-semibold tracking-wide">
            {sourceName}
          </div>
        )}
        {/* Badge nguồn — overlay góc trái-trên */}
        <span className="absolute top-2 left-2 rounded-md bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold text-white">
          {sourceName}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2 p-4 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-900 leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors">
            {item.title}
          </h3>
          <ExternalLink className="size-3.5 shrink-0 text-zinc-400 group-hover:text-blue-600 mt-0.5" />
        </div>

        {item.excerpt && (
          <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed">
            {item.excerpt}
          </p>
        )}

        <div className="text-[11px] text-zinc-500 mt-auto pt-2 border-t border-zinc-100">
          {item.pubDate ? (
            <time dateTime={item.pubDate}>{formatRelativeDate(item.pubDate)}</time>
          ) : (
            <span>Mới ingest</span>
          )}
        </div>
      </div>
    </a>
  );
}
