import { fetchMemberAggregates } from './team-kpi-sql';
import { deriveKpiFromAggregate, EMPTY_ROLE_LABEL } from './team-kpi-derive';

// Public types — UI components import from here. Shape is frozen across mock→real
// migration so renderers (cards, radar, summary) keep working without edits.

export type MemberStatus = 'top' | 'good' | 'coach';
export type MemberRoleVariant = 'creator' | 'editor' | 'lead';

export interface RadarDimension {
  label: string;
  value: number;
}

export interface KpiMetric {
  label: string;
  value: string; // pre-formatted so UI does not own units
}

export interface TeamMemberKpi {
  id: string;
  name: string;
  email: string;
  role: string;
  initials: string;
  avatarColor: string;
  roleLabel: string;
  status: MemberStatus;
  rank: number | null;
  score: number;
  radar: RadarDimension[];
  metrics: KpiMetric[];
  tags: string[];
}

export interface TeamKpiSummary {
  totalMembers: number;
  avgScore: number;
  avgScoreDelta: number;        // 0 in Phase 1 — UI shows "(coming soon)"
  topPerformer: { name: string; score: number; streakWeeks: number };
  belowTarget: number;
}

export interface TeamKpiPayload {
  summary: TeamKpiSummary;
  members: TeamMemberKpi[];
}

export { EMPTY_ROLE_LABEL };

export async function fetchTeamKpi(): Promise<TeamKpiPayload> {
  const rows = await fetchMemberAggregates();
  const members = rows.map(deriveKpiFromAggregate);

  // Sort by score DESC; only top-1 gets the rank badge.
  members.sort((a, b) => b.score - a.score);
  const top = members[0];

  // Skip rank=1 if top member has no data — happens when team is brand new
  // and would otherwise mislead admins ("our top performer has 0 score").
  if (top && top.roleLabel !== EMPTY_ROLE_LABEL) {
    top.rank = 1;
  }

  const totalMembers = members.length;
  const avgScore = totalMembers === 0
    ? 0
    : Math.round((members.reduce((s, m) => s + m.score, 0) / totalMembers) * 10) / 10;

  // Empty members are coach-status by default but should not count as "below target" —
  // they are unmeasured, not underperforming.
  const belowTarget = members.filter(
    (m) => m.status === 'coach' && m.roleLabel !== EMPTY_ROLE_LABEL
  ).length;

  // delta + streak deferred to Phase 2 (snapshot table required).
  const summary: TeamKpiSummary = {
    totalMembers,
    avgScore,
    avgScoreDelta: 0,
    topPerformer: top
      ? { name: top.name, score: top.score, streakWeeks: 0 }
      : { name: '—', score: 0, streakWeeks: 0 },
    belowTarget,
  };

  return { summary, members };
}
