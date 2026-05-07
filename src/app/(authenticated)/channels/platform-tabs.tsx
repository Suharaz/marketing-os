'use client';

// Tab pills theo platform — đếm động từ data thật.
// Chỉ render những platform có ít nhất 1 kênh (ngoài "Tất cả").

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  threads: 'Threads',
  zalo: 'Zalo',
};

interface Props {
  currentPlatform: string; // 'all' | platform key
  total: number;
  byPlatform: Record<string, number>;
}

export function PlatformTabs({ currentPlatform, total, byPlatform }: Props) {
  const searchParams = useSearchParams();

  // Build href giữ nguyên các param khác (status, sort) — chỉ thay platform.
  function hrefFor(platform: string | null): string {
    const params = new URLSearchParams(searchParams.toString());
    if (platform === null) {
      params.delete('platform');
    } else {
      params.set('platform', platform);
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '?';
  }

  // Sort platform tabs theo count desc cho dễ scan.
  const platforms = Object.entries(byPlatform)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-2">
      <TabPill
        href={hrefFor(null)}
        label="Tất cả"
        count={total}
        active={currentPlatform === 'all'}
      />
      {platforms.map(([key, count]) => (
        <TabPill
          key={key}
          href={hrefFor(key)}
          label={PLATFORM_LABELS[key] ?? key}
          count={count}
          active={currentPlatform === key}
        />
      ))}
    </div>
  );
}

function TabPill({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-b-2 border-orange-500 text-orange-600 rounded-b-none'
          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
      )}
    >
      {label}
      <span
        className={cn(
          'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold',
          active ? 'bg-orange-100 text-orange-700' : 'bg-zinc-200 text-zinc-600'
        )}
      >
        {count}
      </span>
    </Link>
  );
}
