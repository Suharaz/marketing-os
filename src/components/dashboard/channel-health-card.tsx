import Link from 'next/link';
import { cn } from '@/lib/utils';
import { PlatformIcon } from './platform-icon';
import type { ChannelHealthData } from '@/lib/queries/dashboard-channel-health';

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-500';
  return 'text-red-500';
}

function getBarColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-amber-400';
  return 'bg-red-400';
}

// Friendly platform display name for the secondary text.
function getPlatformName(platform: string): string {
  const map: Record<string, string> = {
    facebook: 'Facebook',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    instagram: 'Instagram',
    threads: 'Threads',
    zalo: 'Zalo OA',
  };
  return map[platform.toLowerCase()] ?? platform;
}

interface ChannelHealthCardProps {
  channel: ChannelHealthData;
}

// Single-row layout: [brand badge] [name + meta] [progress bar] [score]
export function ChannelHealthCard({ channel }: ChannelHealthCardProps) {
  const { accountId, name, platform, healthScore } = channel;

  return (
    <Link
      href={`/channels/${accountId}`}
      className="flex items-center gap-3 py-2.5 px-1 rounded-md hover:bg-zinc-50 transition-colors"
    >
      <PlatformIcon platform={platform} badge size={16} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-zinc-800 leading-tight">
          {name}
        </p>
        <p className="text-[10px] text-zinc-400 mt-0.5">{getPlatformName(platform)}</p>
      </div>

      <div className="hidden sm:block flex-1 max-w-[80px] h-1.5 rounded-full bg-zinc-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full', getBarColor(healthScore))}
          style={{ width: `${Math.min(healthScore, 100)}%` }}
        />
      </div>

      <span
        className={cn(
          'text-sm font-bold tabular-nums shrink-0 w-7 text-right',
          getScoreColor(healthScore)
        )}
      >
        {healthScore}
      </span>
    </Link>
  );
}
