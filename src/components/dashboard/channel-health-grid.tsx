import { ChannelHealthCard } from './channel-health-card';
import type { ChannelHealthData } from '@/lib/queries/dashboard-channel-health';

interface ChannelHealthGridProps {
  data: ChannelHealthData[];
}

// Dashboard sidebar widget: vertical list of channels sorted by health score.
// Layout matches the right column of the mockup (narrow column, dense rows).
export function ChannelHealthGrid({ data }: ChannelHealthGridProps) {
  return (
    <div className="rounded-xl bg-white ring-1 ring-zinc-200 shadow-sm p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-700">Channel Health</h3>
        <a
          href="/channels"
          className="text-xs text-blue-600 hover:underline"
        >
          Xem tất cả →
        </a>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-zinc-400 py-8 text-center">
          Chưa có data — chờ cron sync đầu tiên
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-100 -mx-1">
          {data.map((channel) => (
            <li key={channel.accountId} className="px-1">
              <ChannelHealthCard channel={channel} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
