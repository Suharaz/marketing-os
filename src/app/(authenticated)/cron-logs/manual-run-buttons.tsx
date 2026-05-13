'use client';

// Manual-run controls — admin clicks a button → POST /api/admin/run-job → wait
// → refresh page to show the new log row. Useful for verifying cron code works
// independently of the scheduler (if auto-fire fails in prod).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Play, Loader2 } from 'lucide-react';

type JobName = 'page_insights' | 'posts' | 'health' | 'ladipage';

const JOBS: { name: JobName; label: string }[] = [
  { name: 'page_insights', label: 'Page insights' },
  { name: 'posts', label: 'Posts ingestion' },
  { name: 'health', label: 'Health recompute' },
  { name: 'ladipage', label: 'Ladipage sync' },
];

export function ManualRunButtons() {
  const router = useRouter();
  const [running, setRunning] = useState<JobName | null>(null);

  async function trigger(job: JobName) {
    if (running) return;
    setRunning(job);
    const t0 = Date.now();
    try {
      const res = await fetch('/api/admin/run-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job }),
      });
      const data = await res.json();
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      if (data.ok) {
        toast.success(`${job} chạy xong sau ${elapsed}s`);
        router.refresh();
      } else {
        toast.error(`${job} lỗi: ${data.error ?? 'unknown'}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      toast.error(`${job} lỗi: ${msg}`);
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {JOBS.map((j) => {
        const isThisRunning = running === j.name;
        const disabled = running !== null;
        return (
          <button
            key={j.name}
            type="button"
            disabled={disabled}
            onClick={() => trigger(j.name)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isThisRunning ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            {isThisRunning ? `Đang chạy ${j.label}...` : `Chạy ${j.label}`}
          </button>
        );
      })}
    </div>
  );
}
