import type { Metadata } from 'next';
import { fetchTeamKpi } from '@/lib/queries/team-kpi';
import { TeamKpiSummaryCards } from '@/components/team/team-kpi-summary';
import { TeamMemberGrid } from '@/components/team/team-member-grid';
import { AddMemberDialog } from './add-member-dialog';

export const metadata: Metadata = {
  title: 'Team — Marketing OS',
};

export default async function TeamPage() {
  const { summary, members } = await fetchTeamKpi();

  return (
    <div className="flex flex-col gap-6">
      {/* Header — title + subtitle + CTA dialog */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">KPI đội ngũ</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Hiệu suất từng thành viên · radar 5 dimension · xếp hạng tuần
          </p>
        </div>
        <AddMemberDialog />
      </div>

      {/* Tier 1: 4 summary cards */}
      <TeamKpiSummaryCards data={summary} />

      {/* Tier 2: Member cards grid */}
      <TeamMemberGrid members={members} />
    </div>
  );
}
