// GET /api/skills/[id]   → metadata + file tree (parse zip on demand)
// DELETE /api/skills/[id] → xoá DB row + file disk (owner hoặc admin)

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-session';
import { getUserRole } from '@/lib/auth/get-role';
import {
  getSkillById,
  getSkillStoragePath,
  deleteSkill,
} from '@/lib/queries/skill-lib';
import { readZipTree, SkillFileMissingError } from '@/lib/skill-lib/zip-reader';
import { resolveSkillPath, deleteFile } from '@/lib/skill-lib/storage';

export const runtime = 'nodejs';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: Params): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const skill = await getSkillById(id);
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    // Lazy parse zip — chỉ làm khi user mở detail page
    const storage = await getSkillStoragePath(id);
    if (!storage) {
      return NextResponse.json({ error: 'Storage missing' }, { status: 404 });
    }

    const tree = readZipTree(resolveSkillPath(storage.storage_path));
    return NextResponse.json({ skill, tree });
  } catch (err) {
    if (err instanceof SkillFileMissingError) {
      return NextResponse.json(
        { error: 'File missing on disk', code: err.code },
        { status: 404 },
      );
    }
    console.error('[GET /api/skills/[id]]', err);
    const msg = err instanceof Error ? err.message : 'Failed to load skill';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Params): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const storage = await getSkillStoragePath(id);
    if (!storage) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Permission: owner hoặc admin
    const role = await getUserRole(user.userId);
    const isOwner = storage.uploaded_by === user.userId;
    const isAdmin = role === 'admin';
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete file first — nếu fail vẫn còn DB row để retry; ngược lại
    // có row mồ côi sau khi file đã xoá thì khó recovery.
    await deleteFile(resolveSkillPath(storage.storage_path));
    await deleteSkill(id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/skills/[id]]', err);
    const msg = err instanceof Error ? err.message : 'Delete failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
