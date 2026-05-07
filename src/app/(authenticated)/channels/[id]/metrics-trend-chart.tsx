'use client';

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { ChannelMetricDay } from '@/lib/queries/channel-detail';

interface Props {
  data: ChannelMetricDay[];
}

const LABELS: Record<string, string> = {
  followers: 'Tổng followers',
  reach: 'Reach (lượt tiếp cận)',
  posts: 'Bài đăng',
};

function formatLargeNumber(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

// Tooltip đọc value GỐC từ payload.payload[name] — không phải display value.
// Nhờ vậy `0` hiện đúng là "0", không phải "1" của display field.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg bg-white shadow-md ring-1 ring-zinc-200 px-3 py-2 text-xs">
      <p className="font-semibold text-zinc-700 mb-1">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any) => {
        const original = row[entry.name] ?? 0;
        return (
          <p key={entry.name} style={{ color: entry.color }}>
            {LABELS[entry.name] ?? entry.name}:{' '}
            {new Intl.NumberFormat('vi-VN').format(original)}
          </p>
        );
      })}
    </div>
  );
}

export function MetricsTrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900 mb-1">Xu hướng 7 ngày qua</h2>
        <p className="text-xs text-zinc-500 mb-4">
          Tổng followers (snapshot hiện tại) · Reach (lượt tiếp cận) · Bài đăng đăng trong ngày
        </p>
        <p className="text-sm text-zinc-400 text-center py-8">Chưa có dữ liệu metrics.</p>
      </div>
    );
  }

  // Display fields cho log scale: 0 → 1 (log10(1) = 0, nằm đáy chart).
  // Giữ followers/reach gốc trên row để tooltip đọc đúng giá trị thật.
  const chartData = data.map((d) => ({
    date: format(parseISO(d.date), 'dd/MM', { locale: vi }),
    followers: d.followers ?? 0,
    reach: d.totalReach ?? 0,
    posts: d.postsCount ?? 0,
    followersDisplay: (d.followers ?? 0) > 0 ? d.followers! : 1,
    reachDisplay: (d.totalReach ?? 0) > 0 ? d.totalReach! : 1,
  }));

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-zinc-900 mb-1">Xu hướng 7 ngày qua</h2>
      <p className="text-xs text-zinc-500 mb-4">
        Followers (snapshot hiện tại, áp dụng cho mọi ngày) · Reach (lượt tiếp cận trong ngày) · Bài đăng đăng trong ngày
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          {/* Trục trái: log scale cho followers (k-M) và reach (k-100k)
              cùng hiển thị rõ dù chênh lệch order-of-magnitude. */}
          <YAxis
            yAxisId="left"
            scale="log"
            domain={[1, 'auto']}
            allowDataOverflow
            tick={{ fontSize: 11, fill: '#3b82f6' }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={formatLargeNumber}
          />
          {/* Trục phải: linear cho posts. Ẩn tick labels — giá trị đọc qua tooltip. */}
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={false}
            tickLine={false}
            axisLine={false}
            width={0}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value: string) => LABELS[value] ?? value}
            iconType="circle"
            iconSize={8}
          />
          {/* dataKey trỏ display field log-safe; name giữ key gốc cho tooltip/legend. */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="followersDisplay"
            name="followers"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="reachDisplay"
            name="reach"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          {/* Posts giữ trục phải linear, bật dot để thấy rõ từng ngày */}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="posts"
            name="posts"
            stroke="#fb923c"
            strokeWidth={2}
            dot={{ r: 3, fill: '#fb923c' }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
