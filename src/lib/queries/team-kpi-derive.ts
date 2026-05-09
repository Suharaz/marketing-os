import type { MemberAggregateRow } from './team-kpi-sql';
import type {
  KpiMetric,
  MemberRoleVariant,
  MemberStatus,
  RadarDimension,
  TeamMemberKpi,
} from './team-kpi';

// UI checks this exact string to render the "Chưa có data" badge.
// Exported so card component can import instead of duplicating the literal.
export const EMPTY_ROLE_LABEL = 'Chưa có data';

// Catalogs — radar (5) + metric (6) labels. Order matters: UI iterates by index.
const CREATOR_RADAR: readonly [string, string, string, string, string] = [
  'Output', 'Reach', 'Viral', 'Velocity', 'Quality',
];
const CREATOR_METRICS: readonly [string, string, string, string, string, string] = [
  'Output', 'Chất lượng', 'Reach TB', 'Velocity', 'Viral hit', 'Điểm',
];
const LEAD_RADAR: readonly [string, string, string, string, string] = [
  'Brief', 'Concepts', 'Hit', 'Velocity', 'Approval',
];
const LEAD_METRICS: readonly [string, string, string, string, string, string] = [
  'Brief/tuần', 'Approval %', 'Concepts', 'Velocity', 'Hit rate', 'Điểm',
];

const AVATAR_COLORS = [
  'bg-orange-500', 'bg-blue-500', 'bg-emerald-500', 'bg-violet-500',
  'bg-rose-500', 'bg-pink-500', 'bg-cyan-500', 'bg-amber-500', 'bg-indigo-500',
];

function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}

function statusFromScore(score: number): MemberStatus {
  if (score >= 92) return 'top';
  if (score >= 80) return 'good';
  return 'coach';
}

function clamp100(v: number): number {
  if (!Number.isFinite(v) || v < 0) return 0;
  return v > 100 ? 100 : v;
}

// "48000" -> "48K", "1500000" -> "1.5M".
function formatCompact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(Math.round(n));
}

// Lead check first — brief writers may also post occasionally,
// but their primary KPI dimension is brief output, not posts.
function inferRoleVariant(row: MemberAggregateRow): MemberRoleVariant {
  if (row.briefs_created_30d >= 3) return 'lead';
  if (row.posts_30d > 0 && row.reel_video_share_30d > 0.5) return 'editor';
  return 'creator';
}

function roleLabelFor(variant: MemberRoleVariant, topPlatform: string | null): string {
  if (variant === 'lead') return 'Content Lead · Strategy';
  if (variant === 'editor') return 'Editor · FB Reels / IG';
  switch (topPlatform) {
    case 'tiktok':    return 'Creator · TikTok / Threads';
    case 'youtube':   return 'Creator · YT Shorts / Kênh';
    case 'instagram':
    case 'threads':   return 'Creator · Threads / IG';
    case 'facebook':  return 'Creator · FB';
    default:          return 'Creator';
  }
}

// Caps chosen from typical small-team SaaS targets (10 posts/wk = excellent).
// Tune in Phase 2 once we observe the real distribution.
function normalizeRadar(row: MemberAggregateRow, variant: MemberRoleVariant): RadarDimension[] {
  if (variant === 'lead') {
    const created = row.briefs_created_30d;
    const hitRate = created > 0 ? row.briefs_published_30d / created : 0;
    const approvalRate = created > 0 ? row.brief_status_changes_30d / created : 0;
    return [
      { label: LEAD_RADAR[0], value: clamp100((created / 12) * 100) },
      { label: LEAD_RADAR[1], value: Math.min(80, clamp100((created / 12) * 100)) },
      { label: LEAD_RADAR[2], value: clamp100(hitRate * 100) },
      { label: LEAD_RADAR[3], value: clamp100((row.brief_actions_30d / 30) * 100) },
      { label: LEAD_RADAR[4], value: clamp100(approvalRate * 100) },
    ];
  }
  // creator + editor share radar shape.
  const weeklyAvg = row.posts_30d / 4.3;
  const velocity = weeklyAvg > 0 ? row.posts_7d / weeklyAvg : 0;
  return [
    { label: CREATOR_RADAR[0], value: clamp100((row.posts_7d / 10) * 100) },
    { label: CREATOR_RADAR[1], value: clamp100((row.avg_reach_30d / 50_000) * 100) },
    { label: CREATOR_RADAR[2], value: clamp100((row.viral_hits_30d / 5) * 100) },
    { label: CREATOR_RADAR[3], value: clamp100(velocity * 100) },
    { label: CREATOR_RADAR[4], value: clamp100(row.avg_er_7d * 100 * 20) },
  ];
}

