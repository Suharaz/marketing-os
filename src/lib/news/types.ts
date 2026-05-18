// Kiểu dữ liệu cho 1 item tin tức sau khi parse từ RSS feed.
// Chỉ giữ field cần thiết để render — bỏ qua các field RSS phụ.

export interface NewsItem {
  /** Định danh duy nhất (lấy từ <guid> hoặc fallback về <link>) */
  id: string;
  title: string;
  link: string;
  /** Mô tả ngắn — đã được strip HTML để hiển thị plain text */
  excerpt: string;
  /** ISO 8601 — tiện cho Intl.DateTimeFormat */
  pubDate: string;
}
