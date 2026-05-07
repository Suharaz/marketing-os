import { cn } from '@/lib/utils';

export type KpiFormat = 'number' | 'percent' | 'currency';

interface KpiHeroCardProps {
  title: string;
  icon: string;
  value: number;
  prevValue: number;
  format: KpiFormat;
  subtitle: string;
  accentClass?: string;
  // Tiny inline trend used by the right-side mini chart.
  // Keep length small (≤ 14 points). Empty array hides the chart.
  sparkline?: number[];
  sparklineColor?: string;
}

function formatValue(value: number, format: KpiFormat): string {
  if (format === 'currency') {
    // Compact VND for KPI cards: 340.000.000 → "340M"
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return new Intl.NumberFormat('vi-VN').format(value);
  }
  if (format === 'percent') {
    return `${value.toFixed(2)}%`;
  }
  // number — compact for large values
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('vi-VN').format(value);
}

// Build an SVG polyline path from a numeric series. Coordinates are
// normalized to a 60×24 viewBox so the chart scales cleanly.
function buildSparklinePath(data: number[]): string {
  if (data.length < 2) return '';
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // avoid /0 when all values equal
  const stepX = 60 / (data.length - 1);
  return data
    .map((v, i) => {
      const x = (i * stepX).toFixed(2);
      // Invert Y because SVG y grows downward; pad 2px top/bottom.
      const y = (22 - ((v - min) / range) * 20).toFixed(2);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

export function KpiHeroCard({
  title,
  icon,
  value,
  prevValue,
  format,
  subtitle,
  accentClass,
  sparkline,
  sparklineColor = '#3B82F6',
}: KpiHeroCardProps) {
  const delta =
    prevValue !== 0 ? ((value - prevValue) / prevValue) * 100 : value > 0 ? 100 : 0;
  const isPositive = delta >= 0;
  const path = sparkline && sparkline.length >= 2 ? buildSparklinePath(sparkline) : '';

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl bg-white p-5 ring-1 ring-zinc-200 shadow-sm',
        accentClass
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          <span className="text-base">{icon}</span>
          {title}
        </div>
        {/* Sparkline — fixed 60×24 viewBox, scales via width=full of container */}
        {path && (
          <svg
            viewBox="0 0 60 24"
            className="h-6 w-16 shrink-0"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path
              d={path}
              fill="none"
              stroke={sparklineColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      <div className="text-3xl font-bold text-zinc-900 tabular-nums leading-none">
        {formatValue(value, format)}
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span
          className={cn(
            'inline-flex items-center gap-0.5 font-semibold',
            isPositive ? 'text-green-600' : 'text-red-500'
          )}
        >
          {isPositive ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}%
        </span>
        <span className="text-zinc-400">{subtitle}</span>
      </div>
    </div>
  );
}
