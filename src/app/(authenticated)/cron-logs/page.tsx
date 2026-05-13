import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-session';
import { getUserRole } from '@/lib/auth/get-role';
import {
  fetchCronHistory,
  fetchCronStats,
} from '@/lib/queries/cron-history';
import type { SyncTypeT, SyncStatusT } from '@/lib/db-types';
import { CronLogTable } from './cron-log-table';

export const metadata: Metadata = {
  title: 'Lịch sử cron — Marketing OS',
};

// Luôn fetch live data — cron status đổi liên tục.
export const dynamic = 'force-dynamic';

const JOB_LABEL: Record<SyncTypeT, string> = {
  page_insights: 'Page insights',
  posts: 'Posts ingestion',
  health_recompute: 'Health recompute',
  manual_refresh: 'Manual refresh',
  ladipage: 'Ladipage sync',
};

const JOB_SCHEDULE: Record<SyncTypeT, string> = {
  page_insights: '02:00, 10:00, 18:00 UTC',
  posts: '02:30 UTC daily',
  health_recompute: '03:00 UTC daily',
  manual_refresh: 'On demand',
  ladipage: '23:30 Asia/Ho_Chi_Minh daily',
};

const VALID_STATUS = new Set<SyncStatusT>(['success', 'failed', 'running']);
const VALID_TYPES = new Set<SyncTypeT>([
  'page_insights',
  'posts',
  'health_recompute',
  'manual_refresh',
  'ladipage',
]);

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

interface PageProps {
  searchParams: Promise<{ status?: string; type?: string }>;
}

export default async function CronLogsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const role = await getUserRole(user.userId);
  if (role !== 'admin') redirect('/dashboard');

  const sp = await searchParams;
  const status =
    sp.status && VALID_STATUS.has(sp.status as SyncStatusT)
      ? (sp.status as SyncStatusT)
      : undefined;
  const syncType =
    sp.type && VALID_TYPES.has(sp.type as SyncTypeT)
      ? (sp.type as SyncTypeT)
      : undefined;

  const [stats, rows] = await Promise.all([
    fetchCronStats(),
    fetchCronHistory({ status, syncType, limit: 200 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-zinc-900">Lịch sử cron</h2>
        <p className="text-sm text-zinc-500 mt-0.5">
          Mỗi job ghi 1 row per account/run vào bảng <code>api_sync_log</code>.
          Bấm vào dòng để xem chi tiết các API call đã thực hiện.
        </p>
      </div>

      {/* Stats — 24h overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Thành công (24h)"
          value={stats.last24h.success}
          tone="emerald"
        />
        <StatCard
          label="Thất bại (24h)"
          value={stats.last24h.failed}
          tone={stats.last24h.failed > 0 ? 'red' : 'zinc'}
        />
        <StatCard
          label="Đang chạy"
          value={stats.last24h.running}
          tone={stats.last24h.running > 0 ? 'blue' : 'zinc'}
        />
        <StatCard
          label="Chạy thành công gần nhất"
          value={
            stats.lastSuccessAt
              ? formatTime(stats.lastSuccessAt)
              : 'Chưa có'
          }
          tone="zinc"
          isText
        />
      </div>

      {/* Schedule reference */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900 mb-3">
          Lịch trình
        </h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          {(Object.keys(JOB_LABEL) as SyncTypeT[])
            .filter((k) => k !== 'manual_refresh')
            .map((k) => (
              <div key={k} className="flex items-center gap-2">
                <dt className="text-zinc-500 w-36 shrink-0">
                  {JOB_LABEL[k]}
                </dt>
                <dd className="text-zinc-900 font-mono text-xs">
                  {JOB_SCHEDULE[k]}
                </dd>
              </div>
            ))}
        </dl>
      </section>

      {/* Filter bar */}
      <FilterBar status={status} type={syncType} />

      {/* Table */}
      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <CronLogTable rows={rows} />
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  isText = false,
}: {
  label: string;
  value: number | string;
  tone: 'emerald' | 'red' | 'blue' | 'zinc';
  isText?: boolean;
}) {
  const toneClass = {
    emerald: 'text-emerald-700',
    red: 'text-red-700',
    blue: 'text-blue-700',
    zinc: 'text-zinc-900',
  }[tone];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p
        className={`font-semibold ${toneClass} ${
          isText ? 'text-sm' : 'text-2xl'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function FilterBar({
  status,
  type,
}: {
  status?: SyncStatusT;
  type?: SyncTypeT;
}) {
  const buildHref = (next: { status?: string; type?: string }) => {
    const params = new URLSearchParams();
    const s = next.status ?? status;
    const t = next.type ?? type;
    if (s) params.set('status', s);
    if (t) params.set('type', t);
    const q = params.toString();
    return q ? `?${q}` : '/cron-logs';
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-zinc-500">Filter:</span>

      <FilterPill href={buildHref({ status: '' })} active={!status}>
        Tất cả status
      </FilterPill>
      <FilterPill href={buildHref({ status: 'success' })} active={status === 'success'}>
        Thành công
      </FilterPill>
      <FilterPill href={buildHref({ status: 'failed' })} active={status === 'failed'}>
        Lỗi
      </FilterPill>
      <FilterPill href={buildHref({ status: 'running' })} active={status === 'running'}>
        Đang chạy
      </FilterPill>

      <span className="text-zinc-300 mx-1">·</span>

      <FilterPill href={buildHref({ type: '' })} active={!type}>
        Tất cả job
      </FilterPill>
      {(Object.keys(JOB_LABEL) as SyncTypeT[]).map((k) => (
        <FilterPill
          key={k}
          href={buildHref({ type: k })}
          active={type === k}
        >
          {JOB_LABEL[k]}
        </FilterPill>
      ))}
    </div>
  );
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={
        active
          ? 'rounded-full bg-zinc-900 px-2.5 py-1 text-white'
          : 'rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700 hover:bg-zinc-50'
      }
    >
      {children}
    </a>
  );
}
