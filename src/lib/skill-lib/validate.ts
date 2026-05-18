// Validation + slug generation cho skill upload.
//
// Tách riêng để (a) test dễ — pure functions; (b) tái dùng giữa upload route
// và (sau này) bulk import script.

const ALLOWED_EXT = ['.zip', '.skill'] as const;

const ZIP_MAGIC = Buffer.from([0x50, 0x4b]); // "PK" — local file header sig

/**
 * Reject filename không có extension hợp lệ. Trả về extension lowercased
 * nếu OK, throw nếu không.
 */
export function assertValidExtension(filename: string): '.zip' | '.skill' {
  const lower = filename.toLowerCase();
  for (const ext of ALLOWED_EXT) {
    if (lower.endsWith(ext)) return ext;
  }
  throw new Error(`Extension không hợp lệ: chỉ chấp nhận ${ALLOWED_EXT.join(', ')}`);
}

/**
 * Đảm bảo file thực sự là zip bằng cách đọc 2 byte đầu (magic "PK").
 * Tránh trường hợp user đổi tên file lung tung — vd .exe → .zip.
 */
export function isZipMagic(firstTwoBytes: Buffer): boolean {
  if (firstTwoBytes.length < 2) return false;
  return firstTwoBytes[0] === ZIP_MAGIC[0] && firstTwoBytes[1] === ZIP_MAGIC[1];
}

/**
 * Convert filename → URL-safe slug. Bỏ dấu tiếng Việt, lowercase, dash-separated.
 *
 *   "My Skill v2.zip"            → "my-skill-v2"
 *   "Phân tích thị trường.skill" → "phan-tich-thi-truong"
 *   "___.zip"                    → "" (caller phải handle empty)
 */
export function slugifyFilename(filename: string): string {
  const base = filename.replace(/\.(zip|skill)$/i, '');
  return base
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip combining diacritics
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Lấy tên hiển thị từ filename — giữ nguyên Unicode, chỉ bỏ extension.
 */
export function nameFromFilename(filename: string): string {
  return filename.replace(/\.(zip|skill)$/i, '').trim() || filename;
}

/**
 * Validate path query string khi đọc file content từ zip.
 * Whitelist: chữ số, chữ cái, dấu chấm, gạch dưới/ngang, dấu /.
 * Cấm ../ để chống path traversal (dù adm-zip cũng không follow ra ngoài,
 * vẫn defense-in-depth).
 */
export function isSafeZipEntryPath(path: string): boolean {
  if (!path || path.length > 1024) return false;
  if (path.includes('..')) return false;
  return /^[a-zA-Z0-9._/\- ]+$/.test(path);
}

// Whitelist nhỏ — đủ cho mọi case skill bundle thực tế. Không cover hết
// vì content-type chỉ là hint cho browser, không phải bảo mật.
const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  pdf: 'application/pdf',
  json: 'application/json',
  txt: 'text/plain',
  md: 'text/markdown',
};

export function mimeFromPath(path: string): string {
  const m = path.toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = m?.[1];
  if (ext && MIME_MAP[ext]) return MIME_MAP[ext];
  return 'application/octet-stream';
}
