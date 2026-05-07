import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { ConversionRow } from '@/lib/queries/conversions'
import { DeleteConversionButton } from './delete-conversion-button'

interface Props {
  conversions: ConversionRow[]
}

const dtFmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const vndFmt = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

function formatDate(iso: string): string {
  try {
    return dtFmt.format(new Date(iso))
  } catch {
    return iso
  }
}

function formatVnd(amount: number): string {
  return vndFmt.format(amount)
}

function truncate(text: string | null, len: number): string {
  if (!text) return '—'
  return text.length > len ? text.slice(0, len) + '…' : text
}

export function ConversionsTable({ conversions }: Props) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Thời gian</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Bài viết</TableHead>
            <TableHead>Kênh chuyển đổi</TableHead>
            <TableHead className="text-right">Số lượng</TableHead>
            <TableHead className="text-right">Doanh thu (VND)</TableHead>
            <TableHead>Ghi chú</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {conversions.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="text-xs text-zinc-500 whitespace-nowrap">
                {formatDate(row.occurred_at)}
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

              <TableCell className="max-w-[180px]">
                {row.post_content ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-zinc-600 truncate">
                      {truncate(row.post_content, 60)}
                    </span>
                    {row.post_permalink && (
                      <a
                        href={row.post_permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700 shrink-0"
                        title="Xem bài viết"
                      >
                        ↗
                      </a>
                    )}
                  </div>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </TableCell>

              <TableCell className="text-sm">{row.channel_label}</TableCell>

              <TableCell className="text-right font-mono text-sm">
                {row.conversion_count}
              </TableCell>

              <TableCell className="text-right font-mono text-sm whitespace-nowrap">
                {formatVnd(row.revenue_vnd)}
              </TableCell>

              <TableCell className="text-xs text-zinc-500 max-w-[160px]">
                {truncate(row.note, 50)}
              </TableCell>

              <TableCell>
                <DeleteConversionButton id={row.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
