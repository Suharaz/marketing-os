// Default loading skeleton for every authenticated route.
//
// Next.js wraps `{children}` in <Suspense fallback={<Loading />}> automatically.
// So the moment a user clicks a sidebar link, this component renders INSTANTLY
// while the new page's Server Component fetches data. Without this file, the
// browser stays on the previous page until data is ready — feels like a 1-2s
// freeze even though network is fine.
//
// Per-route loading.tsx (e.g. dashboard/loading.tsx) overrides this generic one
// when content shape is well-known and worth a tailored skeleton.

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 rounded bg-zinc-200" />
          <div className="h-4 w-64 rounded bg-zinc-200" />
        </div>
        <div className="h-9 w-28 rounded-md bg-zinc-200" />
      </div>

      {/* Card grid placeholder — works for KPI rows, member grids, channel lists */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-xl border border-zinc-200 bg-white p-5 space-y-3"
          >
            <div className="h-3 w-20 rounded bg-zinc-200" />
            <div className="h-8 w-32 rounded bg-zinc-200" />
            <div className="h-3 w-24 rounded bg-zinc-200" />
          </div>
        ))}
      </div>

      {/* Table / list placeholder */}
      <div className="rounded-xl border border-zinc-200 bg-white">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 border-b border-zinc-100 last:border-0"
          >
            <div className="size-8 rounded-full bg-zinc-200 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 rounded bg-zinc-200" />
              <div className="h-3 w-1/2 rounded bg-zinc-200" />
            </div>
            <div className="h-3 w-16 rounded bg-zinc-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
