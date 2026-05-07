import { KpiHeroCard } from './kpi-hero-card';
import type { KpiData } from '@/lib/queries/dashboard-kpi';
import type { TrendDataPoint } from '@/lib/queries/dashboard-trend';

const EMPTY_MESSAGE = 'Chờ cron sync đầu tiên (chạy 02:00, 10:00, 18:00)';

function isAllZero(data: KpiData): boolean {
  return (
    data.reach === 0 &&
    data.avgEr === 0 &&
    data.conversions === 0 &&
    data.totalFollowers === 0
  );
}

interface KpiHeroGridProps {
  data: KpiData;
  days: number;
  // Trend data drives sparkline series. Optional: empty array hides charts.
  trend?: TrendDataPoint[];
}

export function KpiHeroGrid({ data, days, trend = [] }: KpiHeroGridProps) {
  if (isAllZero(data)) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-4 text-sm text-amber-700">
        {EMPTY_MESSAGE}
      </div>
    );
  }

  const compareLabel = `so với ${days} ngày trước`;

  // Single-series arrays for each card's sparkline.
  // engagement_rate isn't a column on trend → derive (engagement / reach * 100).
  // conversions now has a real daily series — sourced from manual_conversion.
  const reachSeries = trend.map((t) => t.reach);
  const erSeries = trend.map((t) =>
    t.reach > 0 ? (t.engagement / t.reach) * 100 : 0
  );
  const convSeries = trend.map((t) => t.conversions);
  const followersSeries = trend.map((t) => t.followers);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiHeroCard
        title="Total Reach"
        icon="👁"
        value={data.reach}
        prevValue={data.reachPrev}
        format="number"
        subtitle={compareLabel}
        sparkline={reachSeries}
        sparklineColor="#3B82F6"
      />
      <KpiHeroCard
        title="Engagement Rate"
        icon="💬"
        value={data.avgEr}
        prevValue={data.avgErPrev}
        format="percent"
        subtitle={compareLabel}
        accentClass="border-l-4 border-l-orange-400"
        sparkline={erSeries}
        sparklineColor="#F97316"
      />
      <KpiHeroCard
        title="Conversions"
        icon="🎯"
        value={data.conversions}
        prevValue={data.conversionsPrev}
        format="number"
        subtitle="attributed qua UTM"
        accentClass="border-l-4 border-l-green-400"
        sparkline={convSeries}
        sparklineColor="#10B981"
      />
      <KpiHeroCard
        title="Total Followers"
        icon="👥"
        value={data.totalFollowers}
        prevValue={data.totalFollowersPrev}
        format="number"
        subtitle={compareLabel}
        accentClass="border-l-4 border-l-purple-400"
        sparkline={followersSeries}
        sparklineColor="#A855F7"
      />
    </div>
  );
}
