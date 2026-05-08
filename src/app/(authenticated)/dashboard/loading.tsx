export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      {/* Title skeleton */}
      <div className="flex flex-col gap-2">
        <div className="h-6 w-48 rounded-md bg-zinc-200" />
        <div className="h-4 w-64 rounded-md bg-zinc-100" />
      </div>

      {/* KPI grid skeleton — 5 cards: Reach, ER, Lead, Doanh thu, Followers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white ring-1 ring-zinc-200 p-5 flex flex-col gap-3">
            <div className="h-3 w-24 rounded bg-zinc-100" />
            <div className="h-8 w-32 rounded bg-zinc-200" />
            <div className="h-3 w-20 rounded bg-zinc-100" />
          </div>
        ))}
      </div>

      {/* Trend chart skeleton */}
      <div className="rounded-xl bg-white ring-1 ring-zinc-200 p-5">
        <div className="h-4 w-36 rounded bg-zinc-200 mb-4" />
        <div className="h-[300px] rounded-lg bg-zinc-100" />
      </div>

      {/* Channel health skeleton */}
      <div className="rounded-xl bg-white ring-1 ring-zinc-200 p-5">
        <div className="h-4 w-28 rounded bg-zinc-200 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-zinc-100 h-28" />
          ))}
        </div>
      </div>

      {/* Tier 3 skeleton: 3-column (top performers / alerts / campaigns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white ring-1 ring-zinc-200 p-5">
            <div className="h-4 w-28 rounded bg-zinc-200 mb-4" />
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((__, j) => (
                <div key={j} className="h-12 rounded bg-zinc-100" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
