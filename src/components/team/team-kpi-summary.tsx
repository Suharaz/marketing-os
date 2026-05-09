import { cn } from '@/lib/utils';
import type { TeamKpiSummary } from '@/lib/queries/team-kpi';

interface TeamKpiSummaryProps {
  data: TeamKpiSummary;
}

// 4 stats card dùng layout giống KpiHeroGrid nhưng metric ngữ nghĩa khác
// (không có sparkline, mỗi card có icon + 1 dòng phụ).
export function TeamKpiSummaryCards({ data }: TeamKpiSummaryProps) {
  const isPositive = data.avgScoreDelta >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <SummaryCard
        icon="👥"
        label="TỔNG THÀNH VIÊN"
        value={data.totalMembers.toString()}
        sub=""
      />

      <SummaryCard
        icon="⭐"
        label="ĐIỂM TRUNG BÌNH"
        value={data.avgScore.toFixed(1)}
        sub={
          // Phase 1: delta = 0 means "no snapshot yet"; UI hides arrow until
          // Phase 2 ships the weekly snapshot table.
          data.avgScoreDelta === 0 ? (
            <span className="text-zinc-400">(coming soon)</span>
          ) : (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-semibold',
                isPositive ? 'text-green-600' : 'text-red-500'
              )}
            >
              {isPositive ? '↑' : '↓'} {Math.abs(data.avgScoreDelta).toFixed(1)} so
              với tuần trước
            </span>
          )
        }
      />

      <SummaryCard
        icon="🏆"
        label="TOP PERFORMER"
        value={data.topPerformer.name}
        valueClass="text-xl"
        sub={
          <span className="text-zinc-500">
            {data.topPerformer.score.toFixed(1)} điểm ·{' '}
            {data.topPerformer.streakWeeks === 0 ? (
              <span className="text-zinc-400">streak (coming soon)</span>
            ) : (
              `${data.topPerformer.streakWeeks} tuần liên tiếp`
            )}
          </span>
        }
      />

      <SummaryCard
        icon="⚠️"
        label="DƯỚI TARGET"
        value={data.belowTarget.toString()}
        accentClass="border-l-4 border-l-rose-400"
        sub={<span className="text-rose-500">cần 1-1 coaching tuần này</span>}
      />
    </div>
  );
}

interface SummaryCardProps {
  icon: string;
  label: string;
  value: string;
  valueClass?: string;
  sub?: React.ReactNode;
  accentClass?: string;
}

function SummaryCard({
  icon,
  label,
  value,
  valueClass,
  sub,
  accentClass,
}: SummaryCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl bg-white p-5 ring-1 ring-zinc-200 shadow-sm',
        accentClass
      )}
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        <span className="text-base">{icon}</span>
        {label}
      </div>

      <div
        className={cn(
          'text-3xl font-bold text-zinc-900 tabular-nums leading-none truncate',
          valueClass
        )}
      >
        {value}
      </div>

      {sub && <div className="text-xs">{sub}</div>}
    </div>
  );
}
