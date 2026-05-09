import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-session';
import { ChangePasswordForm } from './change-password-form';

export const metadata: Metadata = {
  title: 'Tài khoản — Marketing OS',
};

export default async function AccountSettingsPage() {
  // AuthenticatedLayout đã guard, nhưng giữ defence-in-depth ở đây
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="flex flex-col gap-6">
      {/* Block thông tin cơ bản — read-only ở phase này (sẽ làm edit profile sau) */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900 mb-4">
          Thông tin tài khoản
        </h3>
        <dl className="grid grid-cols-[120px_1fr] gap-y-3 text-sm">
          <dt className="text-zinc-500">Họ tên</dt>
          <dd className="text-zinc-900">{user.name || '—'}</dd>
          <dt className="text-zinc-500">Email</dt>
          <dd className="text-zinc-900">{user.email}</dd>
        </dl>
      </section>

      {/* Block đổi mật khẩu */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900 mb-1">
          Đổi mật khẩu
        </h3>
        <p className="text-xs text-zinc-500 mb-4">
          Mật khẩu mới tối thiểu 8 ký tự. Sau khi đổi, bạn vẫn giữ nguyên
          phiên đăng nhập hiện tại.
        </p>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
