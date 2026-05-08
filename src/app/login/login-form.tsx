'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, Lock } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        router.push('/dashboard');
        router.refresh();
        return;
      }

      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const minutes = retryAfter ? Math.ceil(Number(retryAfter) / 60) : 15;
        setError(`Quá nhiều lần thử. Vui lòng thử lại sau ${minutes} phút.`);
        return;
      }

      const data = (await res.json()) as { error?: string };
      setError(data.error ?? 'Đăng nhập thất bại. Vui lòng thử lại.');
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative z-10 w-full max-w-[380px]">
      {/* Brand mark — small, restrained. Linear-style: text logo, no card. */}
      <div className="mb-10 flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
          <span className="text-sm font-bold">M</span>
        </div>
        <span className="text-sm font-semibold tracking-tight text-zinc-900">
          Marketing OS
        </span>
      </div>

      {/* Title block — generous spacing, weighty type */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Đăng nhập
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          Tiếp tục vào workspace của bạn.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-xs font-medium text-zinc-700"
          >
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="bạn@công-ty.com"
              disabled={loading}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-xs font-medium text-zinc-700"
          >
            Mật khẩu
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Error — inline, no scary red bg, just red text + subtle border */}
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-xs text-red-700"
          >
            {error}
          </div>
        )}

        {/* Submit — black on white, Linear vibe. Subtle hover, focus ring. */}
        <button
          type="submit"
          disabled={loading}
          className="group mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/30 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>

      {/* Microcopy — soft, not pushy */}
      <p className="mt-8 text-[11px] leading-relaxed text-zinc-400">
        Chỉ admin được cấp tài khoản tạo thêm thành viên.
        <br />
        Quên mật khẩu? Liên hệ quản trị viên để reset.
      </p>
    </div>
  );
}
