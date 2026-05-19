-- Migration 019: Add kpi_posts_per_day to social_account
-- Up migration
--
-- KPI số bài đăng mục tiêu / ngày cho mỗi page. Set khi user tạo page,
-- chỉnh sửa được sau qua PATCH /api/channels/[id].
--
-- Dashboard nhân với time range để hiển thị: kpi_per_day * days_in_range.
--   - Dashboard 7d  → target = kpi_per_day * 7
--   - Dashboard 30d → target = kpi_per_day * 30
--   - Không cần reset đầu tháng / quý — query động theo range.
--
-- Default = 1 (1 bài/ngày = 30 bài/tháng) cho records cũ, hợp lý baseline.
-- CHECK >= 0 chặn negative; cho phép 0 nếu user muốn tắt KPI tracking.

ALTER TABLE social_account
  ADD COLUMN kpi_posts_per_day INTEGER NOT NULL DEFAULT 1
  CHECK (kpi_posts_per_day >= 0);

COMMENT ON COLUMN social_account.kpi_posts_per_day IS
  'KPI số bài đăng mục tiêu / ngày. Dashboard nhân với time range để hiển thị target.';
