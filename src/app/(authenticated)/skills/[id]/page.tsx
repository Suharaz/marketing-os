// Skill detail page — server component.
// Fetch metadata + parse zip tree song song, sau đó render header + tree viewer.

import { notFound, redirect } from 'next/navigation';
import { Download, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/get-session';
import { getUserRole } from '@/lib/auth/get-role';
import { getSkillById, getSkillStoragePath } from '@/lib/queries/skill-lib';
import { readZipTree, SkillFileMissingError } from '@/lib/skill-lib/zip-reader';
import type { ZipEntryNode } from '@/lib/skill-lib/zip-reader';
import { AlertTriangle } from 'lucide-react';
import { resolveSkillPath } from '@/lib/skill-lib/storage';
import { Button } from '@/components/ui/button';
import { FileTree } from './file-tree';
import { DeleteButton } from './delete-button';

interface PageProps {
  params: Promise<{ id: string }>;
}

const DATE_FMT = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});

export default async function SkillDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { id } = await params;
  const [skill, storage, role] = await Promise.all([
    getSkillById(id),
    getSkillStoragePath(id),
    getUserRole(user.userId),
  ]);

  if (!skill || !storage) notFound();

  // File có thể đã mất trên disk nếu Coolify deploy không mount persistent
  // volume — không crash page, để user thấy thông tin metadata + nút delete
  // để dọn row mồ côi.
  let tree: ZipEntryNode[] | null = null;
  let fileMissing = false;
  try {
    tree = readZipTree(resolveSkillPath(storage.storage_path));
  } catch (err) {
    if (err instanceof SkillFileMissingError) {
      fileMissing = true;
    } else {
      throw err; // lỗi khác (zip corrupt, …) vẫn để Next.js error boundary xử
    }
  }

  const isOwner = skill.uploaded_by === user.userId;
  const isAdmin = role === 'admin';
  const canDelete = isOwner || isAdmin;

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <div>
        <Link
          href="/skills"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700"
        >
          <ArrowLeft className="size-3.5" />
          Quay lại danh sách
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-zinc-900 truncate">{skill.name}</h2>
          <p className="text-sm text-zinc-500 mt-0.5 truncate">{skill.original_filename}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
            <span>{formatBytes(skill.size_bytes)}</span>
            <span>·</span>
            <span>{DATE_FMT.format(new Date(skill.created_at))}</span>
            {skill.uploaded_by_name && (
              <>
                <span>·</span>
                <span>Upload bởi {skill.uploaded_by_name}</span>
              </>
            )}
            <span>·</span>
            <span className="font-mono">sha256: {skill.sha256.slice(0, 12)}...</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a href={`/api/skills/${skill.id}/download`} download>
            <Button variant="outline">
              <Download className="size-4" />
              Tải về
            </Button>
          </a>
          {canDelete && <DeleteButton skillId={skill.id} skillName={skill.name} />}
        </div>
      </div>

      {/* Tree + viewer hoặc warning nếu file mất */}
      {fileMissing || !tree ? (
        <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 px-4 py-4 flex items-start gap-3">
          <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 flex-1 min-w-0">
            <p className="font-semibold">File skill không còn trên server.</p>
            <p className="mt-1 text-amber-800">
              Có thể server đã được deploy lại mà volume lưu trữ chưa persist
              (host bind <code>./data/skills</code> chưa được mount, hoặc owner UID
              chưa khớp 1001). Bạn nên xoá row mồ côi này và upload lại file.
            </p>
            <div className="mt-3 flex items-center gap-3">
              {canDelete ? (
                <DeleteButton skillId={skill.id} skillName={skill.name} />
              ) : (
                <p className="text-xs italic text-amber-700">
                  Bạn không phải owner hoặc admin nên không xoá được. Liên hệ admin để dọn.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <FileTree skillId={skill.id} entries={tree} />
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
