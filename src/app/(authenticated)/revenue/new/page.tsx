import { Metadata } from 'next';
import Link from 'next/link';
import { fetchAccountOptions } from '@/lib/queries/revenue';
import { RevenueForm } from './revenue-form';

export const metadata: Metadata = {
  title: 'Thêm doanh thu — Marketing OS',
};

export default async function NewRevenuePage() {
  // Server-side fetch of accounts so the dropdown is populated on first paint
  // (no client-side flash/spinner). Form re-uses the list as static prop.
  const accounts = await fetchAccountOptions();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <Link
          href="/revenue"
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Quay lại
        </Link>
        <h1 className="text-xl font-bold text-zinc-900 mt-2">Thêm doanh thu</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Nhập 1 bản ghi doanh thu cho 1 kênh trong 1 ngày cụ thể.
        </p>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-12 text-center">
          <p className="text-zinc-500 text-sm">
            Chưa có kênh nào active. Hãy kết nối ít nhất 1 kênh trước.
          </p>
        </div>
      ) : (
        <RevenueForm accounts={accounts} />
      )}
    </div>
  );
}
