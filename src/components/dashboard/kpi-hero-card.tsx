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

/**
 * Compact a number to "1.5M" / "340K" style with 1-decimal precision.
 * Strips trailing ".0" so 1_000_000 renders as "1M" not "1.0M".
 *
 * Why .toFixed(1) instead of (0): 1_500_000 → toFixed(0) = "2" (rounds up
 * and lies about 50% of the value). 1 decimal preserves the "and a half"
 * meaning users actually care about for revenue and engagement counts.
 */
function compact(value: number): string {
  let scaled: number;
  let suffix: string;
  if (value >= 1_000_000_000) {
    scaled = value / 1_000_000_000;
    suffix = 'B';
  } else if (value >= 1_000_000) {
    scaled = value / 1_000_000;
    suffix = 'M';
  } else if (value >= 1_000) {
    scaled = value / 1_000;
    suffix = 'K';
  } else {
    return new Intl.NumberFormat('vi-VN').format(value);
  }
  const rounded = scaled.toFixed(1);
  const trimmed = rounded.endsWith('.0') ? rounded.slice(0, -2) : rounded;
  return `${trimmed}${suffix}`;
}

function formatValue(value: number, format: KpiFormat): string {
  if (format === 'percent') {
    return `${value.toFixed(2)}%`;
  }
  // number + currency share the same compact rule — only the unit suffix differs
  // (currency rendered without VND symbol here; subtitle/tooltip can show it).
  return compact(value);
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
