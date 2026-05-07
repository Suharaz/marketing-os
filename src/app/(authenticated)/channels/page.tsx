import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchChannelsList, fetchChannelsSummary } from '@/lib/queries/channels-list';
import { ChannelCard } from './channel-card';
import { ChannelsFilterBar } from './channels-filter-bar';
import { PlatformTabs } from './platform-tabs';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Kênh truyền thông — Marketing OS',
};

interface PageProps {
  searchParams: Promise<{
    platform?: string;
    status?: string;
    sort?: string;
  }>;
}

export default async function ChannelsPage({ searchParams }: PageProps) {
  // Next.js 16 requires awaiting searchParams before reading.
  const sp = await searchParams;

  // Fetch list (filtered) + summary (always all-channels for KPI cards) in parallel.
  const [channels, summary] = await Promise.all([
    fetchChannelsList({
      platform: sp.platform ?? null,
      status: sp.status ?? null,
      sort: sp.sort ?? null,
    }),
    fetchChannelsSummary(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Header row ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Kênh truyền thông</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Quản lý kênh · trạng thái kết nối · health score
          </p>
        </div>
        <Link href="/channels/new">
          <Button className="bg-orange-500 hover:bg-orange-600 text-white">
            + Onboard kênh mới
          </Button>
        </Link>
      </div>

      {/* ─── KPI summary cards ──────────────────────────────────────── */}
      <SummaryCards summary={summary} />

      {/* ─── Tabs theo platform (count động từ data thật) ───────────── */}
      <PlatformTabs
        currentPlatform={sp.platform ?? 'all'}
        total={summary.total}
        byPlatform={summary.byPlatform}
      />

      {/* ─── Filter bar (status + sort) ─────────────────────────────── */}
      <ChannelsFilterBar />

      {/* ─── Channel grid ───────────────────────────────────────────── */}
      {channels.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {channels.map((c) => (
            <ChannelCard key={c.id} channel={c} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────

function SummaryCards({
  summary,
}: {
  summary: { total: number; active: number; avgHealth: number | null };
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <KpiCard
        label="TỔNG KÊNH"
        value={summary.total.toString()}
        hint="đang theo dõi"
        accent="text-zinc-900"
      />
      <KpiCard
        label="HOẠT ĐỘNG"
        value={summary.active.toString()}
        hint={`${summary.total - summary.active} kênh không khả dụng`}
        accent="text-emerald-600"
      />
      <KpiCard
        label="HEALTH TB"
        value={summary.avgHealth !== null ? summary.avgHealth.toFixed(0) : '—'}
        hint="trung bình toàn hệ thống"
        accent="text-blue-600"
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-bold ${accent}`}>{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center">
      <p className="text-sm text-zinc-600">
        Chưa có kênh nào khớp bộ lọc. Hãy thử bỏ bộ lọc hoặc{' '}
        <Link href="/channels/new" className="text-orange-600 hover:underline font-medium">
          onboard kênh mới
        </Link>
        .
      </p>
    </div>
  );
}
