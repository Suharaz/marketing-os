import { Metadata } from 'next'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { db } from '@/lib/db'
import { ConversionForm } from './conversion-form'

export const metadata: Metadata = {
  title: 'Thêm conversion — Marketing OS',
}

export interface AccountOption {
  id: string
  name: string
  platform: string
}

export default async function NewConversionPage() {
  const res = await db.query<AccountOption>(
    `SELECT id, name, platform
     FROM social_account
     WHERE status = 'active'
     ORDER BY name ASC`
  )
  const accounts = res.rows

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Thêm conversion mới</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Nhập thông tin chuyển đổi thủ công
          </p>
        </div>
        <Link
          href="/conversions"
          className={cn(buttonVariants({ variant: 'outline' }))}
        >
          Hủy
        </Link>
      </div>

      <ConversionForm accounts={accounts} />
    </div>
  )
}
