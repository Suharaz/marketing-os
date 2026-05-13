'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import type { SyncCallEntry } from '@/lib/queries/channel-detail';

interface Props {
  /** UUID of the api_sync_log row — details fetched on demand */
  logId: string;
  /** Pre-computed jsonb_array_length from the parent list query.
   *  Used in the button label so user knows how many calls before opening. */
  callsCount: number;
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

type DetailState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; calls: SyncCallEntry[] }
  | { status: 'error'; message: string };

export function SyncDetailsDialog({ logId, callsCount, startedAtLabel }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [state, setState] = useState<DetailState>({ status: 'idle' });

  // Fire fetch lần đầu user mở dialog. Tránh kéo cả JSONB vào page payload.
  function onOpenChange(open: boolean) {
    if (open && state.status === 'idle') {
      setState({ status: 'loading' });
      fetch(`/api/sync-logs/${logId}/details`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as { details: SyncCallEntry[] | null };
          setState({ status: 'loaded', calls: data.details ?? [] });
        })
        .catch((err) => {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Load failed',
          });
        });
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange}>
      <DialogTrigger
        className={cn(
          buttonVariants({ variant: 'outline', size: 'sm' }),
          'text-xs h-7 px-2'
        )}
      >
        Chi tiết ({callsCount})
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Lịch sử gọi FB API · {startedAtLabel}
          </DialogTitle>
        </DialogHeader>

        {state.status === 'loading' && (
          <div className="flex items-center gap-2 text-xs text-zinc-500 py-6 justify-center">
            <Loader2 className="size-3 animate-spin" /> Đang tải chi tiết...
          </div>
        )}

        {state.status === 'error' && (
          <div className="text-xs text-red-600 py-6 text-center">
            Lỗi tải chi tiết: {state.message}
          </div>
        )}

        {state.status === 'loaded' && (
          <>
            <div className="text-xs text-zinc-500 mb-2">
              {state.calls.length} call · token đã ẩn
            </div>

            <ul className="space-y-2">
              {state.calls.map((call, idx) => (
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
