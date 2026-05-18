// POST /api/skills/upload — raw binary stream upload, no size limit.
//
// CONVENTION CLIENT:
//   fetch('/api/skills/upload', {
//     method: 'POST',
//     headers: { 'X-File-Name': encodeURIComponent(file.name) },
//     body: file,   // Web File → streamed by fetch
//   })
//
// VÌ SAO KHÔNG DÙNG req.formData():
//   formData() buffer toàn bộ multipart vào RAM trước khi parse → OOM
//   với file lớn. Raw stream + custom header thì pipe thẳng disk được,
//   chỉ giữ vài KB chunk buffer.

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getCurrentUser } from '@/lib/auth/get-session';
import {
  assertValidExtension,
  isZipMagic,
  nameFromFilename,
  slugifyFilename,
} from '@/lib/skill-lib/validate';
import {
  ensureStorageDir,
  resolveSkillPath,
  streamToDisk,
  readFirstBytes,
  deleteFile,
} from '@/lib/skill-lib/storage';
import { insertSkill, generateUniqueSlug } from '@/lib/queries/skill-lib';

export const runtime = 'nodejs';
// Force dynamic — POST mặc định đã dynamic, nhưng khai báo rõ cho ai đọc code.
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!req.body) {
    return NextResponse.json({ error: 'Missing request body' }, { status: 400 });
  }

  const rawName = req.headers.get('x-file-name');
  if (!rawName) {
    return NextResponse.json(
      { error: 'Missing X-File-Name header' },
      { status: 400 },
    );
  }

  let filename: string;
  try {
    filename = decodeURIComponent(rawName);
  } catch {
    return NextResponse.json({ error: 'Invalid X-File-Name encoding' }, { status: 400 });
  }

  try {
    assertValidExtension(filename);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 },
    );
  }

  await ensureStorageDir();

  const id = randomUUID();
  const storagePath = `${id}.zip`;
  const absolutePath = resolveSkillPath(storagePath);

  let bytesWritten = 0;
  let sha256 = '';

  try {
    const result = await streamToDisk(req.body, absolutePath);
    bytesWritten = result.bytesWritten;
    sha256 = result.sha256;

    // Verify magic bytes "PK" — guards against renamed binaries (.exe → .zip)
    const head = await readFirstBytes(absolutePath, 2);
    if (!isZipMagic(head)) {
      await deleteFile(absolutePath);
      return NextResponse.json(
        { error: 'File không phải zip hợp lệ (magic bytes mismatch)' },
        { status: 400 },
      );
    }

    if (bytesWritten === 0) {
      await deleteFile(absolutePath);
      return NextResponse.json({ error: 'Empty file' }, { status: 400 });
    }

    const baseSlug = slugifyFilename(filename);
    const slug = await generateUniqueSlug(baseSlug);
    const name = nameFromFilename(filename);

    const inserted = await insertSkill({
      slug,
      name,
      description: null,
      original_filename: filename,
      size_bytes: bytesWritten,
      sha256,
      storage_path: storagePath,
      uploaded_by: user.userId,
    });

    return NextResponse.json({
      id: inserted.id,
      slug: inserted.slug,
      size_bytes: bytesWritten,
      sha256,
    });
  } catch (err) {
    // Cleanup file mồ côi nếu DB insert / pipe fail
    await deleteFile(absolutePath).catch(() => {});
    console.error('[POST /api/skills/upload]', err);
    const msg = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
