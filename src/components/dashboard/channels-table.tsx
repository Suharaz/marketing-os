import Link from 'next/link';
import { cn } from '@/lib/utils';
import { PlatformIcon } from './platform-icon';
import type { ChannelTableRow } from '@/lib/queries/dashboard-channels-table';

// Full-width table dashboard — thay thế ChannelHealthGrid sidebar.
// Cột: Tên kênh | Reach | Tỉ lệ tương tác | Post/KPI | Tăng trưởng.
// Click row → /channels/[id]. Mobile (< md) scroll ngang nhờ overflow-x-auto.

interface Props {
  data: ChannelTableRow[];
  days: number;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString('vi-VN');
}

// Engagement rate color: ≥5% xanh, 2-5% vàng, < 2% đỏ.
function erColor(er: number): string {
  if (er >= 5) return 'text-emerald-600';
  if (er >= 2) return 'text-amber-600';
  return 'text-red-500';
}

// Post/KPI color: ≥80% xanh, 50-80% vàng, < 50% đỏ. KPI=0 thì luôn xanh (tracking tắt).
function postsColor(posts: number, kpi: number): string {
  if (kpi === 0) return 'text-zinc-600';
  const pct = (posts / kpi) * 100;
  if (pct >= 80) return 'text-emerald-600';
  if (pct >= 50) return 'text-amber-600';
  return 'text-red-500';
}

function GrowthCell({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-zinc-400">—</span>;
  }
  const positive = value >= 0;
  const arrow = positive ? '↑' : '↓';
  const colorClass = positive ? 'text-emerald-600' : 'text-red-500';
  return (
    <span className={cn('font-semibold tabular-nums', colorClass)}>
      {arrow} {positive ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  );
}

export function ChannelsTable({ data, days }: Props) {
  return (
    <div className="rounded-xl bg-white ring-1 ring-zinc-200 shadow-sm">
      <div className="flex items-center justify-between p-5 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-700">Chanel</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Hiệu suất từng kênh · {days} ngày qua
          </p>
        </div>
        <Link href="/channels" className="text-xs text-blue-600 hover:underline">
          Xem tất cả →
        </Link>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-zinc-400 py-8 text-center">
          Chưa có data — chờ cron sync đầu tiên
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
                <th className="text-left font-medium px-5 py-2.5">Tên kênh</th>
                <th className="text-right font-medium px-3 py-2.5">Reach</th>
                <th className="text-right font-medium px-3 py-2.5">
                  Tỉ lệ tương tác
                </th>
                <th className="text-right font-medium px-3 py-2.5">Post/KPI</th>
                <th className="text-right font-medium px-5 py-2.5">Tăng trưởng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.map((row) => (
                <tr
                  key={row.accountId}
                  className="hover:bg-zinc-50 transition-colors"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/channels/${row.accountId}`}
                      className="flex items-center gap-2.5 min-w-0"
                    >
                      <PlatformIcon platform={row.platform} badge size={16} />
                      <span className="truncate font-medium text-zinc-800">
                        {row.name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-zinc-700">
                    {formatCompact(row.reach)}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-3 text-right font-semibold tabular-nums',
                      erColor(row.engagementRate)
                    )}
                  >
                    {row.engagementRate.toFixed(1)}%
                  </td>
                  <td
                    className={cn(
                      'px-3 py-3 text-right font-semibold tabular-nums',
                      postsColor(row.postsCount, row.kpiTotal)
                    )}
                  >
                    {row.postsCount}/{row.kpiTotal}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <GrowthCell value={row.growthPercent} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
