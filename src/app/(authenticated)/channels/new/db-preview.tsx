'use client';

/**
 * Display test-token API result as DB-shaped preview tables.
 * Shows exactly what cron Job A + Job B would UPSERT into:
 *   - account_metric_daily
 *   - social_post
 *   - post_metric_daily
 */

interface Diagnostics {
  metricStatus?: Array<{ metric: string; ok: boolean; error: string | null }>;
  postMetricStatus?: Array<{ metric: string; ok: boolean; error: string | null; value: number }>;
  postsError: string | null;
}

interface Preview {
  account_metric_daily: Array<{
    date: string;
    followers: number | null;
    follower_growth: number;
    total_reach: number;
    total_engagement: number;
  }>;
  social_post: Array<{
    external_id: string;
    content: string | null;
    media_url: string | null;
    post_type: string;
    published_at: string | null;
    permalink: string | null;
  }>;
  post_metric_daily: Array<{
    external_id: string;
    date: string;
    reactions: number;
    comments: number;
    shares: number;
    reach: number;
    impressions: number;
    clicks: number;
    video_views: number;
  }>;
}

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('vi-VN');

const truncate = (s: string | null, n = 40) =>
  !s ? '—' : s.length > n ? s.slice(0, n) + '…' : s;

export function DbPreview({
  preview,
  diagnostics,
}: {
  preview: Preview;
  diagnostics: Diagnostics;
}) {
  return (
    <div className="mt-3 pt-3 border-t border-emerald-200 flex flex-col gap-4 text-xs">
      <div className="font-semibold text-emerald-900">
        Preview rows cron sẽ UPSERT vào DB
      </div>

      {/* Page-level metric diagnostics */}
      {diagnostics.metricStatus && diagnostics.metricStatus.length > 0 && (
        <details className="text-[11px]">
          <summary className="cursor-pointer text-emerald-700 hover:underline">
            🔍 Page-level metrics ({diagnostics.metricStatus.filter((m) => m.ok).length}/
            {diagnostics.metricStatus.length} sống)
          </summary>
          <ul className="mt-1 pl-4 space-y-0.5 font-mono">
            {diagnostics.metricStatus.map((m) => (
              <li
                key={m.metric}
                className={m.ok ? 'text-emerald-700' : 'text-red-600'}
              >
                {m.ok ? '✓' : '✗'} {m.metric}
                {m.error && ` — ${m.error}`}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Post-level metric diagnostics */}
      {diagnostics.postMetricStatus && diagnostics.postMetricStatus.length > 0 && (
        <details className="text-[11px]">
          <summary className="cursor-pointer text-emerald-700 hover:underline">
            🔍 Post-level metrics ({diagnostics.postMetricStatus.filter((m) => m.ok).length}/
            {diagnostics.postMetricStatus.length} sống — probe trên post mới nhất)
          </summary>
          <ul className="mt-1 pl-4 space-y-0.5 font-mono">
            {diagnostics.postMetricStatus.map((m) => (
              <li
                key={m.metric}
                className={m.ok ? 'text-emerald-700' : 'text-red-600'}
              >
                {m.ok ? '✓' : '✗'} {m.metric}
                {m.ok && ` — value=${m.value.toLocaleString('vi-VN')}`}
                {m.error && ` — ${m.error}`}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* account_metric_daily */}
      <Section title="account_metric_daily" count={preview.account_metric_daily.length}>
        {preview.account_metric_daily.length === 0 ? (
          <Empty msg="Không có metric nào hợp lệ → cron sẽ INSERT 0 row" />
        ) : (
          <Table
            headers={['date', 'followers', 'follower_growth', 'total_reach', 'total_engagement']}
            rows={preview.account_metric_daily.map((r) => [
              r.date,
              fmt(r.followers),
              fmt(r.follower_growth),
              fmt(r.total_reach),
              fmt(r.total_engagement),
            ])}
          />
        )}
      </Section>

      {/* social_post */}
      <Section title="social_post" count={preview.social_post.length}>
        {diagnostics.postsError ? (
          <Empty msg={`✗ ${diagnostics.postsError}`} />
        ) : preview.social_post.length === 0 ? (
          <Empty msg="Page chưa có post nào" />
        ) : (
          <Table
            headers={['external_id', 'content', 'post_type', 'published_at']}
            rows={preview.social_post.map((p) => [
              p.external_id.slice(0, 14) + '…',
              truncate(p.content, 40),
              p.post_type,
              p.published_at
                ? new Date(p.published_at).toLocaleDateString('vi-VN')
                : '—',
            ])}
          />
        )}
      </Section>

      {/* post_metric_daily */}
      <Section title="post_metric_daily" count={preview.post_metric_daily.length}>
        {preview.post_metric_daily.length === 0 ? (
          <Empty msg="—" />
        ) : (
          <Table
            headers={['post', 'reactions', 'reach', 'impr', 'clicks', 'video']}
            rows={preview.post_metric_daily.map((r) => [
              r.external_id.slice(0, 14) + '…',
              fmt(r.reactions),
              fmt(r.reach),
              fmt(r.impressions),
              fmt(r.clicks),
              fmt(r.video_views),
            ])}
          />
        )}
        {preview.post_metric_daily.length > 0 && (
          <p className="mt-1 text-[10px] text-emerald-600">
            comments + shares = 0 (cần gọi riêng — chưa implement)
          </p>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="font-mono text-[11px] text-emerald-800">
        <span className="font-semibold">{title}</span>{' '}
        <span className="opacity-60">({count} row preview)</span>
      </div>
      {children}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="text-[11px] italic text-emerald-600 bg-white border border-emerald-100 rounded px-2 py-1.5">
      {msg}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: Array<Array<string>> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10.5px] font-mono border-collapse">
        <thead>
          <tr className="bg-emerald-100 text-emerald-900">
            {headers.map((h) => (
              <th key={h} className="text-left px-2 py-1 border border-emerald-200">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="even:bg-white odd:bg-emerald-50">
              {r.map((cell, j) => (
                <td
                  key={j}
                  className="px-2 py-1 border border-emerald-100 align-top text-emerald-900"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
