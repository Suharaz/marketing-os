import { db } from '@/lib/db';

// Hybrid data source: real team members from DB, deterministic mock KPI per member.id.
// Mock layer mô phỏng output của pipeline KPI tương lai (chưa có table riêng).
// Khi có table thật, swap toàn bộ deriveKpi() → JOIN query, giữ nguyên shape TeamMemberKpi
// để các component không phải đổi.

export type MemberStatus = 'top' | 'good' | 'coach';
export type MemberRoleVariant = 'creator' | 'editor' | 'lead';

export interface RadarDimension {
  // Tên hiển thị trên trục radar (ngắn gọn vì label vẽ quanh polygon).
  label: string;
  // Giá trị 0–100. Component radar tự normalize về toạ độ pentagon.
  value: number;
}

export interface KpiMetric {
  label: string;
  value: string; // pre-formatted để page không phải biết đơn vị
}

export interface TeamMemberKpi {
  id: string;
  name: string;
  email: string;
  role: string; // raw role từ DB ('admin' | 'member')
  // === Mock layer ===
  initials: string;
  avatarColor: string; // tailwind bg-* class
  roleLabel: string;   // "Creator · TikTok / Threads"
  status: MemberStatus;
  rank: number | null; // chỉ #1 mới hiện
  score: number;       // điểm tổng 0–100
  radar: RadarDimension[];
  metrics: KpiMetric[]; // 6 ô metric (3 hàng × 2 cột)
  tags: string[];
}

export interface TeamKpiSummary {
  totalMembers: number;
  avgScore: number;
  avgScoreDelta: number; // diff so với "tuần trước" — mock cố định
  topPerformer: { name: string; score: number; streakWeeks: number };
  belowTarget: number;
}

export interface TeamKpiPayload {
  summary: TeamKpiSummary;
  members: TeamMemberKpi[];
}

// === Mock catalogs ===
// Cố định để mọi reload ra cùng kết quả; chọn theo hash(member.id).
const ROLE_PRESETS: ReadonlyArray<{
  variant: MemberRoleVariant;
  label: string;
  radarLabels: [string, string, string, string, string];
  metricLabels: [string, string, string, string, string, string];
}> = [
  {
    variant: 'creator',
    label: 'Creator · TikTok / Threads',
    radarLabels: ['Output', 'Reach', 'Viral', 'Velocity', 'Quality'],
    metricLabels: ['Output', 'Chất lượng', 'Reach TB', 'Velocity', 'Viral hit', 'Điểm'],
  },
  {
    variant: 'creator',
    label: 'Creator · YT Shorts / Kênh',
    radarLabels: ['Output', 'Reach', 'Viral', 'Velocity', 'Quality'],
    metricLabels: ['Output', 'Chất lượng', 'Reach TB', 'Velocity', 'Viral hit', 'Điểm'],
  },
  {
    variant: 'editor',
    label: 'Editor · FB Reels / IG',
    radarLabels: ['Output', 'Reach', 'Viral', 'Velocity', 'Quality'],
    metricLabels: ['Output', 'Chất lượng', 'Reach TB', 'Velocity', 'Viral hit', 'Điểm'],
  },
  {
    variant: 'lead',
    label: 'Content Lead · Strategy',
    radarLabels: ['Brief', 'Concepts', 'Hit', 'Velocity', 'Approval'],
    metricLabels: ['Brief/tuần', 'Approval %', 'Concepts', 'Velocity', 'Hit rate', 'Điểm'],
  },
];

const AVATAR_COLORS = [
  'bg-orange-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-amber-500',
  'bg-indigo-500',
];

const TAG_POOLS: Record<MemberRoleVariant, string[][]> = {
  creator: [
    ['taki_tiktok_linh', 'linh_threads'],
    ['kimi_yt_shorts', 'taki_yt_main'],
    ['taki_threads', 'taki_zalo_oa'],
    ['taki_fb_main'],
  ],
  editor: [['taki_fb_reels', 'taki_ig_post']],
  lead: [['Spy Room', 'Brief Tool']],
};

