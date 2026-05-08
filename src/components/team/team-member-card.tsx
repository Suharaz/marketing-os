import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { TeamMemberKpi, MemberStatus } from '@/lib/queries/team-kpi';
import { TeamRadarChart } from './team-radar-chart';

interface TeamMemberCardProps {
  member: TeamMemberKpi;
  /** Optional action slot rendered in the header (e.g. delete button). */
  action?: ReactNode;
}

// Style của status badge — match palette với radar polygon trong cùng card.
const STATUS_STYLE: Record<
  MemberStatus,
  { label: string; cls: string }
> = {
  top: {
    label: 'TOP',
    cls: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  },
  good: {
    label: 'TỐT',
    cls: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
  },
  coach: {
    label: 'CẦN COACH',
    cls: 'bg-rose-100 text-rose-700 ring-1 ring-rose-200',
  },
};

export function TeamMemberCard({ member, action }: TeamMemberCardProps) {
  const status = STATUS_STYLE[member.status];

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-white p-5 ring-1 ring-zinc-200 shadow-sm">
      {/* Header — avatar + name + role + status */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white',
            member.avatarColor
          )}
        >
          {member.initials}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-900 leading-tight">
            {member.name}
          </p>
          <p className="truncate text-[11px] text-zinc-400 mt-0.5">
            {member.roleLabel}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          {member.rank === 1 && (
            <span className="text-[10px] font-bold text-amber-600 leading-none">
              #1
            </span>
          )}
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold',
              status.cls
            )}
          >
            {status.label}
          </span>
          {action}
        </div>
      </div>

      {/* Body — radar (left) + 6 metrics (right) */}
      <div className="grid grid-cols-[140px_1fr] gap-3 items-center">
        <TeamRadarChart
          dimensions={member.radar}
          status={member.status}
          size={140}
        />

        <ul className="grid grid-cols-2 gap-x-3 gap-y-2">
          {member.metrics.map((m, i) => (
            <li key={i} className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-[11px] text-zinc-500 truncate">
                {m.label}
              </span>
              <span className="text-xs font-semibold text-zinc-900 tabular-nums shrink-0">
                {m.value}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer tags */}
      {member.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {member.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-100 text-[10px] font-medium text-zinc-600"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
