'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { LibraryPost } from '@/lib/queries/library-posts';
import { PostGrid } from './post-grid';

interface LoadMoreButtonProps {
  initialCursor: string | null;
}

export function LoadMoreButton({ initialCursor }: LoadMoreButtonProps) {
  const searchParams = useSearchParams();
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [extraPosts, setExtraPosts] = useState<LibraryPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLoadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);

    try {
      // Preserve all current filters, replace cursor
      const params = new URLSearchParams(searchParams.toString());
      params.set('cursor', cursor);

      const res = await fetch(`/api/library?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Lỗi tải dữ liệu: ${res.status}`);
      }

      const data = (await res.json()) as {
        posts: LibraryPost[];
        nextCursor: string | null;
      };

      setExtraPosts((prev) => [...prev, ...data.posts]);
      setCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Render extra pages below the server-rendered grid */}
      {extraPosts.length > 0 && (
        <div className="mt-4">
          <PostGrid posts={extraPosts} />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}

      {cursor !== null && (
        <div className="flex justify-center mt-6">
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="rounded-lg border border-zinc-200 bg-white px-6 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Đang tải…' : 'Tải thêm bài viết'}
          </button>
        </div>
      )}
    </>
  );
}