function buildMetrics(row: MemberAggregateRow, variant: MemberRoleVariant, score: number): KpiMetric[] {
  const scoreStr = score.toFixed(1);
  if (variant === 'lead') {
    const created = row.briefs_created_30d;
    const approvalPct = created > 0 ? Math.round((row.brief_status_changes_30d / created) * 100) : 0;
    const hitPct = created > 0 ? Math.round((row.briefs_published_30d / created) * 100) : 0;
    return [
      { label: LEAD_METRICS[0], value: String(Math.round(created / 4.3)) },
      { label: LEAD_METRICS[1], value: `${approvalPct}%` },
      { label: LEAD_METRICS[2], value: String(created) },
      { label: LEAD_METRICS[3], value: String(row.brief_actions_30d) },
      { label: LEAD_METRICS[4], value: `${hitPct}%` },
      { label: LEAD_METRICS[5], value: scoreStr },
    ];
  }
  const target = 10; // weekly target — Phase 2 may move to per-member config
  const viralPct = row.posts_30d > 0 ? Math.round((row.viral_hits_30d / row.posts_30d) * 100) : 0;
  return [
    { label: CREATOR_METRICS[0], value: `${row.posts_7d}/${target}` },
    { label: CREATOR_METRICS[1], value: scoreStr },
    { label: CREATOR_METRICS[2], value: formatCompact(row.avg_reach_30d) },
    { label: CREATOR_METRICS[3], value: `${row.posts_7d.toFixed(1)}/wk` },
    { label: CREATOR_METRICS[4], value: `${viralPct}%` },
    { label: CREATOR_METRICS[5], value: scoreStr },
  ];
}

function isEmptyMember(row: MemberAggregateRow): boolean {
  return row.posts_30d === 0
      && row.briefs_created_30d === 0
      && row.brief_actions_30d === 0;
}

export function deriveKpiFromAggregate(row: MemberAggregateRow, idx: number): TeamMemberKpi {
  const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length] ?? 'bg-zinc-500';

  if (isEmptyMember(row)) {
    return {
      id: row.member_id,
      name: row.name,
      email: row.email,
      role: row.role,
      initials: getInitials(row.name),
      avatarColor,
      roleLabel: EMPTY_ROLE_LABEL,
      status: 'coach',
      rank: null,
      score: 0,
      radar: CREATOR_RADAR.map((label) => ({ label, value: 0 })),
      metrics: CREATOR_METRICS.map((label) => ({ label, value: '—' })),
      tags: [],
    };
  }

  const variant = inferRoleVariant(row);
  const radar = normalizeRadar(row, variant);
  const score = Math.round(
    (radar.reduce((s, d) => s + d.value, 0) / radar.length) * 10
  ) / 10;
  const metrics = buildMetrics(row, variant, score);

  return {
    id: row.member_id,
    name: row.name,
    email: row.email,
    role: row.role,
    initials: getInitials(row.name),
    avatarColor,
    roleLabel: roleLabelFor(variant, row.top_platform_30d),
    status: statusFromScore(score),
    rank: null,
    score,
    radar,
    metrics,
    tags: row.account_names,
  };
}
