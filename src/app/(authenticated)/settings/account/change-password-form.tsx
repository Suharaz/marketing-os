'use client';

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Loader2, Lock } from 'lucide-react';

// Min length đồng bộ với passwordSchema (NIST 800-63B). Hardcode ở đây
// vì client không thể import zod schema (server-side validation gốc).
const MIN_PASSWORD_LENGTH = 8;

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    // Client-side validation — không thay thế server validate
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Mật khẩu mới tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Xác nhận mật khẩu mới không khớp');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Mật khẩu mới phải khác mật khẩu cũ');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (res.ok) {
        toast.success('Đã đổi mật khẩu thành công');
        reset();
        return;
      }

      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const minutes = retryAfter ? Math.ceil(Number(retryAfter) / 60) : 15;
        setError(`Quá nhiều lần thử. Vui lòng đợi ${minutes} phút.`);
        return;
      }

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Không thể đổi mật khẩu. Vui lòng thử lại.');
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PasswordField
        id="current-password"
        label="Mật khẩu hiện tại"
        value={currentPassword}
        onChange={setCurrentPassword}
        autoComplete="current-password"
        disabled={loading}
      />
      <PasswordField
        id="new-password"
        label="Mật khẩu mới"
        value={newPassword}
        onChange={setNewPassword}
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        disabled={loading}
      />
      <PasswordField
        id="confirm-password"
        label="Xác nhận mật khẩu mới"
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        disabled={loading}
      />

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-xs text-red-700"
        >
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          {loading ? 'Đang đổi…' : 'Đổi mật khẩu'}
        </button>
      </div>
    </form>
  );
}

// Sub-component — DRY 3 input giống nhau
interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
  minLength?: number;
  disabled?: boolean;
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  minLength,
  disabled,
}: PasswordFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-zinc-700">
        {label}
      </label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
        <input
          id={id}
          type="password"
          autoComplete={autoComplete}
          required
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 disabled:opacity-50"
        />
      </div>
    </div>
  );
}
