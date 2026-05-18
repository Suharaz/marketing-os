// Registry các nguồn RSS AI news.
//
// Thiết kế: source.id là khóa lưu DB (cột `news_article.source`) — phải ổn
// định, không đổi tùy tiện vì sẽ orphan data cũ. Nếu cần rename: thêm
// migration UPDATE source = 'new-id' WHERE source = 'old-id'.

export interface NewsSource {
  /** Slug ổn định, dùng làm khóa DB và query param (?source=xxx). */
  id: string;
  /** Tên hiển thị trên UI (tab label, card footer). */
  name: string;
  /** URL RSS feed. */
  url: string;
  /** Màu accent cho fallback gradient khi tin không có cover_image. */
  gradient: string;
}

export const NEWS_SOURCES: readonly NewsSource[] = [
  {
    id: 'venturebeat-ai',
    name: 'VentureBeat',
    url: 'https://feeds.feedburner.com/venturebeat/SZYF',
    gradient: 'from-orange-400 to-red-600',
  },
  {
    id: 'techcrunch-ai',
    name: 'TechCrunch',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    gradient: 'from-green-400 to-emerald-600',
  },
  {
    id: 'the-verge-ai',
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    gradient: 'from-purple-400 to-fuchsia-600',
  },
  {
    id: 'marktechpost',
    name: 'Marktechpost',
    url: 'https://www.marktechpost.com/feed/',
    gradient: 'from-blue-400 to-cyan-600',
  },
] as const;

/** Lookup source by id, undefined nếu không tồn tại. */
export function getSourceById(id: string): NewsSource | undefined {
  return NEWS_SOURCES.find((s) => s.id === id);
}

/** Set các id hợp lệ — dùng để validate searchParams ở UI. */
export const VALID_SOURCE_IDS = new Set<string>(NEWS_SOURCES.map((s) => s.id));
