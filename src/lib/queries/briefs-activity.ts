// Activity log queries — log + fetch.
// Pattern: caller chuẩn bị actor info (id + name) từ session, log function
// chỉ insert. Decouple khỏi auth lookup.

import type { PoolClient } from 'pg';
import { db } from '@/lib/db';
import type { BriefStatusT } from '@/lib/briefs/brief-types';

export type BriefActivityAction = 'created' | 'status_changed' | 'content_edited';

export interface BriefActivity {
  id: string;
  action: BriefActivityAction;
  actor_name: string | null;
  from_status: BriefStatusT | null;
  to_status: BriefStatusT | null;
  detail: string | null;
  created_at: string;
}

export interface LogActivityArgs {
  brief_id: string;
  action: BriefActivityAction;
  actor_member_id: string | null;
  actor_name: string | null;
  from_status?: BriefStatusT | null;
  to_status?: BriefStatusT | null;
  detail?: string | null;
}

/** Insert 1 activity row.
 *  Truyền `client` khi muốn chạy trong transaction (VD log create + insert brief
 *  cùng 1 transaction); không truyền thì dùng pool default. */
export async function logActivity(
  args: LogActivityArgs,
  client: PoolClient | null = null
): Promise<void> {
  const executor = client ?? db;
  await executor.query(
    `INSERT INTO brief_activity
       (brief_id, action, actor_member_id, actor_name, from_status, to_status, detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      args.brief_id,
      args.action,
      args.actor_member_id,
      args.actor_name,
      args.from_status ?? null,
      args.to_status ?? null,
      args.detail ?? null,
    ]
  );
}

interface ActivityRow {
  id: string;
  action: BriefActivityAction;
  actor_name: string | null;
  from_status: BriefStatusT | null;
  to_status: BriefStatusT | null;
  detail: string | null;
  created_at: Date;
}

/** Fetch toàn bộ activity của 1 brief — sort newest first */
export async function fetchActivityForBrief(
  briefId: string
): Promise<BriefActivity[]> {
  const result = await db.query<ActivityRow>(
    `SELECT id, action, actor_name, from_status, to_status, detail, created_at
     FROM brief_activity
     WHERE brief_id = $1
     ORDER BY created_at DESC`,
    [briefId]
  );
  return result.rows.map((r) => ({
    id: r.id,
    action: r.action,
    actor_name: r.actor_name,
    from_status: r.from_status,
    to_status: r.to_status,
    detail: r.detail,
    created_at: r.created_at.toISOString(),
  }));
}
