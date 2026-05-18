// POST /api/news/ingest — kích hoạt thủ công job-news-ingestion.
//
// Use cases:
//   - Bootstrap: vừa migrate xong, không muốn đợi tới phút 15 kế tiếp
//   - Debug: test sau khi sửa parser/source
//   - Admin: refresh tin ngay khi có nhu cầu
//
// Auth: chỉ user đăng nhập mới gọi được (chống spam endpoint).
// Không debounce vì lượng caller là admin nội bộ, hiếm.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-session';
import { runNewsIngestionJob } from '@/lib/cron/job-news-ingestion';
import { revalidateTag } from 'next/cache';

export const runtime = 'nodejs';

export async function POST(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await runNewsIngestionJob();
    // Invalidate cache để UI thấy data mới ngay sau khi ingest.
    // 'max' = stale-while-revalidate, required positional arg ở Next.js 16
    // (single-arg signature deprecated). Pattern giống dashboard-cache.ts.
    revalidateTag('news', 'max');
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error('[POST /api/news/ingest]', msg);
    return NextResponse.json({ error: 'Ingestion failed', detail: msg }, { status: 500 });
  }
}
