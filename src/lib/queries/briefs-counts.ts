// Counts theo từng status — dùng cho badge số trên tabs.
// 1 query GROUP BY là đủ, trả về object { mine: 5, draft: 3, ... }.

import { db } from '@/lib/db';
import type { BriefStatusT } from '@/lib/briefs/brief-types';

export type BriefCounts = Record<BriefStatusT, number>;

const ZERO_COUNTS: BriefCounts = {
  mine: 0,
  draft: 0,
  submitted: 0,
  published: 0,
  revision: 0,
};

interface CountRow {
  status: BriefStatusT;
  count: string; // pg trả về string cho COUNT(*)
}

export async function fetchBriefsCounts(): Promise<BriefCounts> {
  const result = await db.query<CountRow>(
    `SELECT status, COUNT(*)::text AS count
     FROM briefs
     GROUP BY status`
  );
  const counts: BriefCounts = { ...ZERO_COUNTS };
  for (const row of result.rows) {
    counts[row.status] = Number(row.count);
  }
  return counts;
}
