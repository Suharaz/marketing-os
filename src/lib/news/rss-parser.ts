// Parser RSS 2.0 tự viết — chỉ extract field cần thiết.
//
// Tại sao không dùng library (fast-xml-parser, rss-parser)?
//   - Cấu trúc RSS 2.0 cố định, ~30 dòng regex là đủ → tuân thủ YAGNI/KISS
//   - Tránh thêm runtime dependency cho 1 use-case duy nhất
//   - Feed VentureBeat đã biết trước cấu trúc, kiểm soát được rủi ro
//
// Giới hạn: chỉ parse được RSS 2.0 chuẩn. Nếu sau này cần Atom/JSON feed
// hoặc feed có cấu trúc khác → thay bằng library.

import type { NewsItem } from './types';

/** Match từng <item>...</item> trong feed (RSS 2.0). */
const ITEM_REGEX = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;

/**
 * Trích nội dung của 1 tag bên trong block <item>.
 * Hỗ trợ cả 2 dạng: `<tag>value</tag>` và `<tag><![CDATA[value]]></tag>`.
 */
function extractTag(block: string, tag: string): string {
  // Regex: bắt cả 2 dạng — CDATA-wrapped và plain text
  const re = new RegExp(
    `<${tag}\\b[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`,
    'i'
  );
  const m = re.exec(block);
  if (!m) return '';
  // m[1] = CDATA content, m[2] = plain content — lấy cái nào có
  return (m[1] ?? m[2] ?? '').trim();
}

/** Strip HTML tags + decode 1 số entity phổ biến để có plain text. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cắt excerpt giới hạn ký tự (giữ trọn từ cuối). */
function truncate(text: string, max = 220): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…';
}

/**
 * Parse XML RSS 2.0 → danh sách NewsItem.
 * Trả về mảng rỗng nếu input không hợp lệ (không throw → caller dễ xử lý).
 */
export function parseRssFeed(xml: string): NewsItem[] {
  if (!xml || typeof xml !== 'string') return [];

  const items: NewsItem[] = [];
  let match: RegExpExecArray | null;

  // Reset lastIndex vì regex có flag /g (stateful)
  ITEM_REGEX.lastIndex = 0;

  while ((match = ITEM_REGEX.exec(xml)) !== null) {
    // match[1] có thể undefined về mặt type (noUncheckedIndexedAccess),
    // nhưng thực tế luôn tồn tại vì regex có 1 capture group → fallback ''.
    const block = match[1] ?? '';
    if (!block) continue;
    const title = stripHtml(extractTag(block, 'title'));
    const link = extractTag(block, 'link');
    const guid = extractTag(block, 'guid');
    const description = extractTag(block, 'description');
    const pubDateRaw = extractTag(block, 'pubDate');

    // Bỏ qua item lỗi cấu trúc (thiếu title hoặc link)
    if (!title || !link) continue;

    // pubDate RSS dạng RFC 822 — Date constructor parse được
    const parsedDate = new Date(pubDateRaw);
    const pubDate = isNaN(parsedDate.getTime())
      ? new Date().toISOString()
      : parsedDate.toISOString();

    items.push({
      id: guid || link,
      title,
      link,
      excerpt: truncate(stripHtml(description)),
      pubDate,
    });
  }

  return items;
}
