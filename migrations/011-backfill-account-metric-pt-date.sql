-- Migration 011: Backfill account_metric_daily — shift dates -1 day to PT
-- Up migration
--
-- Bug context: parse-insights.ts cũ dùng `endTime.substring(0,10)` lấy UTC date
-- của FB end_time. FB Insights period=day báo cáo theo Pacific Time, end_time là
-- PT-midnight (07:00/08:00 UTC tuỳ DST) đại diện cho mốc KẾT THÚC report day.
-- Hệ quả: mọi row trong account_metric_daily đang label SAI 1 ngày (lệch +1).
--
-- Migration này:
--   1) Xoá các placeholder zero-rows (do fallback "today row" insert reach=0).
--   2) Shift mọi row có data thật về -1 day để khớp với PT calendar date.
--
-- An toàn: chạy trong transaction, dùng staging table để tránh primary key
-- conflict khi shift sang ngày đã tồn tại.

BEGIN;

-- 1) Xoá placeholder rows: tất cả metric = 0 (kể cả followers).
--    Đây là rows bị fallback insert nhưng FB chưa bao giờ trả data thật.
DELETE FROM account_metric_daily
WHERE followers = 0
  AND follower_growth = 0
  AND posts_count = 0
  AND total_reach = 0
  AND total_reach_unique = 0
  AND total_engagement = 0
  AND total_actions = 0
  AND page_views = 0
  AND post_reactions_total = 0;

-- 2) Shift -1 day cho mọi row còn lại. Dùng staging table để xử lý conflict
--    (sau shift, ngày đích có thể đã tồn tại — cần MERGE, không UPDATE thẳng).
CREATE TEMP TABLE _amd_shifted ON COMMIT DROP AS
SELECT
  account_id,
  (date - INTERVAL '1 day')::date AS date,
  followers,
  follower_growth,
  posts_count,
  total_reach,
  total_reach_unique,
  total_engagement,
  total_actions,
  page_views,
  post_reactions_total,
  updated_at
FROM account_metric_daily;

-- Xoá toàn bộ bảng cũ rồi insert lại từ staging với MERGE-style dedup
-- (giữ row có updated_at mới nhất nếu trùng key).
TRUNCATE account_metric_daily;

INSERT INTO account_metric_daily (
  account_id, date, followers, follower_growth, posts_count,
  total_reach, total_reach_unique, total_engagement,
  total_actions, page_views, post_reactions_total, updated_at
)
SELECT DISTINCT ON (account_id, date)
  account_id, date, followers, follower_growth, posts_count,
  total_reach, total_reach_unique, total_engagement,
  total_actions, page_views, post_reactions_total, updated_at
FROM _amd_shifted
ORDER BY account_id, date, updated_at DESC;

COMMIT;

-- Verify: count rows + check date range
-- SELECT COUNT(*) AS total_rows,
--        MIN(date) AS earliest,
--        MAX(date) AS latest
-- FROM account_metric_daily;
