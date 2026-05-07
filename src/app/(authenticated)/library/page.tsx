// Library page — main entry. Server component: fetches stats + posts +
// account options in parallel, then composes header / stats / toolbar /
// platform tabs / post grid / load-more.

import type { Metadata } from 'next';
import {
  fetchActiveAccounts,
  fetchLibraryPosts,
} from '@/lib/queries/library-posts';
import { fetchLibraryStats } from '@/lib/queries/library-stats';
import { parseFilterParams } from '@/lib/library/parse-filter-params';
import { LibraryStatsCards } from './library-stats-cards';
import { LibrarySearchBar } from './library-search-bar';
import { LibrarySortSelect } from './library-sort-select';
import { LibraryFilterSidebar } from './library-filter-sidebar';
import { LibraryPlatformTabs } from './library-platform-tabs';
import { PostGrid } from './post-grid';
import { LoadMoreButton } from './load-more-button';

export const metadata: Metadata = {
  title: 'Thư viện — Marketing OS',
};

interface LibraryPageProps {
  // Next.js 16 streams searchParams as a Promise — must await before reading.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const NUMBER_FMT = new Intl.NumberFormat('vi-VN');

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const params = await searchParams;
  const filter = parseFilterParams(params);

  // Parallel fetch — independent queries.
  const [stats, postResult, accounts] = await Promise.all([
    fetchLibraryStats(filter),
    fetchLibraryPosts(filter),
    fetchActiveAccounts(),
  ]);

  const { posts, nextCursor } = postResult;

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Thư viện nội dung</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Archive toàn bộ content · search · filter · phân tích hiệu suất
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <LibraryStatsCards stats={stats} />

      {/* Toolbar — search · sort · advanced filters */}
      <div className="flex flex-wrap items-center gap-3">
        <LibrarySearchBar />
        <LibrarySortSelect />
        <LibraryFilterSidebar accounts={accounts} />
      </div>

      {/* Platform tabs + result counter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LibraryPlatformTabs />
        <p className="text-xs text-zinc-500 shrink-0">
          Hiển thị <span className="font-semibold text-zinc-700">{NUMBER_FMT.format(posts.length)}</span>
          {' / '}
          <span className="font-semibold text-zinc-700">{NUMBER_FMT.format(stats.total)}</span> content
        </p>
      </div>

      {/* Grid or empty state */}
      {posts.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <PostGrid posts={posts} />
          <LoadMoreButton initialCursor={nextCursor} />
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl bg-white ring-1 ring-zinc-200 px-6 py-12 text-center">
      <p className="text-sm font-medium text-zinc-700">Chưa có bài viết khớp bộ lọc</p>
      <p className="mt-1 text-xs text-zinc-500">
        Thử bỏ bớt điều kiện lọc hoặc xoá từ khoá tìm kiếm.
      </p>
    </div>
  );
}
