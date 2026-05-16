import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Sparkles,
  Activity,
  Wallet,
  BarChart3,
  Zap,
  Lock,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/get-session';

export const metadata = {
  title: 'Marketing OS — Một dashboard. Toàn bộ KPI.',
  description:
    'Theo dõi reach, lead, doanh thu cho mọi Facebook page — tự động đồng bộ, nhập tay khi cần.',
};

export default async function LandingPage() {
  // Logged-in users skip the marketing page and go straight to work.
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* ───── Nav ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-zinc-900 text-white">
              <span className="text-xs font-bold">M</span>
            </div>
            <span className="text-sm font-semibold tracking-tight">
              Marketing OS
            </span>
          </div>
          <Link
            href="/login"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800"
          >
            Đăng nhập
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </header>

      {/* ───── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative mx-auto max-w-6xl px-6 py-24 sm:py-32">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
            <Sparkles className="size-3" />
            Cron tự động · Ladipage · FB Insights
          </div>

          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl">
            Một dashboard.
            <br />
            <span className="text-zinc-400">Toàn bộ KPI.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-500">
            Theo dõi reach, lead, doanh thu cho mọi Facebook page — tự động
            đồng bộ mỗi 8 giờ, fetch lead từ Ladipage hằng ngày 23:30.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800"
            >
              Bắt đầu ngay
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-900 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
            >
              Xem tính năng
            </a>
          </div>
        </div>
      </section>

      {/* ───── Features grid ─────────────────────────────────────────────── */}
      <section id="features" className="border-t border-zinc-100 bg-zinc-50/40 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Built-in
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
              Tính năng cốt lõi.
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Không cần plugin, không cần config phức tạp — bật server là chạy.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Activity className="size-5" />}
              title="Auto-sync FB Insights"
              desc="Page insights 1×/ngày (09:00 VN), posts metrics 3×/ngày (09:30, 17:30, 01:30 VN) — reach, follower growth, engagement."
            />
            <FeatureCard
              icon={<Sparkles className="size-5" />}
              title="Lead tracking Ladipage"
              desc="Cron 23:30 (giờ VN) fetch số lead từ webhook n8n cho mọi page active. Idempotent UPSERT theo (page, ngày)."
            />
            <FeatureCard
              icon={<Wallet className="size-5" />}
              title="Doanh thu thủ công"
              desc="Form nhập 1-click theo kênh. Dashboard tự cộng vào KPI — không phải Excel, không phải Google Sheets."
            />
            <FeatureCard
              icon={<BarChart3 className="size-5" />}
              title="Health score per channel"
              desc="Score 0-100 cập nhật mỗi đêm dựa trên consistency, growth, reach. Alert khi page tụt dốc."
            />
            <FeatureCard
              icon={<Zap className="size-5" />}
              title="Manual sync 1 click"
              desc="Cần data ngay? Bấm 'Đồng bộ' trên trang channel. Pull FB + Ladipage cho account đó instant."
            />
            <FeatureCard
              icon={<Lock className="size-5" />}
              title="Self-hosted, ngầm"
              desc="Docker + Postgres + Next.js standalone. Không SaaS, không vendor lock-in. Data của bạn ở server của bạn."
            />
          </div>
        </div>
      </section>

      {/* ───── How it works ─────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Workflow
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
              3 bước. Không hơn.
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <StepCard
              num="01"
              title="Kết nối FB page"
              desc="OAuth Facebook → chọn page → token mã hoá lưu vào DB. 1 lần setup, dùng mãi."
            />
            <StepCard
              num="02"
              title="Cron tự đồng bộ"
              desc="Page insights, posts, conversions, health score — tất cả tự cập nhật theo lịch cố định."
            />
            <StepCard
              num="03"
              title="Dashboard hiện số"
              desc="Reach, Lead, Doanh thu, Followers — 5 KPI cards với compare period và sparkline."
            />
          </div>
        </div>
      </section>

      {/* ───── Final CTA ─────────────────────────────────────────────────── */}
      <section className="border-t border-zinc-100 bg-zinc-900 py-20 text-white">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Sẵn sàng xem KPI của bạn?
          </h2>
          <p className="mt-3 text-zinc-400">
            Đăng nhập với tài khoản admin được cấp. Không có form đăng ký
            công khai — chỉ admin mới tạo được thành viên mới.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-white px-6 text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:bg-zinc-100"
          >
            Đăng nhập
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* ───── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-100 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 text-xs text-zinc-400">
          <span>© 2026 Marketing OS · TAKI</span>
          <span>v1.0 · MVP</span>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="group rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-sm">
      <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-zinc-900 text-white transition-colors group-hover:bg-zinc-700">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{desc}</p>
    </div>
  );
}

function StepCard({
  num,
  title,
  desc,
}: {
  num: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="relative">
      <div className="font-mono text-xs font-semibold tracking-wider text-zinc-300">
        {num}
      </div>
      <h3 className="mt-3 text-lg font-semibold text-zinc-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{desc}</p>
    </div>
  );
}
