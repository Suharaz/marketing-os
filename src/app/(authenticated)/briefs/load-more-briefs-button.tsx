'use client';

// Nút "Tải thêm" dưới list inbox.
// Chỉ render khi còn cursor (hasMore=true). Disabled khi đang loading.

interface LoadMoreBriefsButtonProps {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}

export function LoadMoreBriefsButton({
  hasMore,
  loading,
  onLoadMore,
}: LoadMoreBriefsButtonProps) {
  if (!hasMore) return null;
  return (
    <button
      type="button"
      onClick={onLoadMore}
      disabled={loading}
      className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? 'Đang tải…' : 'Tải thêm 8 brief'}
    </button>
  );
}
