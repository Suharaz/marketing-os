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
import { ManualRunButtons } from './manual-run-buttons';

declare global {
  // eslint-disable-next-line no-var
  var __cron_initialized: boolean | undefined;
}

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
  page_insights: '02:00 UTC daily',
  posts: '02:30, 10:30, 18:30 UTC',
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
    fetchCronHistory({ status, syncType, limit: 100 }),
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

      {/* Runtime status + manual triggers */}
      <RuntimeStatusPanel />

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

function RuntimeStatusPanel() {
  // Đọc trực tiếp từ globalThis — initCrons set flag này khi register thành công.
  // Nếu false trong production = instrumentation hook không chạy → cron chết.
  const initialized = globalThis.__cron_initialized === true;
  const now = new Date();
  const utcOffsetHours = -now.getTimezoneOffset() / 60;

  // Per-job env config check — surface missing vars so user doesn't
  // discover them only after a failed cron run.
  const missingLadipageEnv: string[] = [];
  if (!process.env.LADIPAGE_WEBHOOK_URL) missingLadipageEnv.push('LADIPAGE_WEBHOOK_URL');
  if (!process.env.LADIPAGE_API_KEY)     missingLadipageEnv.push('LADIPAGE_API_KEY');

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <h3 className="text-sm font-semibold text-zinc-900">Trạng thái runtime</h3>
        <span
          className={
            initialized
              ? 'inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200'
              : 'inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 border border-red-200'
          }
        >
          {initialized
            ? '● Scheduler initialized'
            : '✗ Scheduler NOT initialized — kiểm tra instrumentation log'}
        </span>
      </div>

      {missingLadipageEnv.length > 0 && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="font-semibold mb-0.5">
            ⚠ Ladipage sync sẽ luôn fail — thiếu env vars:
          </p>
          <p className="font-mono">{missingLadipageEnv.join(', ')}</p>
          <p className="mt-1 text-amber-700">
            Add 2 biến này vào Coolify → Environment Variables, redeploy.
            Tham khảo <code>.env.example</code>.
          </p>
        </div>
      )}

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-xs mb-4">
        <div className="flex flex-col">
          <dt className="text-zinc-500">Server time (UTC)</dt>
          <dd className="font-mono text-zinc-900">{now.toISOString()}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-zinc-500">Server time (Asia/Ho_Chi_Minh)</dt>
          <dd className="font-mono text-zinc-900">
            {now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-zinc-500">Container TZ offset</dt>
          <dd className="font-mono text-zinc-900">
            {utcOffsetHours >= 0 ? '+' : ''}
            {utcOffsetHours}h (env.TZ={process.env.TZ ?? 'unset'})
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-zinc-500">Node</dt>
          <dd className="font-mono text-zinc-900">{process.version}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-zinc-500">PID</dt>
          <dd className="font-mono text-zinc-900">
            {process.pid} (uptime {Math.floor(process.uptime())}s)
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-zinc-500">NEXT_RUNTIME</dt>
          <dd className="font-mono text-zinc-900">
            {process.env.NEXT_RUNTIME ?? 'unset'}
          </dd>
        </div>
      </dl>

      <div className="border-t border-zinc-100 pt-3">
        <p className="text-xs text-zinc-500 mb-2">
          Chạy thủ công để verify scheduler không ảnh hưởng đến code job.
          Nếu nút này thành công nhưng cron auto không fire → vấn đề là
          instrumentation/scheduler.
        </p>
        <ManualRunButtons />
      </div>
    </section>
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
