import { db } from '@/lib/db';

export interface TeamMemberOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

// Trả về toàn bộ team member để hiển thị trong dropdown chọn owner.
// Sort theo name để dropdown dễ scan.
export async function fetchTeamMembers(): Promise<TeamMemberOption[]> {
  const res = await db.query<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>(
    `SELECT id, name, email, role
     FROM team_member
     ORDER BY name ASC`
  );

  return res.rows;
}
