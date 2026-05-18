// Skill library list page — server component.
// Fetch trang đầu, render grid cards. Load-more để client (sau này nếu cần).

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listSkills } from '@/lib/queries/skill-lib';
import { getCurrentUser } from '@/lib/auth/get-session';
import { getUserRole } from '@/lib/auth/get-role';
import { SkillCard } from './skill-card';
import { UploadButton } from './upload-button';

export const metadata: Metadata = {
  title: 'Thư viện Skill — Marketing OS',
};

const NUMBER_FMT = new Intl.NumberFormat('vi-VN');

export default async function SkillsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [{ items }, role] = await Promise.all([
    listSkills(null),
    getUserRole(user.userId),
  ]);
  const isAdmin = role === 'admin';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Thư viện Skill</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Upload, lưu trữ và preview các skill bundle (.zip / .skill).
          </p>
        </div>
        <UploadButton />
      </div>

      <div className="text-xs text-zinc-500">
        Tổng: <span className="font-semibold text-zinc-700">{NUMBER_FMT.format(items.length)}</span> skill
      </div>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((s) => (
            <SkillCard
              key={s.id}
              skill={s}
              canDelete={isAdmin || s.uploaded_by === user.userId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl bg-white ring-1 ring-zinc-200 px-6 py-12 text-center">
      <p className="text-sm font-medium text-zinc-700">Chưa có skill nào</p>
      <p className="mt-1 text-xs text-zinc-500">
        Click nút "Upload Skill" ở góc trên để bắt đầu.
      </p>
    </div>
  );
}
