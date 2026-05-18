// Parser feed XML — hỗ trợ cả RSS 2.0 và Atom 1.0.
//
// Tại sao tự viết regex thay vì dùng library?
//   - YAGNI: 2 format đều có cấu trúc cố định, parser ~120 dòng là đủ
//   - Tránh thêm runtime dependency cho 1 use-case
//
// Format detection: nếu tài liệu chứa `<feed xmlns=".../Atom">` → Atom,
// else giả định RSS 2.0. Verge dùng Atom; VentureBeat/TechCrunch/Marktechpost
// dùng RSS 2.0.
//
// Cover image strategy (multi-fallback theo thứ tự):
//   1. <media:content url="..."> / <media:thumbnail url="...">
//   2. <enclosure url="..." type="image/...">
//   3. <img src="..."> đầu tiên trong description/content HTML
//   → null nếu không tìm thấy.

import type { NewsItem } from './types';

const RSS_ITEM_REGEX = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
const ATOM_ENTRY_REGEX = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;

/** Extract content giữa <tag>...</tag>, hỗ trợ CDATA. */
function extractTag(block: string, tag: string): string {
  const re = new RegExp(
    `<${tag}\\b[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`,
    'i'
  );
  const m = re.exec(block);
  if (!m) return '';
  return (m[1] ?? m[2] ?? '').trim();
}

/** Extract attribute từ tag (self-closing OK), vd `<link href="...">`. */
function extractAttr(block: string, tagPattern: string, attr: string): string {
  const re = new RegExp(`<${tagPattern}\\b[^>]*\\b${attr}=["']([^"']+)["']`, 'i');
  const m = re.exec(block);
  return m?.[1] ?? '';
}

/** Strip HTML + decode entity phổ biến → plain text. */
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

function decodeUrl(url: string): string {
  return url.replace(/&#038;/g, '&').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
}

function truncate(text: string, max = 220): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…';
}

function extractCoverImage(itemBlock: string, ...htmlBlobs: string[]): string | null {
  const mediaContent = extractAttr(itemBlock, 'media:content', 'url');
  if (mediaContent) return decodeUrl(mediaContent);

  const mediaThumb = extractAttr(itemBlock, 'media:thumbnail', 'url');
  if (mediaThumb) return decodeUrl(mediaThumb);

  const enclosureRe = /<enclosure\b[^>]*\btype=["']image\/[^"']+["'][^>]*\burl=["']([^"']+)["']/i;
  const enclosureUrlFirst = /<enclosure\b[^>]*\burl=["']([^"']+)["'][^>]*\btype=["']image\/[^"']+["']/i;
  const encM = enclosureRe.exec(itemBlock) ?? enclosureUrlFirst.exec(itemBlock);
  if (encM?.[1]) return decodeUrl(encM[1]);

  // Tìm <img src> trong tất cả HTML blob (description, content) theo thứ tự
  const imgRe = /<img\b[^>]*\bsrc=["']([^"']+)["']/i;
  for (const html of htmlBlobs) {
    if (!html) continue;
    const m = imgRe.exec(html);
    if (m?.[1]) return decodeUrl(m[1]);
  }

  return null;
}

function safeIsoDate(raw: string): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Parse RSS 2.0 → NewsItem[]. */
function parseRss(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  let match: RegExpExecArray | null;
  RSS_ITEM_REGEX.lastIndex = 0;

  while ((match = RSS_ITEM_REGEX.exec(xml)) !== null) {
    const block = match[1] ?? '';
    if (!block) continue;

    const title = stripHtml(extractTag(block, 'title'));
    const link = extractTag(block, 'link');
    const guid = extractTag(block, 'guid');
    const description = extractTag(block, 'description');
    const pubDateRaw = extractTag(block, 'pubDate');

    if (!title || !link) continue;

    items.push({
      id: guid || link,
      title,
      link,
      excerpt: truncate(stripHtml(description)),
      coverImage: extractCoverImage(block, description),
      pubDate: safeIsoDate(pubDateRaw),
    });
  }
  return items;
}

/** Parse Atom 1.0 → NewsItem[]. */
function parseAtom(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  let match: RegExpExecArray | null;
  ATOM_ENTRY_REGEX.lastIndex = 0;

  while ((match = ATOM_ENTRY_REGEX.exec(xml)) !== null) {
    const block = match[1] ?? '';
    if (!block) continue;

    const title = stripHtml(extractTag(block, 'title'));
    // Atom: <link rel="alternate" href="..." /> — link nằm ở attr `href`.
    // Có thể có nhiều <link> (alternate, self, enclosure) — lấy alternate trước.
    const linkAlternate =
      /<link\b[^>]*\brel=["']alternate["'][^>]*\bhref=["']([^"']+)["']/i.exec(block)?.[1] ??
      /<link\b[^>]*\bhref=["']alternate["'][^>]*\brel=["']([^"']+)["']/i.exec(block)?.[1] ??
      extractAttr(block, 'link', 'href');
    const link = linkAlternate;
    const id = extractTag(block, 'id');
    const summary = extractTag(block, 'summary');
    const content = extractTag(block, 'content');
    const published = extractTag(block, 'published') || extractTag(block, 'updated');

    if (!title || !link) continue;

    const excerptSrc = summary || content;
    items.push({
      id: id || link,
      title,
      link,
      excerpt: truncate(stripHtml(excerptSrc)),
      coverImage: extractCoverImage(block, content, summary),
      pubDate: safeIsoDate(published),
    });
  }
  return items;
}

/**
 * PUBLIC: detect format → parse phù hợp.
 * Tên cũ `parseRssFeed` giữ nguyên cho backward compat với các caller.
 */
export function parseRssFeed(xml: string): NewsItem[] {
  if (!xml || typeof xml !== 'string') return [];

  // Atom 1.0 namespace declaration luôn có ở root <feed>.
  const isAtom = /<feed\b[^>]*\bxmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(
    xml.slice(0, 500)
  );

  return isAtom ? parseAtom(xml) : parseRss(xml);
}
