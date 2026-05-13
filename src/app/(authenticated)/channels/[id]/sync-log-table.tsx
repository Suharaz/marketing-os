import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { SyncLogEntry } from '@/lib/queries/channel-detail';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { SyncDetailsDialog } from './sync-details-dialog';

interface Props {
  entries: SyncLogEntry[];
}

const STATUS_VARIANT: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  success: 'default',
  error: 'destructive',
  partial: 'secondary',
  running: 'outline',
};

const STATUS_LABEL: Record<string, string> = {
  success: 'Thành công',
  error: 'Lỗi',
  partial: 'Một phần',
  running: 'Đang chạy',
};

function truncateError(msg: string | null, max = 50): string {
  if (!msg) return '—';
  return msg.length > max ? msg.slice(0, max) + '…' : msg;
}

export function SyncLogTable({ entries }: Props) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-zinc-900 mb-4">Lịch sử đồng bộ</h2>

      {entries.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-6">Chưa có lịch sử đồng bộ.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Thời gian</TableHead>
                <TableHead className="text-xs">Loại</TableHead>
                <TableHead className="text-xs">Trạng thái</TableHead>
                <TableHead className="text-xs text-right">Bản ghi</TableHead>
                <TableHead className="text-xs">Lỗi</TableHead>
                <TableHead className="text-xs text-right">Chi tiết</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const timeAgo = formatDistanceToNow(new Date(entry.startedAt), {
                  addSuffix: true,
                  locale: vi,
                });
                const statusVariant = STATUS_VARIANT[entry.status] ?? 'outline';
                const statusLabel = STATUS_LABEL[entry.status] ?? entry.status;
                const errorShort = truncateError(entry.errorMessage);

                return (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-zinc-500 whitespace-nowrap">
                      {timeAgo}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-700">
                      {entry.syncType}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant} className="text-xs">
                        {statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right text-zinc-700">
                      {entry.recordsUpserted ?? '—'}
                    </TableCell>
                    <TableCell
                      className="text-xs text-zinc-500 max-w-[200px] truncate"
                      title={entry.errorMessage ?? undefined}
                    >
                      {errorShort}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.callsCount > 0 ? (
                        <SyncDetailsDialog
                          logId={entry.id}
                          callsCount={entry.callsCount}
                          startedAtLabel={timeAgo}
                        />
                      ) : (
                        <span className="text-xs text-zinc-300">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
