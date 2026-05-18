// Wrapper quanh adm-zip cho 2 thao tác duy nhất ta cần:
//   1. List toàn bộ entries → file tree
//   2. Đọc nội dung 1 entry (text) on-demand
//
// adm-zip load toàn bộ central directory vào RAM khi `new AdmZip(path)` được
// gọi → fine cho file zip vừa (vài trăm MB). Nếu sau này có user upload zip
// 10GB và list chậm, có thể đổi sang `yauzl` (streaming) — nhưng giờ KISS.

import AdmZip from 'adm-zip';

export interface ZipEntryNode {
  path: string;              // full path trong zip, vd `skills/foo/bar.md`
  name: string;              // basename
  isDirectory: boolean;
  size: number;              // uncompressed size (bytes); 0 cho directory
}

/**
 * List toàn bộ entries của zip dưới dạng flat array. UI tự build tree từ
 * mảng này bằng cách split path theo `/`. Trả flat dễ serialize JSON hơn.
 */
export function readZipTree(absolutePath: string): ZipEntryNode[] {
  const zip = new AdmZip(absolutePath);
  return zip.getEntries().map((e) => ({
    path: e.entryName,
    name: e.name || e.entryName.split('/').filter(Boolean).pop() || e.entryName,
    isDirectory: e.isDirectory,
    size: e.header.size,
  }));
}

export interface EntryReadResult {
  content: string;
  truncated: boolean;        // true nếu đã cắt theo MAX_TEXT_BYTES
  isBinary: boolean;         // true nếu detect binary → caller không nên render text
  size: number;              // raw size của entry
}

const MAX_TEXT_BYTES = 1_000_000;   // 1MB — đủ cho hầu hết source code

/**
 * Đọc 1 entry và trả về string. Detect binary bằng null-byte heuristic
 * (giống `git diff`) — text files hầu như không có null byte; binary
 * (image, exe, ...) thì luôn có.
 *
 * Returns null nếu entry không tồn tại.
 */
export function readZipEntryText(
  absolutePath: string,
  entryPath: string,
): EntryReadResult | null {
  const zip = new AdmZip(absolutePath);
  const entry = zip.getEntry(entryPath);
  if (!entry || entry.isDirectory) return null;

  const size = entry.header.size;
  const raw = entry.getData(); // Buffer; adm-zip không có streaming read

  // Binary detect: tìm null byte trong 8KB đầu
  const sample = raw.subarray(0, Math.min(8192, raw.length));
  const isBinary = sample.includes(0);

  if (isBinary) {
    return { content: '', truncated: false, isBinary: true, size };
  }

  const truncated = raw.length > MAX_TEXT_BYTES;
  const sliced = truncated ? raw.subarray(0, MAX_TEXT_BYTES) : raw;

  return {
    content: sliced.toString('utf8'),
    truncated,
    isBinary: false,
    size,
  };
}
