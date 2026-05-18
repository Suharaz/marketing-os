// GET /api/skills/[id]/download — stream file gốc về client.
// Set Content-Disposition để browser tải về với tên file gốc thay vì <uuid>.zip.

import { NextRequest, NextResponse } from 'next/server';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { getCurrentUser } from '@/lib/auth/get-session';
import { getSkillStoragePath } from '@/lib/queries/skill-lib';
import { createReadStream, resolveSkillPath } from '@/lib/skill-lib/storage';

export const runtime = 'nodejs';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: Params): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  try {
    const storage = await getSkillStoragePath(id);
    if (!storage) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const fullPath = resolveSkillPath(storage.storage_path);
    const st = await stat(fullPath); // 404 nếu file mất trên disk

    // Stream Node → Web stream. Tránh load full file vào RAM khi user
    // tải file vài GB.
    const nodeStream = createReadStream(fullPath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    // Filename gốc có thể chứa Unicode (tiếng Việt) → dùng RFC 5987 syntax
    // `filename*=UTF-8''<encoded>` để browser hiển thị đúng.
    const safeName = encodeURIComponent(storage.original_filename);

    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': String(st.size),
        'Content-Disposition': `attachment; filename="${id}.zip"; filename*=UTF-8''${safeName}`,
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (err) {
    console.error('[GET /api/skills/[id]/download]', err);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
