// Briefs page — server component.
// Fetch initial: counts (badge tabs) + first page (10) of "mine" tab.
// Khi user switch tab khác, client gọi API tự fetch (xem use-briefs-state.ts).

import { Metadata } from 'next';
import { fetchBriefs } from '@/lib/queries/briefs-list';
import { fetchBriefsCounts } from '@/lib/queries/briefs-counts';
import { BriefsBoard } from './briefs-board';

export const metadata: Metadata = {
  title: 'Xưởng nội dung — Marketing OS',
};

// Disable static generation — query DB realtime mỗi request
export const dynamic = 'force-dynamic';

export default async function BriefsPage() {
  // Parallel fetch — counts + first page mine
  const [{ briefs, nextCursor }, counts] = await Promise.all([
    fetchBriefs({ status: 'mine' }),
    fetchBriefsCounts(),
  ]);

  return (
    <BriefsBoard
      initialBriefs={briefs}
      initialCursor={nextCursor}
      initialCounts={counts}
    />
  );
}
