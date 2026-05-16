// Channel card — list view tại /channels.
//
// Sau revamp:
//   - Bỏ 2 badge Facebook + Hoạt động (icon vuông + dot status đã đủ semantic)
//   - StatusDot xanh ripple/halo khi active (animate-ping)
//   - Page ID + nút copy clipboard (CopyIdButton tự stopPropagation để không trigger <Link>)
//   - Sync time dời xuống dưới Page ID (không còn trong stats grid)
//   - Stats grid cell 4: Sync → Lead (30 ngày qua từ landing_page_conversion)
//   - HealthTooltip ⓘ hover hiện công thức 4 sub-score

import Link from 'next/link';
import type { ChannelListItem } from '@/lib/queries/channels-list';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { StatusDot } from './_components/status-dot';
import { CopyIdButton } from './_components/copy-id-button';
import { HealthTooltip } from './_components/health-tooltip';
import { PlatformIcon } from './_components/platform-icon';

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
      {/* ─── Header: icon + name/id/sync + health (góc phải) ─── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <PlatformIcon platform={channel.platform} size="md" />

          <div className="flex-1 min-w-0">
            {/* Row 1: status dot + tên page */}
            <div className="flex items-center gap-2">
              <StatusDot status={channel.status} />
              <p className="font-semibold text-zinc-900 truncate">{channel.name}</p>
            </div>

            {/* Row 2: Page ID + copy */}
            <p className="mt-1 text-xs text-zinc-500 font-mono flex items-center min-w-0">
              <span className="truncate">ID: {channel.externalId}</span>
              <CopyIdButton value={channel.externalId} />
            </p>

            {/* Row 3: Sync time (đã rời khỏi stats grid) */}
            <p className="text-xs text-zinc-500 mt-0.5">Sync: {syncedAgo}</p>
          </div>
        </div>

        {/* Health score góc phải — số bự + tooltip công thức */}
        <div className="text-right shrink-0">
          <p
            className={cn(
              'text-2xl font-bold leading-none',
              healthColor(channel.healthScore)
            )}
          >
            {channel.healthScore !== null ? channel.healthScore.toFixed(0) : '—'}
          </p>
          <div className="flex items-center justify-end gap-1 mt-1">
            <p className="text-[10px] uppercase tracking-wide text-zinc-400">Health</p>
            <HealthTooltip />
          </div>
        </div>
      </div>

      {/* ─── Stats row 4 cột: Followers · Reach/post · ER · Lead ─── */}
      <div className="mt-4 grid grid-cols-4 gap-2 border-t border-zinc-100 pt-3">
        <Stat label="Followers" value={formatCompact(channel.followers)} />
        <Stat label="Reach/post" value={formatCompact(channel.avgReachPerPost)} />
        <Stat label="ER" value={formatPercent(channel.avgEngagementRate)} />
        <Stat label="Lead" value={formatCompact(channel.lead30d)} />
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-base font-semibold text-zinc-900 tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-zinc-500 mt-0.5">
        {label}
      </p>
    </div>
  );
}
