'use client';

// Tooltip giải thích công thức Health Score khi hover icon ⓘ.
//
// Trọng số đọc TRỰC TIẾP từ app/src/lib/health/compute-scores.ts (line 112):
//   health = (2/9)*er + (1/6)*consistency + (1/9)*growth + (1/2)*reach
// Quy đổi %:
//   - Reach: 1/2     = 50.0%
//   - ER:    2/9     ≈ 22.2%
//   - Consistency: 1/6 ≈ 16.7%
//   - Growth: 1/9    ≈ 11.1%
// Nếu compute-scores.ts đổi trọng số → MUST update tooltip này (không import được số runtime vì chỉ là phép tính).

import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SubScore {
  label: string;
  weight: string;
  benchmark: string;
}

const SUB_SCORES: SubScore[] = [
  { label: 'Reach Score', weight: '50.0%', benchmark: 'reach rate / 30%' },
  { label: 'ER Score', weight: '22.2%', benchmark: 'avg ER / 3%' },
  { label: 'Consistency', weight: '16.7%', benchmark: 'posts / 7 per week' },
  { label: 'Growth Score', weight: '11.1%', benchmark: '±5% followers/week' },
];

interface Props {
  className?: string;
}

export function HealthTooltip({ className }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger
        // Stop click bubble vì có thể nằm trong <Link> card
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className={cn(
          'inline-flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-600 cursor-help',
          className
        )}
        aria-label="Công thức tính Health Score"
      >
        <InfoIcon />
      </TooltipTrigger>
      <TooltipContent className="w-72 p-3">
        <p className="font-semibold mb-2 text-zinc-50">Công thức Health Score</p>
        <ul className="space-y-1.5">
          {SUB_SCORES.map((s) => (
            <li key={s.label} className="flex items-baseline justify-between gap-3">
              <span className="text-zinc-100">{s.label}</span>
              <span className="text-zinc-400 text-[10px] tabular-nums whitespace-nowrap">
                {s.weight} · {s.benchmark}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 pt-2 border-t border-zinc-700 text-[10px] text-zinc-400">
          Trung bình 30 ngày · Recompute 03:00 hàng ngày
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

function InfoIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
