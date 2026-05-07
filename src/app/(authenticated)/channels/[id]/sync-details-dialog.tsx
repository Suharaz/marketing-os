'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SyncCallEntry } from '@/lib/queries/channel-detail';

interface Props {
  details: SyncCallEntry[];
  startedAtLabel: string;
}

const REDACT_KEYS = new Set(['access_token', 'input_token']);

function redactParams(params: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    out[k] = REDACT_KEYS.has(k) ? '***REDACTED***' : v;
  }
  return out;
}

function buildUrl(endpoint: string, params: Record<string, string>): string {
  const qs = Object.entries(redactParams(params))
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return qs ? `${endpoint}?${qs}` : endpoint;
}

export function SyncDetailsDialog({ details, startedAtLabel }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <Dialog>
      <DialogTrigger
        className={cn(
          buttonVariants({ variant: 'outline', size: 'sm' }),
          'text-xs h-7 px-2'
        )}
      >
        Chi tiết ({details.length})
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Lịch sử gọi FB API · {startedAtLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="text-xs text-zinc-500 mb-2">
          {details.length} call · token đã ẩn
        </div>

        <ul className="space-y-2">
          {details.map((call, idx) => (
            <li
              key={idx}
              className={`rounded-lg border p-3 text-xs font-mono ${
                call.ok
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-red-200 bg-red-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={call.ok ? 'text-emerald-700' : 'text-red-700'}>
                    {call.ok ? '✓' : '✗'}
                  </span>
                  <span className="font-semibold">{call.endpoint}</span>
                  <span className="text-zinc-500">HTTP {call.httpStatus}</span>
                  <span className="text-zinc-500">{call.durationMs}ms</span>
                </div>
                <button
                  onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                  className="text-blue-600 hover:underline text-[10px]"
                  type="button"
                >
                  {openIdx === idx ? 'Đóng' : 'Xem raw'}
                </button>
              </div>

              <div className="text-[10.5px] text-zinc-700 break-all mb-1">
                <span className="text-zinc-500">URL:</span>{' '}
                <code>{buildUrl(call.endpoint, call.params)}</code>
              </div>

              {call.error && (
                <div className="text-[11px] text-red-700 mt-1">
                  <span className="font-semibold">Error:</span> {call.error}
                </div>
              )}

              {openIdx === idx && (
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-white border border-zinc-200 p-2 text-[10.5px] text-zinc-800 whitespace-pre-wrap break-all">
                  {JSON.stringify(call.responseSample, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
