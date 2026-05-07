import { cn } from '@/lib/utils';
import { PlatformIcon } from './platform-icon';
import type { TopPerformerRow } from '@/lib/queries/dashboard-top-performers';

interface Props {
  performers: TopPerformerRow[];
}

// Background tint cho rank chip — gold/silver/bronze cho top 3, neutral cho phần còn lại.
function getRankChip(rank: number): string {
  if (rank === 1) return 'bg-amber-100 text-amber-700 ring-1 ring-amber-200';
  if (rank === 2) return 'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200';
  if (rank === 3) return 'bg-orange-100 text-orange-700 ring-1 ring-orange-200';
  return 'bg-zinc-50 text-zinc-500 ring-1 ring-zinc-100';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function TopPerformersRankedList({ performers }: Props) {
  return (
    <div className="rounded-xl bg-white ring-1 ring-zinc-200 shadow-sm p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-700">Top Performers — Tuần này</h3>
        <a href="/team" className="text-xs text-blue-600 hover:underline">
          View team →
        </a>
      </div>

      {performers.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-zinc-400 italic">Chưa có thành viên nào.</p>
        </div>
      ) : (
        <ol className="flex flex-col divide-y divide-zinc-100 flex-1">
          {performers.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5 first:pt-0">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tabular-nums',
                  getRankChip(p.rank)
                )}
              >
                #{p.rank}
              </span>

              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-600">
                {getInitials(p.name)}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-zinc-800 leading-tight">
                  {p.name}
                </p>
                <p className="flex items-center gap-1 truncate text-[10px] text-zinc-400 mt-0.5">
                  <PlatformIcon platform={p.platform} size={10} />
                  <span className="truncate">{p.role}</span>
                </p>
              </div>

              <span className="text-[11px] text-zinc-500 tabular-nums shrink-0">
                {p.posts} bài
              </span>

              <span className="text-sm font-bold text-zinc-900 tabular-nums shrink-0 w-10 text-right">
                {p.score.toFixed(1)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
