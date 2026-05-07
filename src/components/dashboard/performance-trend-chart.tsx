'use client';

import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import type { TrendDataPoint } from '@/lib/queries/dashboard-trend';

interface PerformanceTrendChartProps {
  data: TrendDataPoint[];
  days: number;
}

// Each line: label + color used in legend pill, tooltip row, and stroke.
// Order here drives stacking order in the chart (last drawn → on top).
const SERIES = {
  reach: { label: 'Reach', color: '#3B82F6' },
  followers: { label: 'Followers', color: '#A855F7' },
  posts: { label: 'Posts/day', color: '#10B981' },
} as const;

type SeriesKey = keyof typeof SERIES;

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd/MM');
  } catch {
    return dateStr;
  }
}

function formatLargeNumber(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

// Tooltip pulls original (non-log-padded) values from row.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as TrendDataPoint;
  return (
    <div className="rounded-lg bg-white shadow-md ring-1 ring-zinc-200 px-3 py-2 text-xs space-y-0.5">
      <p className="font-semibold text-zinc-700 mb-1">{formatDate(label)}</p>
      <p style={{ color: SERIES.reach.color }}>
        {SERIES.reach.label}:{' '}
        <span className="tabular-nums font-medium">
          {new Intl.NumberFormat('vi-VN').format(row.reach)}
        </span>
      </p>
      <p style={{ color: SERIES.followers.color }}>
        {SERIES.followers.label}:{' '}
        <span className="tabular-nums font-medium">
          {new Intl.NumberFormat('vi-VN').format(row.followers)}
        </span>
      </p>
      <p style={{ color: SERIES.posts.color }}>
        {SERIES.posts.label}:{' '}
        <span className="tabular-nums font-medium">{row.totalPost}</span>
      </p>
    </div>
  );
}

export function PerformanceTrendChart({ data, days }: PerformanceTrendChartProps) {
  // Toggle each series independently. Click a pill to hide/show.
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    reach: true,
    followers: true,
    posts: true,
  });

  // Linear axes — no padding tricks needed. Use original values directly.
  const chartData = useMemo(() => data, [data]);

  function toggle(key: SeriesKey) {
    setVisible((v) => ({ ...v, [key]: !v[key] }));
  }

  return (
    <div className="rounded-xl bg-white ring-1 ring-zinc-200 shadow-sm p-5">
      {/* Header: title + clickable legend pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-zinc-700">
          Performance Trend — {days} ngày qua
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(SERIES) as SeriesKey[]).map((key) => {
            const s = SERIES[key];
            const on = visible[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                  on
                    ? 'bg-zinc-50 text-zinc-700 ring-1 ring-zinc-200'
                    : 'text-zinc-400 ring-1 ring-zinc-100 hover:bg-zinc-50'
                )}
                aria-pressed={on}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: on ? s.color : '#D4D4D8' }}
                />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-sm text-zinc-400">
          Chưa có data trend
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          {/* margin.top buffers the chart so a peak value doesn't get cropped at the top edge */}
          <LineChart data={chartData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 11, fill: '#94A3B8' }}
              tickLine={false}
              axisLine={false}
            />
            {/* Left axis (linear, start at 0): Reach + Followers */}
            <YAxis
              yAxisId="left"
              domain={[0, 'auto']}
              tick={{ fontSize: 11, fill: '#94A3B8' }}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={formatLargeNumber}
            />
            {/* Right axis (linear, start at 0): Posts/day — labels hidden */}
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 'auto']}
              tick={false}
              tickLine={false}
              axisLine={false}
              width={0}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />

            {visible.reach && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="reach"
                name="reach"
                stroke={SERIES.reach.color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
              />
            )}

            {visible.followers && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="followers"
                name="followers"
                stroke={SERIES.followers.color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
              />
            )}

            {visible.posts && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="totalPost"
                name="posts"
                stroke={SERIES.posts.color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
