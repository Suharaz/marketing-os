// GET /api/skills/[id]/raw?path=<entry-path>
//
// Stream raw bytes của 1 entry với Content-Type guess theo extension.
// Dùng cho <img>, <video>, hoặc trường hợp text/file/route trả isBinary=true
// nhưng vẫn muốn xem trực tiếp.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-session';
import { getSkillStoragePath } from '@/lib/queries/skill-lib';
import { readZipEntryRaw } from '@/lib/skill-lib/zip-reader';
import { resolveSkillPath } from '@/lib/skill-lib/storage';
import { isSafeZipEntryPath, mimeFromPath } from '@/lib/skill-lib/validate';

export const runtime = 'nodejs';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, ctx: Params): Promise<Response> {
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

    const raw = readZipEntryRaw(resolveSkillPath(storage.storage_path), entryPath);
    if (!raw) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Buffer.subarray để build Uint8Array cho Response body
    return new Response(new Uint8Array(raw.data), {
      status: 200,
      headers: {
        'Content-Type': mimeFromPath(entryPath),
        'Content-Length': String(raw.size),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    console.error('[GET /api/skills/[id]/raw]', err);
    return NextResponse.json({ error: 'Failed to read entry' }, { status: 500 });
  }
}