// FNV-1a 32-bit — đủ cho việc chia đều mock vào catalog.
// Không dùng cho security; chỉ cần deterministic per-member.
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Caller phải đảm bảo arr non-empty (catalog hằng số → an toàn).
// Throw thay vì silent default để tránh "không hiểu sao card render trống".
function pick<T>(arr: readonly T[], seed: number): T {
  if (arr.length === 0) throw new Error('pick: empty array');
  return arr[seed % arr.length] as T;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// Sinh giá trị 0–100 từ seed; bias để có spread đẹp trên radar.
function seededValue(seed: number, min: number, max: number): number {
  const t = (seed % 1000) / 1000;
  return Math.round(min + t * (max - min));
}

function statusFromScore(score: number): MemberStatus {
  if (score >= 92) return 'top';
  if (score >= 80) return 'good';
  return 'coach';
}

interface DbRow {
  id: string;
  name: string;
  email: string;
  role: string;
}

function deriveKpi(row: DbRow, idx: number): TeamMemberKpi {
  const seed = hashStr(row.id);
  const preset = pick(ROLE_PRESETS, seed);

  // 5 trục radar — mỗi trục lệch seed để tránh trùng giá trị.
  const radar: RadarDimension[] = preset.radarLabels.map((label, i) => ({
    label,
    value: seededValue(seed >>> (i * 3), 45, 96),
  }));

  // Score = trung bình radar (làm tròn 1 chữ số).
  const score = Math.round(
    (radar.reduce((s, d) => s + d.value, 0) / radar.length) * 10
  ) / 10;

  // Sinh metric numbers — gắn theo preset variant để label/đơn vị khớp nhau.
  let metrics: KpiMetric[];
  if (preset.variant === 'lead') {
    metrics = [
      { label: preset.metricLabels[0], value: `${seededValue(seed, 8, 18)}` },
      { label: preset.metricLabels[1], value: `${seededValue(seed >>> 4, 80, 96)}%` },
      { label: preset.metricLabels[2], value: `${seededValue(seed >>> 8, 20, 50)}` },
      { label: preset.metricLabels[3], value: `${(seededValue(seed >>> 12, 18, 30) / 10).toFixed(1)}h` },
      { label: preset.metricLabels[4], value: `${seededValue(seed >>> 16, 55, 75)}%` },
      { label: preset.metricLabels[5], value: score.toFixed(1) },
    ];
  } else {
    const target = seededValue(seed >>> 8, 10, 30);
    const actual = Math.max(8, Math.round(target * (0.7 + ((seed % 60) / 100))));
    metrics = [
      { label: preset.metricLabels[0], value: `${actual}/${target}` },
      { label: preset.metricLabels[1], value: score.toFixed(1) },
      { label: preset.metricLabels[2], value: `${seededValue(seed >>> 4, 30, 160)}K` },
      { label: preset.metricLabels[3], value: `${(seededValue(seed >>> 12, 30, 95) / 10).toFixed(1)}h` },
      { label: preset.metricLabels[4], value: `${seededValue(seed >>> 16, 6, 28)}%` },
      { label: preset.metricLabels[5], value: score.toFixed(1) },
    ];
  }

  const tagPool = TAG_POOLS[preset.variant];
  const tags = pick(tagPool, seed);
  const avatarColor =
    AVATAR_COLORS[idx % AVATAR_COLORS.length] ?? 'bg-zinc-500';

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    initials: getInitials(row.name),
    avatarColor,
    roleLabel: preset.label,
    status: statusFromScore(score),
    rank: null, // assigned sau khi sort
    score,
    radar,
    metrics,
    tags,
  };
}

export async function fetchTeamKpi(): Promise<TeamKpiPayload> {
  const res = await db.query<DbRow>(
    `SELECT id, name, email, role
     FROM team_member
     ORDER BY created_at ASC`
  );

  const members = res.rows.map(deriveKpi);

  // Sort theo score DESC → người đầu tiên là rank #1 (chỉ gán rank cho top 1).
  members.sort((a, b) => b.score - a.score);
  const top = members[0];
  if (top) {
    top.rank = 1;
  }

  const totalMembers = members.length;
  const avgScore =
    totalMembers === 0
      ? 0
      : Math.round(
          (members.reduce((s, m) => s + m.score, 0) / totalMembers) * 10
        ) / 10;
  const belowTarget = members.filter((m) => m.status === 'coach').length;

  const summary: TeamKpiSummary = {
    totalMembers,
    avgScore,
    avgScoreDelta: 3.2, // mock cố định — sẽ thay khi có pipeline tuần-trước
    topPerformer: top
      ? { name: top.name, score: top.score, streakWeeks: 3 }
      : { name: '—', score: 0, streakWeeks: 0 },
    belowTarget,
  };

  return { summary, members };
}
