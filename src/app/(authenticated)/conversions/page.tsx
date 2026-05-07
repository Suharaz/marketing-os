import { Metadata } from 'next'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fetchRecentConversions } from '@/lib/queries/conversions'
import { ConversionsTable } from './conversions-table'

export const metadata: Metadata = {
  title: 'Chuyển đổi — Marketing OS',
}

export default async function ConversionsPage() {
  const conversions = await fetchRecentConversions(50)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Conversions</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {conversions.length} bản ghi gần nhất
          </p>
        </div>
        <Link href="/conversions/new" className={cn(buttonVariants())}>
          + Thêm mới
        </Link>
      </div>

      {conversions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-16 text-center">
          <p className="text-zinc-500 text-sm">
            Chưa có conversion nào. Click &apos;Thêm mới&apos; để bắt đầu.
          </p>
        </div>
      ) : (
        <ConversionsTable conversions={conversions} />
      )}
    </div>
  )
}
