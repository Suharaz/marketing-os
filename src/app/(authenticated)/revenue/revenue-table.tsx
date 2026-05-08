import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { RevenueRow } from '@/lib/queries/revenue';
import { DeleteRevenueButton } from './delete-revenue-button';

interface Props {
  rows: RevenueRow[];
}

const dateFmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateTimeFmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const vndFmt = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

function formatDate(iso: string): string {
  try {
    // 'YYYY-MM-DD' anchored to local midnight to avoid the TZ-shift trap
    return dateFmt.format(new Date(iso + 'T00:00:00'));
  } catch {
    return String(iso);
  }
}

function formatDateTime(iso: string): string {
  try {
    return dateTimeFmt.format(new Date(iso));
  } catch {
    return String(iso);
  }
}

function truncate(text: string | null, len: number): string {
  if (!text) return '—';
  return text.length > len ? text.slice(0, len) + '…' : text;
}

export function RevenueTable({ rows }: Props) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ngày</TableHead>
            <TableHead>Kênh</TableHead>
            <TableHead className="text-right">Doanh thu</TableHead>
            <TableHead>Ghi chú</TableHead>
            <TableHead>Người nhập</TableHead>
            <TableHead className="text-right">Tạo lúc</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="text-sm text-zinc-700 whitespace-nowrap">
                {formatDate(row.occurred_date)}
              </TableCell>

              <TableCell>
                {row.account_name ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{row.account_name}</span>
                    {row.platform && (
                      <Badge variant="secondary" className="text-xs capitalize">
                        {row.platform}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </TableCell>

              <TableCell className="text-right font-mono text-sm whitespace-nowrap">
                {vndFmt.format(row.amount_vnd)}
              </TableCell>

              <TableCell className="text-xs text-zinc-500 max-w-[200px]">
                {truncate(row.note, 60)}
              </TableCell>

              <TableCell className="text-xs text-zinc-500">
                {row.created_by_name ?? '—'}
              </TableCell>

              <TableCell className="text-right text-xs text-zinc-500 whitespace-nowrap">
                {formatDateTime(row.created_at)}
              </TableCell>

              <TableCell>
                <DeleteRevenueButton id={row.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
