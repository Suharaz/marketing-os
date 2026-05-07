// Active campaigns widget for dashboard.
// TODO: replace MOCK_CAMPAIGNS once a `campaign` table or briefs-with-campaign-id is shipped.

interface CampaignRow {
  id: string;
  name: string;
  meta: string; // e.g. "20 conversions · 3 weeks"
  reach: number;
  conv: number;
  progress: number; // 0..100
}

const MOCK_CAMPAIGNS: CampaignRow[] = [
  {
    id: 'ai-founder-q2',
    name: 'AI for Founder Q2/2026',
    meta: '28 contents · 5 weeks',
    reach: 1_400_000,
    conv: 84,
    progress: 64,
  },
  {
    id: 'solopreneur-track',
    name: 'Solopreneur Track',
    meta: '14 contents · 3 weeks',
    reach: 620_000,
    conv: 32,
    progress: 41,
  },
  {
    id: 'rootmax-launch',
    name: 'ROOTMAX Launch',
    meta: '8 contents · 2 weeks',
    reach: 188_000,
    conv: 13,
    progress: 22,
  },
  {
    id: 'vb-band-teaser',
    name: 'VB Band Teaser',
    meta: '4 contents · 1 week',
    reach: 42_000,
    conv: 8,
    progress: 11,
  },
];

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// Bar color shifts cool→warm as progress increases. Just a visual cue —
// it has no semantic meaning beyond "further along = more saturated".
function progressColor(p: number): string {
  if (p >= 60) return 'bg-blue-500';
  if (p >= 30) return 'bg-blue-400';
  return 'bg-blue-300';
}

export function ActiveCampaignsList() {
  return (
    <div className="rounded-xl bg-white ring-1 ring-zinc-200 shadow-sm p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-700">Active Campaigns</h3>
        <a href="/briefs" className="text-xs text-blue-600 hover:underline">
          + New
        </a>
      </div>

      {/* Column header — keeps numbers aligned with rows below */}
      <div className="grid grid-cols-[1fr_56px_40px_72px] gap-2 px-1 pb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 border-b border-zinc-100">
        <span>Campaign</span>
        <span className="text-right">Reach</span>
        <span className="text-right">Conv</span>
        <span className="text-right">Progress</span>
      </div>

      <ul className="flex flex-col divide-y divide-zinc-100 flex-1">
        {MOCK_CAMPAIGNS.map((c) => (
          <li
            key={c.id}
            className="grid grid-cols-[1fr_56px_40px_72px] gap-2 items-center px-1 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-zinc-800 leading-tight">
                {c.name}
              </p>
              <p className="truncate text-[10px] text-zinc-400 mt-0.5">{c.meta}</p>
            </div>
            <span className="text-xs text-zinc-700 tabular-nums text-right">
              {formatNumber(c.reach)}
            </span>
            <span className="text-xs text-zinc-700 tabular-nums text-right">
              {c.conv}
            </span>
            <div className="flex items-center gap-1.5">
              <div className="flex-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${progressColor(c.progress)}`}
                  style={{ width: `${c.progress}%` }}
                />
              </div>
              <span className="text-[10px] font-semibold text-zinc-500 tabular-nums w-7 text-right">
                {c.progress}%
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
