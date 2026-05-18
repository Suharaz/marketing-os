// Storage helpers cho skill files. Tách riêng để swap backend dễ dàng —
// hôm nay là local FS, mai có thể là S3 chỉ bằng cách đổi implementation
// các function này, không động vào route handlers.

import { createWriteStream, createReadStream } from 'node:fs';
import { mkdir, stat, unlink, open } from 'node:fs/promises';
import { join, isAbsolute, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

// Default fallback giúp local dev không cần set env. Production luôn set
// SKILL_STORAGE_PATH=/app/storage/skills (Docker volume bind).
const DEFAULT_STORAGE = './storage/skills';

export function getStorageDir(): string {
  const dir = process.env.SKILL_STORAGE_PATH || DEFAULT_STORAGE;
  return isAbsolute(dir) ? dir : resolve(process.cwd(), dir);
}

export async function ensureStorageDir(): Promise<string> {
  const dir = getStorageDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Build absolute path cho 1 skill file. Caller phải đảm bảo `relativePath`
 * là internal-generated (vd `<uuid>.zip`) — NEVER nhận trực tiếp từ user
 * để tránh path traversal.
 */
export function resolveSkillPath(relativePath: string): string {
  const dir = getStorageDir();
  const full = resolve(dir, relativePath);
  // Defense-in-depth: ensure resolved path không escape khỏi storage dir
  if (!full.startsWith(resolve(dir))) {
    throw new Error('Path traversal detected');
  }
  return full;
}

export interface StreamUploadResult {
  bytesWritten: number;
  sha256: string;
}

/**
 * Pipe Web ReadableStream → disk file, vừa hash sha256 + đếm bytes.
 *
 * Vì sao streaming: file có thể vài GB; nếu buffer hết vào RAM thì OOM.
 * `pipeline()` xử lý backpressure tự động — write tốc độ disk, read sẽ
 * chậm lại theo.
 *
 * Vì sao Readable.fromWeb: route handler nhận `req.body` là Web ReadableStream
 * (chuẩn fetch API), nhưng Node's createWriteStream chỉ pipe được Node stream.
 * `Readable.fromWeb` bridge giữa 2 thế giới.
 */
export async function streamToDisk(
  webStream: ReadableStream<Uint8Array>,
  absolutePath: string,
): Promise<StreamUploadResult> {
  const hash = createHash('sha256');
  let bytesWritten = 0;

  const nodeReadable = Readable.fromWeb(webStream as never);

  // Transform: tap mỗi chunk đi qua để update hash + counter, không
  // copy data. async iterator approach giữ code đơn giản hơn Transform class.
  async function* tap(source: AsyncIterable<Buffer>) {
    for await (const chunk of source) {
      hash.update(chunk);
      bytesWritten += chunk.length;
      yield chunk;
    }
  }

  const out = createWriteStream(absolutePath);
  await pipeline(nodeReadable, tap, out);

  return { bytesWritten, sha256: hash.digest('hex') };
}

/**
 * Đọc N byte đầu file (để check magic bytes). Không load toàn bộ file.
 */
export async function readFirstBytes(absolutePath: string, n: number): Promise<Buffer> {
  const fh = await open(absolutePath, 'r');
  try {
    const buf = Buffer.alloc(n);
    const { bytesRead } = await fh.read(buf, 0, n, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

export async function deleteFile(absolutePath: string): Promise<void> {
  try {
    await unlink(absolutePath);
  } catch (err: unknown) {
    // ENOENT = file already gone; coi như success
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

export async function fileExists(absolutePath: string): Promise<boolean> {
  try {
    await stat(absolutePath);
    return true;
  } catch {
    return false;
  }
}

export { createReadStream, join };
