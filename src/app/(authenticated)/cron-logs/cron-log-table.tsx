'use client';

// Client table — server-rendered rows nhưng cần useState cho expand/collapse
// nên đặt riêng. Server page truyền rows xuống dưới dạng prop.

import { Fragment, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import type { SyncTypeT, SyncStatusT } from '@/lib/db-types';
import type { CronHistoryRow } from '@/lib/queries/cron-history';
import type { CallEntry } from '@/lib/sync/call-context';

const JOB_LABEL: Record<SyncTypeT, string> = {
  page_insights: 'Page insights',
  posts: 'Posts ingestion',
  health_recompute: 'Health recompute',
  manual_refresh: 'Manual refresh',
  ladipage: 'Ladipage sync',
};

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

function StatusBadge({ status }: { status: SyncStatusT }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="size-3" /> Thành công
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 border border-red-200">
        <XCircle className="size-3" /> Lỗi
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
      <Loader2 className="size-3 animate-spin" /> Đang chạy
    </span>
  );
}

export function CronLogTable({ rows }: { rows: CronHistoryRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-zinc-500">
        Chưa có lần chạy nào — thử bỏ filter hoặc đợi cron tiếp theo.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-zinc-50">
          <TableHead className="w-8"></TableHead>
          <TableHead>Thời điểm</TableHead>
          <TableHead>Job</TableHead>
          <TableHead>Account</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead className="text-right">Bản ghi</TableHead>
          <TableHead className="text-right">Thời gian</TableHead>
          <TableHead>API calls</TableHead>
          <TableHead>Lỗi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const isOpen = expanded.has(r.id);
          const callCount = r.details?.length ?? 0;
          const hasDetails = r.details !== null;
          return (
            <Fragment key={r.id}>
              <TableRow
                className="cursor-pointer"
                onClick={() => toggle(r.id)}
              >
                <TableCell>
                  {hasDetails ? (
                    isOpen ? (
                      <ChevronDown className="size-4 text-zinc-500" />
                    ) : (
                      <ChevronRight className="size-4 text-zinc-500" />
                    )
                  ) : (
                    <span className="inline-block size-4" />
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs text-zinc-600">
                  {formatTime(r.startedAt)}
                </TableCell>
                <TableCell className="text-sm text-zinc-900">
                  {JOB_LABEL[r.syncType] ?? r.syncType}
                </TableCell>
                <TableCell className="text-sm text-zinc-700">
                  {r.accountName ?? (r.accountId ? '— (deleted)' : '— (batch)')}
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-zinc-700">
                  {r.recordsUpserted}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-zinc-600">
                  {formatDuration(r.durationMs)}
                </TableCell>
                <TableCell className="text-xs text-zinc-600">
                  {hasDetails ? `${callCount} call${callCount === 1 ? '' : 's'}` : '—'}
                </TableCell>
                <TableCell
                  className="text-xs text-red-600 max-w-[260px] truncate"
                  title={r.errorMessage ?? undefined}
                >
                  {r.errorMessage ?? ''}
                </TableCell>
              </TableRow>
              {isOpen && hasDetails && (
                <TableRow className="bg-zinc-50">
                  <TableCell colSpan={9} className="p-0">
                    <CallDetails calls={r.details ?? []} />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

function CallDetails({ calls }: { calls: CallEntry[] }) {
  if (calls.length === 0) {
    return (
      <div className="p-4 text-xs text-zinc-500 italic">
        Job này không gọi external API (vd: DB-only như health_recompute).
      </div>
    );
  }
  return (
    <div className="px-6 py-4 space-y-2 border-t border-zinc-200">
      <p className="text-xs font-medium text-zinc-700">
        {calls.length} API call{calls.length === 1 ? '' : 's'}
      </p>
      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-zinc-100">
            <tr>
              <th className="text-left px-3 py-1.5 font-medium text-zinc-600">#</th>
              <th className="text-left px-3 py-1.5 font-medium text-zinc-600">Endpoint</th>
              <th className="text-left px-3 py-1.5 font-medium text-zinc-600">HTTP</th>
              <th className="text-right px-3 py-1.5 font-medium text-zinc-600">Time</th>
              <th className="text-left px-3 py-1.5 font-medium text-zinc-600">Params</th>
              <th className="text-left px-3 py-1.5 font-medium text-zinc-600">Error</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {calls.map((c, idx) => (
              <tr key={idx} className="border-t border-zinc-100">
                <td className="px-3 py-1.5 text-zinc-500">{idx + 1}</td>
                <td className="px-3 py-1.5 text-zinc-900">{c.endpoint}</td>
                <td
                  className={`px-3 py-1.5 ${
                    c.ok ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {c.httpStatus}
                </td>
                <td className="px-3 py-1.5 text-right text-zinc-700">
                  {c.durationMs}ms
                </td>
                <td className="px-3 py-1.5 text-zinc-600 max-w-[280px] truncate">
                  {Object.entries(c.params)
                    .map(([k, v]) => `${k}=${v}`)
                    .join('&')}
                </td>
                <td className="px-3 py-1.5 text-red-600 max-w-[200px] truncate">
                  {c.error ?? ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
