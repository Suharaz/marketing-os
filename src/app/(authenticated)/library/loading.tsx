// Streaming loading skeleton for the library page.
// Mirrors the new layout: header → stats cards → toolbar → tabs → grid.

export default function LibraryLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="h-6 w-56 rounded bg-zinc-200" />
        <div className="h-3 w-80 rounded bg-zinc-100" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white ring-1 ring-zinc-200 px-5 py-4 flex flex-col gap-2">
            <div className="h-3 w-20 rounded bg-zinc-200" />
            <div className="h-8 w-24 rounded bg-zinc-200" />
            <div className="h-3 w-32 rounded bg-zinc-100" />
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex gap-3">
        <div className="flex-1 h-9 rounded-lg bg-zinc-200" />
        <div className="w-44 h-9 rounded-lg bg-zinc-200" />
        <div className="w-40 h-9 rounded-lg bg-zinc-200" />
      </div>

      {/* Platform tabs row */}
      <div className="flex gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-7 w-20 rounded-full bg-zinc-200" />
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white ring-1 ring-zinc-200 overflow-hidden">
            <div className="aspect-[16/10] bg-zinc-200" />
            <div className="p-3 flex flex-col gap-2">
              <div className="h-3 w-full rounded bg-zinc-100" />
              <div className="h-3 w-4/5 rounded bg-zinc-100" />
              <div className="flex gap-3 mt-1">
                <div className="h-3 w-10 rounded bg-zinc-100" />
                <div className="h-3 w-10 rounded bg-zinc-100" />
                <div className="h-3 w-10 rounded bg-zinc-100" />
              </div>
              <div className="flex justify-between gap-2 pt-2 border-t border-zinc-100">
                <div className="h-3 w-20 rounded bg-zinc-100" />
                <div className="h-3 w-12 rounded bg-zinc-100" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
