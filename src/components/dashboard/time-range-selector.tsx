'use client';

// Pill-style segmented control for picking the dashboard time range.
// Writes to ?range=N URL param so the Server Component re-renders with new data.

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { TIME_RANGE_OPTIONS, type TimeRangeDays } from '@/lib/dashboard/time-range';
import { cn } from '@/lib/utils';

interface TimeRangeSelectorProps {
  current: TimeRangeDays;
}

const LABELS: Record<TimeRangeDays, string> = {
  7: '7 ngày',
  14: '14 ngày',
  30: '30 ngày',
  90: '90 ngày',
};

export function TimeRangeSelector({ current }: TimeRangeSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setRange(range: TimeRangeDays) {
    if (range === current) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', String(range));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div
      className={cn(
        'inline-flex rounded-lg bg-zinc-100 p-0.5 text-xs',
        isPending && 'opacity-60'
      )}
      role="tablist"
      aria-label="Khung thời gian"
    >
      {TIME_RANGE_OPTIONS.map((opt) => (
        <button
          key={opt}
          type="button"
          role="tab"
          aria-selected={current === opt}
          onClick={() => setRange(opt)}
          disabled={isPending}
          className={cn(
            'px-3 py-1.5 rounded-md font-medium transition-colors',
            current === opt
              ? 'bg-white text-zinc-900 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-700'
          )}
        >
          {LABELS[opt]}
        </button>
      ))}
    </div>
  );
}
