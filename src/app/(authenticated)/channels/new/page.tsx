import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth/get-session';
import { PagePicker } from './page-picker';
import { ManualConnectForm } from './manual-connect-form';

export const metadata: Metadata = {
  title: 'Kết nối kênh mới — Marketing OS',
};

interface PageProps {
  searchParams: Promise<{ step?: string; error?: string }>;
}

export default async function NewChannelPage({ searchParams }: PageProps) {
  const { step = 'connect', error } = await searchParams;

  // ── Step: pick ───────────────────────────────────────────────────────────
  if (step === 'pick') {
    const session = await getSession();
    const oauthData = session.fb_oauth_pages;

    // Expired or missing — send back to connect step
    if (!oauthData || Date.now() > oauthData.expiresAt) {
      session.fb_oauth_pages = undefined;
      await session.save();
      redirect('/channels/new?step=connect&error=session_expired');
    }

    // Consume the session field immediately after reading
    const pages = oauthData.pages;
    session.fb_oauth_pages = undefined;
    await session.save();

    return (
      <div className="max-w-lg mx-auto flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Chọn trang Facebook</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Chọn trang bạn muốn quản lý trong Marketing OS.
          </p>
        </div>
        <PagePicker pages={pages} />
      </div>
    );
  }

  // ── Step: connect (default) ───────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-zinc-900">Kết nối kênh mới</h2>
        <p className="text-sm text-zinc-500 mt-0.5">
          Kết nối trang Facebook để bắt đầu theo dõi hiệu suất.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error === 'session_expired'
            ? 'Phiên OAuth đã hết hạn. Vui lòng thử lại.'
            : error === 'invalid_state'
            ? 'Yêu cầu không hợp lệ (CSRF). Vui lòng thử lại.'
            : error === 'missing_params'
            ? 'Thiếu thông tin OAuth. Vui lòng thử lại.'
            : `Lỗi kết nối: ${decodeURIComponent(error)}`}
        </div>
      )}

      <ManualConnectForm />

      <p className="text-center text-sm text-zinc-400">
        <Link href="/channels" className="hover:underline">
          ← Quay lại danh sách kênh
        </Link>
      </p>
    </div>
  );
}
