import { Metadata } from 'next';
import { getKpiData, getTrendData } from '@/lib/cache/dashboard-cache';
import { fetchChannelsTable } from '@/lib/queries/dashboard-channels-table';
import { fetchUnreadAlerts } from '@/lib/queries/alerts';
import { fetchTopPerformers } from '@/lib/queries/dashboard-top-performers';
import { parseRangeParam } from '@/lib/dashboard/time-range';
import { KpiHeroGrid } from '@/components/dashboard/kpi-hero-grid';
import { PerformanceTrendChart } from '@/components/dashboard/performance-trend-chart';
import { ChannelsTable } from '@/components/dashboard/channels-table';
import { TopPerformersRankedList } from '@/components/dashboard/top-performers-ranked-list';
import { ActiveCampaignsList } from '@/components/dashboard/active-campaigns-list';
import { AlertsFeed } from '@/components/dashboard/alerts-feed';
import { TimeRangeSelector } from '@/components/dashboard/time-range-selector';

export const metadata: Metadata = {
  title: 'Dashboard — Marketing OS',
};

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const days = parseRangeParam(params.range);

  // Fetch in parallel — independent queries, no shared state.
  const [kpi, trend, channels, alerts, topPerformers] = await Promise.all([
    getKpiData(days),
    getTrendData(days),
    fetchChannelsTable(days),
    fetchUnreadAlerts(10),
    fetchTopPerformers(days, 5),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {/* Page header — title + time range selector */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Bảng điều khiển CEO</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Hiệu suất toàn hệ thống · {days} ngày qua (không tính hôm nay)
          </p>
        </div>
        <TimeRangeSelector current={days} />
      </div>

      {/* Tier 1: 4 KPI cards with sparklines */}
      <KpiHeroGrid data={kpi} days={days} trend={trend} />

      {/* Tier 2: Performance trend full-width */}
      <PerformanceTrendChart data={trend} days={days} />

      {/* Tier 3: Chanel table full-width (replaces sidebar Channel Health widget) */}
      <ChannelsTable data={channels} days={days} />

      {/* Tier 4: Top Performers / Alerts / Active Campaigns.
          On <lg, stack full-width. On md, 2-col with campaigns wrapping. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <TopPerformersRankedList performers={topPerformers} days={days} />
        <AlertsFeed initialData={alerts} />
        <ActiveCampaignsList />
      </div>
    </div>
  );
}
