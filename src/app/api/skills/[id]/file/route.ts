// GET /api/skills/[id]/file?path=<entry-path>
//
// Đọc 1 file text bên trong zip. Trả về JSON:
//   { content: string, truncated: boolean, isBinary: boolean, size: number }
//
// Giới hạn:
//   - Chỉ render text < 1MB (lib tự cắt).
//   - Binary files trả content rỗng + isBinary=true → UI khuyến nghị download.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-session';
import { getSkillStoragePath } from '@/lib/queries/skill-lib';
import { readZipEntryText } from '@/lib/skill-lib/zip-reader';
import { resolveSkillPath } from '@/lib/skill-lib/storage';
import { isSafeZipEntryPath } from '@/lib/skill-lib/validate';

export const runtime = 'nodejs';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, ctx: Params): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const entryPath = req.nextUrl.searchParams.get('path');
  if (!entryPath || !isSafeZipEntryPath(entryPath)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  try {
    const storage = await getSkillStoragePath(id);
    if (!storage) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    const result = readZipEntryText(resolveSkillPath(storage.storage_path), entryPath);
    if (!result) {
      return NextResponse.json({ error: 'Entry not found in archive' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/skills/[id]/file]', err);
    return NextResponse.json({ error: 'Failed to read entry' }, { status: 500 });
  }
}
