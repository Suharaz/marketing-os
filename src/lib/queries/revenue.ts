// Read/write queries for manual_revenue.
// All DATE/TIMESTAMPTZ columns are formatted via to_char in SQL to bypass
// pg's Date-object parsing — see conversions.ts for the timezone-shift trap.

import { db } from '@/lib/db';
import type { RevenueInput } from '@/lib/validation/revenue-schema';

export interface RevenueRow {
  id: string;
  account_id: string;
  account_name: string | null;
  platform: string | null;
  amount_vnd: number;
  /** ISO 'YYYY-MM-DD'. */
  occurred_date: string;
  note: string | null;
  /** ISO timestamp UTC. */
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
}

export async function fetchRecentRevenue(limit = 50): Promise<RevenueRow[]> {
  interface RawRow {
    id: string;
    account_id: string;
    account_name: string | null;
    platform: string | null;
    amount_vnd: string | number;
    occurred_date: string;
    note: string | null;
    created_at: string;
    created_by: string | null;
    created_by_name: string | null;
  }

  const res = await db.query<RawRow>(
    `SELECT
       mr.id,
       mr.account_id,
       mr.amount_vnd,
       to_char(mr.occurred_date, 'YYYY-MM-DD')                         AS occurred_date,
       mr.note,
       to_char(mr.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
       mr.created_by,
       sa.name AS account_name,
       sa.platform,
       tm.name AS created_by_name
     FROM manual_revenue mr
     LEFT JOIN social_account sa ON sa.id = mr.account_id
     LEFT JOIN team_member   tm ON tm.id = mr.created_by
     ORDER BY mr.occurred_date DESC, mr.created_at DESC
     LIMIT $1`,
    [limit]
  );

  return res.rows.map((row) => ({
    ...row,
    amount_vnd: Number(row.amount_vnd),
  }));
}

export async function createRevenue(
  input: RevenueInput,
  createdBy: string
): Promise<string> {
  const res = await db.query<{ id: string }>(
    `INSERT INTO manual_revenue
       (account_id, amount_vnd, occurred_date, note, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      input.account_id,
      input.amount_vnd,
      input.occurred_date,
      input.note ?? null,
      createdBy,
    ]
  );

  const id = res.rows[0]?.id;
  if (!id) throw new Error('createRevenue: INSERT returned no id');
  return id;
}

export async function deleteRevenue(id: string): Promise<void> {
  await db.query('DELETE FROM manual_revenue WHERE id = $1', [id]);
}

/** Active social_accounts available for the dropdown on the new-revenue form. */
export interface AccountOption {
  id: string;
  name: string;
  platform: string;
}

export async function fetchAccountOptions(): Promise<AccountOption[]> {
  const res = await db.query<AccountOption>(
    `SELECT id, name, platform
     FROM social_account
     WHERE status = 'active'
     ORDER BY platform, name`
  );
  return res.rows;
}
