// Kiểu dữ liệu cho 1 item tin tức sau khi parse từ RSS feed.
// Chỉ giữ field cần thiết để render + lưu DB.

export interface NewsItem {
  /** Định danh duy nhất (lấy từ <guid> hoặc fallback về <link>). */
  id: string;
  title: string;
  link: string;
  /** Mô tả ngắn — đã được strip HTML để hiển thị plain text. */
  excerpt: string;
  /** URL ảnh bìa — null nếu RSS không có. UI sẽ render fallback gradient. */
  coverImage: string | null;
  /** ISO 8601 — tiện cho Intl.DateTimeFormat. Null nếu RSS thiếu <pubDate>. */
  pubDate: string | null;
}
