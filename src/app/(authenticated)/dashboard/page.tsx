import { Metadata } from 'next';
import { fetchKpiData } from '@/lib/queries/dashboard-kpi';
import { fetchTrendData } from '@/lib/queries/dashboard-trend';
import { fetchChannelHealth } from '@/lib/queries/dashboard-channel-health';
import { fetchUnreadAlerts } from '@/lib/queries/alerts';
import { fetchTopPerformers } from '@/lib/queries/dashboard-top-performers';
import { parseRangeParam } from '@/lib/dashboard/time-range';
import { KpiHeroGrid } from '@/components/dashboard/kpi-hero-grid';
import { PerformanceTrendChart } from '@/components/dashboard/performance-trend-chart';
import { ChannelHealthGrid } from '@/components/dashboard/channel-health-grid';
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
  const [kpi, trend, health, alerts, topPerformers] = await Promise.all([
    fetchKpiData(days),
    fetchTrendData(days),
    fetchChannelHealth(),
    fetchUnreadAlerts(10),
    fetchTopPerformers(5),
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

      {/* Tier 2: Performance trend (2/3) + Channel Health (1/3).
          On <lg, both stack full-width. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PerformanceTrendChart data={trend} days={days} />
        </div>
        <div className="lg:col-span-1">
          <ChannelHealthGrid data={health} />
        </div>
      </div>

      {/* Tier 3: Top Performers / Alerts / Active Campaigns.
          On <lg, stack full-width. On md, 2-col with campaigns wrapping. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <TopPerformersRankedList performers={topPerformers} />
        <AlertsFeed initialData={alerts} />
        <ActiveCampaignsList />
      </div>
    </div>
  );
}
