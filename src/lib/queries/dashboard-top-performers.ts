import { fetchTeamKpi, type TeamMemberKpi } from './team-kpi';

// Hàng hiển thị trên widget Top Performers ở dashboard.
// Tách hẳn khỏi TeamMemberKpi để dashboard không phải biết về radar/metrics.
export interface TopPerformerRow {
  id: string;
  rank: number;
  name: string;
  role: string;       // ví dụ "Creator", "Editor", "Content Lead"
  platform: string;   // key cho PlatformIcon ("tiktok", "facebook", ...)
  posts: number;      // số bài/brief tuần này
  score: number;      // 0–100
}

// Map roleLabel ("Creator · TikTok / Threads") → platform key cho icon brand.
// Lấy platform đầu tiên xuất hiện — nếu không khớp, fallback 'threads' cho Lead, 'facebook' chung.
function pickPlatform(roleLabel: string): string {
  const s = roleLabel.toLowerCase();
  if (s.includes('tiktok')) return 'tiktok';
  if (s.includes('yt') || s.includes('youtube')) return 'youtube';
  if (s.includes('ig') || s.includes('instagram')) return 'instagram';
  if (s.includes('fb') || s.includes('facebook')) return 'facebook';
  if (s.includes('threads')) return 'threads';
  if (s.includes('zalo')) return 'zalo';
  return 'threads';
}

// roleLabel = "Creator · TikTok / Threads" → "Creator"
function shortRole(roleLabel: string): string {
  const idx = roleLabel.indexOf('·');
  return idx === -1 ? roleLabel : roleLabel.slice(0, idx).trim();
}

// metrics[0] có format:
//   - Non-lead: "12/20"  → posts = 12
//   - Lead:    "10"      → posts = 10
// Defensive parse — nếu format lạ, trả 0 thay vì NaN.
function parsePostsFromMetric(value: string): number {
  const head = value.split('/')[0]?.trim() ?? '';
  const n = parseInt(head, 10);
  return Number.isFinite(n) ? n : 0;
}

function toRow(m: TeamMemberKpi, rank: number): TopPerformerRow {
  const firstMetric = m.metrics[0]?.value ?? '0';
  return {
    id: m.id,
    rank,
    name: m.name,
    role: shortRole(m.roleLabel),
    platform: pickPlatform(m.roleLabel),
    posts: parsePostsFromMetric(firstMetric),
    score: m.score,
  };
}

// Top N theo score DESC. Reuse fetchTeamKpi() để giữ score nhất quán
// với trang /team (tránh hai chỗ tính khác nhau).
export async function fetchTopPerformers(limit = 5): Promise<TopPerformerRow[]> {
  const { members } = await fetchTeamKpi();
  // members đã được sort score DESC trong fetchTeamKpi(), nhưng sort lại
  // cho rõ ràng (defensive — nếu logic kia đổi, ở đây không bị ảnh hưởng).
  const sorted = [...members].sort((a, b) => b.score - a.score);
  return sorted.slice(0, limit).map((m, i) => toRow(m, i + 1));
}
