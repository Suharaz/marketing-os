// Server component — renders the 3 metric cards above the post grid.
// Pure presentation: receives pre-computed numbers, formats locale-aware.

import type { LibraryStats } from '@/lib/queries/library-stats';

const NUMBER_FMT = new Intl.NumberFormat('vi-VN');

interface StatsCardsProps {
  stats: LibraryStats;
}

export function LibraryStatsCards({ stats }: StatsCardsProps) {
  const weekDelta = stats.thisWeek - stats.prevWeek;
  const weekDeltaText =
    weekDelta === 0
      ? '↔ ngang tuần trước'
      : weekDelta > 0
      ? `↑ ${NUMBER_FMT.format(weekDelta)} so với tuần trước`
      : `↓ ${NUMBER_FMT.format(Math.abs(weekDelta))} so với tuần trước`;
  const weekDeltaTone =
    weekDelta > 0 ? 'text-emerald-600' : weekDelta < 0 ? 'text-red-600' : 'text-zinc-500';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <StatCard
        label="Tổng content"
        value={NUMBER_FMT.format(stats.total)}
        hint="Khớp bộ lọc hiện tại"
      />
      <StatCard
        label="Published tuần này"
        value={NUMBER_FMT.format(stats.thisWeek)}
        hint={weekDeltaText}
        hintClass={weekDeltaTone}
      />
      <StatCard
        label="Viral content"
        value={NUMBER_FMT.format(stats.viral)}
        hint="ER ≥ 5%"
      />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  hint: string;
  hintClass?: string;
}

function StatCard({ label, value, hint, hintClass }: StatCardProps) {
  return (
    <div className="rounded-xl bg-white ring-1 ring-zinc-200 px-5 py-4">
      <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold text-zinc-900 tabular-nums">{value}</p>
      <p className={`mt-1 text-xs ${hintClass ?? 'text-zinc-500'}`}>{hint}</p>
    </div>
  );
}
