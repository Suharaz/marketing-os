// Card hiển thị 1 skill trong list. Server component cho phần content;
// nếu user có quyền xoá, render thêm 1 client DeleteButton (variant icon)
// ở góc phải. Delete button nằm OUTSIDE Link để click không trigger nav.

import Link from 'next/link';
import { FileArchive, User } from 'lucide-react';
import type { SkillListItem } from '@/lib/queries/skill-lib';
import { DeleteButton } from './[id]/delete-button';

const DATE_FMT = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

interface SkillCardProps {
  skill: SkillListItem;
  canDelete: boolean;
}

export function SkillCard({ skill, canDelete }: SkillCardProps) {
  return (
    <div className="group relative rounded-xl bg-white ring-1 ring-zinc-200 hover:ring-blue-400 hover:shadow-sm transition-all">
      <Link
        href={`/skills/${skill.id}`}
        className="block p-4"
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 size-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <FileArchive className="size-5 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-zinc-900 truncate group-hover:text-blue-700 pr-7">
              {skill.name}
            </h3>
            <p className="text-xs text-zinc-500 truncate mt-0.5">
              {skill.original_filename}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
              <span>{formatBytes(skill.size_bytes)}</span>
              <span>·</span>
              <span>{DATE_FMT.format(new Date(skill.created_at))}</span>
              {skill.uploaded_by_name && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <User className="size-3" />
                    {skill.uploaded_by_name}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* Delete icon — absolute, hover-shown. preventDefault + stopPropagation
          ở chính DeleteButton để click không nhảy vào /skills/[id]. */}
      {canDelete && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DeleteButton
            skillId={skill.id}
            skillName={skill.name}
            variant="icon"
            redirectAfter={false}
          />
        </div>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
