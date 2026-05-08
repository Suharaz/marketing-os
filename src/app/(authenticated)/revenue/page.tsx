import { Metadata } from 'next';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getRecentRevenue } from '@/lib/cache/dashboard-cache';
import { RevenueTable } from './revenue-table';

export const metadata: Metadata = {
  title: 'Doanh thu — Marketing OS',
};

export default async function RevenuePage() {
  const rows = await getRecentRevenue(50);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Doanh thu</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Nhập tay theo kênh — {rows.length} bản ghi gần nhất
          </p>
        </div>
        <Link href="/revenue/new" className={cn(buttonVariants())}>
          + Thêm mới
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-16 text-center">
          <p className="text-zinc-500 text-sm">
            Chưa có dữ liệu. Bấm &apos;Thêm mới&apos; để bắt đầu.
          </p>
        </div>
      ) : (
        <RevenueTable rows={rows} />
      )}
    </div>
  );
}
