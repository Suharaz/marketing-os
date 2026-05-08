import type { ReactNode } from 'react';
import type { TeamMemberKpi } from '@/lib/queries/team-kpi';
import { TeamMemberCard } from './team-member-card';

interface TeamMemberGridProps {
  members: TeamMemberKpi[];
  /**
   * Optional render-prop for per-member action slot. Caller decides what
   * to render (delete button, edit menu, etc.) and gets the full member
   * so it can branch on role/identity (e.g. hide self-delete).
   * Returning null/undefined hides the slot for that member.
   */
  renderAction?: (member: TeamMemberKpi) => ReactNode;
}

const EMPTY_MESSAGE =
  'Chưa có thành viên nào. Bấm "+ Thêm thành viên" ở góc trên để tạo mới.';

export function TeamMemberGrid({ members, renderAction }: TeamMemberGridProps) {
  if (members.length === 0) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-4 text-sm text-amber-700">
        {EMPTY_MESSAGE}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {members.map((m) => (
        <TeamMemberCard key={m.id} member={m} action={renderAction?.(m)} />
      ))}
    </div>
  );
}
