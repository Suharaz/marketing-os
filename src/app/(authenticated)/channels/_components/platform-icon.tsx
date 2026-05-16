// Platform icon — square badge với chữ cái viết tắt của platform.
// Tách riêng để channel-card + channel-header dùng chung (DRY) — trước đây
// PLATFORM_META định nghĩa duplicate trong channel-card.tsx.

import { cn } from '@/lib/utils';

interface PlatformMeta {
  label: string;
  bg: string;
  letter: string;
}

const META: Record<string, PlatformMeta> = {
  facebook: { label: 'Facebook', bg: 'bg-blue-600', letter: 'f' },
  instagram: { label: 'Instagram', bg: 'bg-pink-500', letter: 'IG' },
  tiktok: { label: 'TikTok', bg: 'bg-zinc-900', letter: 'TT' },
  youtube: { label: 'YouTube', bg: 'bg-red-600', letter: 'YT' },
  threads: { label: 'Threads', bg: 'bg-zinc-800', letter: 'T' },
  zalo: { label: 'Zalo', bg: 'bg-sky-500', letter: 'Z' },
};

const SIZE_CLASS: Record<'md' | 'lg', string> = {
  md: 'size-12 text-base',
  lg: 'size-14 text-lg',
};

interface Props {
  platform: string;
  size?: 'md' | 'lg';
  className?: string;
}

export function PlatformIcon({ platform, size = 'md', className }: Props) {
  const meta = META[platform] ?? { label: platform, bg: 'bg-zinc-500', letter: '?' };
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg text-white font-bold',
        meta.bg,
        SIZE_CLASS[size],
        className
      )}
      aria-label={meta.label}
      title={meta.label}
    >
      {meta.letter}
    </div>
  );
}

// Export để channel-header có thể lookup label nếu cần (vd alt text)
export function getPlatformLabel(platform: string): string {
  return META[platform]?.label ?? platform;
}
