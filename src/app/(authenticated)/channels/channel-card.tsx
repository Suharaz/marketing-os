// Channel card — hiển thị các trường có sẵn trong DB.
// Bỏ qua: persona, tier, reach/post, engagement_rate, posting_frequency, owner footer
// (chưa có cột tương ứng trong schema).

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import type { ChannelListItem } from '@/lib/queries/channels-list';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// ─── Platform meta: màu nền icon vuông + label hiển thị ───────────────
const PLATFORM_META: Record<
  string,
  { label: string; bg: string; letter: string }
> = {
  facebook: { label: 'Facebook', bg: 'bg-blue-600', letter: 'f' },
  instagram: { label: 'Instagram', bg: 'bg-pink-500', letter: 'IG' },
  tiktok: { label: 'TikTok', bg: 'bg-zinc-900', letter: 'TT' },
  youtube: { label: 'YouTube', bg: 'bg-red-600', letter: 'YT' },
  threads: { label: 'Threads', bg: 'bg-zinc-800', letter: 'T' },
  zalo: { label: 'Zalo', bg: 'bg-sky-500', letter: 'Z' },
};

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }
> = {
  active: { label: 'Hoạt động', variant: 'default' },
  token_expired: { label: 'Token hết hạn', variant: 'destructive' },
  disconnected: { label: 'Ngắt kết nối', variant: 'secondary' },
};

// ─── Helpers ──────────────────────────────────────────────────────────
function formatCompact(n: number | null): string {
  if (n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString('vi-VN');
}

// engagement_rate trong DB là tỉ lệ (vd 0.054). Render UI: 5.4%.
function formatPercent(rate: number | null): string {
  if (rate === null) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

function healthColor(score: number | null): string {
  if (score === null) return 'text-zinc-400';
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

interface Props {
  channel: ChannelListItem;
}

export function ChannelCard({ channel }: Props) {
  const platform = PLATFORM_META[channel.platform] ?? {
    label: channel.platform,
    bg: 'bg-zinc-500',
    letter: '?',
  };
  const statusCfg =
    STATUS_CONFIG[channel.status] ??
    { label: channel.status, variant: 'outline' as const };

  const syncedAgo = channel.lastSyncedAt
    ? formatDistanceToNow(new Date(channel.lastSyncedAt), {
        addSuffix: true,
        locale: vi,
      })
    : 'Chưa sync';

  return (
    <Link
      href={`/channels/${channel.id}`}
      className="block rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
    >
      {/* ─── Header: icon + name + health score (góc phải) ─── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Icon vuông theo platform */}
          <div
            className={cn(
              'flex size-12 shrink-0 items-center justify-center rounded-lg text-white text-base font-bold',
              platform.bg
            )}
          >
            {platform.letter}
          </div>

          {/* Name + tags */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-zinc-900 truncate">{channel.name}</p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                {platform.label}
              </Badge>
              <Badge variant={statusCfg.variant} className="text-[10px]">
                {statusCfg.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* Health score góc phải — bự nổi bật như mockup */}
        <div className="text-right shrink-0">
          <p className={cn('text-2xl font-bold leading-none', healthColor(channel.healthScore))}>
            {channel.healthScore !== null ? channel.healthScore.toFixed(0) : '—'}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-zinc-400 mt-1">Health</p>
        </div>
      </div>

      {/* ─── Stats row 4 cột: Followers · Reach/post · ER · Sync ─── */}
      <div className="mt-4 grid grid-cols-4 gap-2 border-t border-zinc-100 pt-3">
        <Stat label="Followers" value={formatCompact(channel.followers)} />
        <Stat label="Reach/post" value={formatCompact(channel.avgReachPerPost)} />
        <Stat label="ER" value={formatPercent(channel.avgEngagementRate)} />
        <Stat label="Sync" value={syncedAgo} compact />
      </div>

      {/* ─── Owner footer ─── */}
      <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3">
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">
          Quản lý:
        </span>
        <span className="text-xs font-medium text-zinc-700">
          {channel.ownerName ?? 'Chưa gán'}
        </span>
      </div>
    </Link>
  );
}

// Stat cell — `compact` cho field text dài (sync time) dùng font nhỏ hơn.
function Stat({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div>
      <p
        className={cn(
          compact ? 'text-xs font-medium leading-tight' : 'text-base font-semibold',
          'text-zinc-900'
        )}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-zinc-500 mt-0.5">
        {label}
      </p>
    </div>
  );
}
