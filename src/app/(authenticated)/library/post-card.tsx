// Server component — renders a single post card linking to permalink.
// No client-side interactivity; click opens permalink in new tab.

import { Eye, Heart, MessageCircle, Share2 } from 'lucide-react';
import type { LibraryPost } from '@/lib/queries/library-posts';

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  threads: 'Threads',
  zalo: 'Zalo',
};

// Badge color (top-left) — high contrast on a light card background.
const PLATFORM_BADGE: Record<string, string> = {
  facebook: 'bg-blue-600 text-white',
  instagram: 'bg-gradient-to-r from-pink-500 to-purple-600 text-white',
  tiktok: 'bg-zinc-900 text-white',
  youtube: 'bg-red-600 text-white',
  threads: 'bg-zinc-700 text-white',
  zalo: 'bg-sky-600 text-white',
};

// Fallback gradient when post has no thumbnail — keeps the grid visually
// consistent so empty cards don't read as "broken images".
const PLATFORM_GRADIENT: Record<string, string> = {
  facebook: 'from-blue-400 to-blue-700',
  instagram: 'from-pink-400 via-fuchsia-500 to-purple-700',
  tiktok: 'from-zinc-700 via-teal-500 to-zinc-900',
  youtube: 'from-red-400 to-red-700',
  threads: 'from-zinc-300 to-zinc-600',
  zalo: 'from-sky-400 to-sky-700',
};

function formatEr(er: number): string {
  // er is 0..1 from the DB; show as percent.
  return `${(er * 100).toFixed(1)}%`;
}

function formatCompact(n: number): string {
  return new Intl.NumberFormat('vi-VN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

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
  }).format(d);
}

interface PostCardProps {
  post: LibraryPost;
}

export function PostCard({ post }: PostCardProps) {
  const platformLabel = PLATFORM_LABELS[post.platform] ?? post.platform;
  const platformBadge = PLATFORM_BADGE[post.platform] ?? 'bg-zinc-700 text-white';
  const gradient = PLATFORM_GRADIENT[post.platform] ?? 'from-zinc-300 to-zinc-500';
  const href = post.permalink ?? '#';

  // Views = video_views when present, otherwise reach (best proxy for "saw it")
  const views = post.totalVideoViews > 0 ? post.totalVideoViews : post.totalReach;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-xl bg-white ring-1 ring-zinc-200 overflow-hidden hover:ring-zinc-400 hover:shadow-md transition-shadow"
    >
      {/* Visual — thumbnail when available, gradient fallback otherwise */}
      <div className="relative aspect-[16/10] overflow-hidden bg-zinc-100">
        {post.mediaUrl ? (
          <img
            src={post.mediaUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient}`} />
        )}

        {/* Platform badge — fixed top-left, mirrors design mock */}
        <span
          className={`absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded ${platformBadge}`}
        >
          {platformLabel}
        </span>

        {/* ER badge — top-right, only if non-zero so cold posts stay clean */}
        {post.avgEr > 0 && (
          <span className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-1 rounded bg-emerald-500/90 text-white">
            ER {formatEr(post.avgEr)}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2.5 p-3 flex-1">
        {/* Content preview */}
        <p className="text-sm text-zinc-800 font-medium line-clamp-2 leading-snug min-h-[2.5rem]">
          {post.content ?? <span className="text-zinc-400 italic font-normal">Không có nội dung</span>}
        </p>

        {/* Engagement row — view / like / comment / share */}
        <div className="flex items-center gap-3 text-[11px] text-zinc-600">
          <span className="inline-flex items-center gap-1">
            <Eye className="size-3" />
            {formatCompact(views)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Heart className="size-3" />
            {formatCompact(post.totalReactions)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="size-3" />
            {formatCompact(post.totalComments)}
          </span>
          {post.totalShares > 0 && (
            <span className="inline-flex items-center gap-1">
              <Share2 className="size-3" />
              {formatCompact(post.totalShares)}
            </span>
          )}
        </div>

        {/* Meta row — account name + relative time */}
        <div className="flex items-center justify-between gap-2 text-xs text-zinc-500 pt-2 border-t border-zinc-100">
          <span className="truncate">{post.accountName}</span>
          <span className="shrink-0">{formatRelativeDate(post.publishedAt)}</span>
        </div>
      </div>
    </a>
  );
}
