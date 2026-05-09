'use client';

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { KeyRound, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
  id: string;
  /** Display name — admin xác nhận đúng member trước khi reset */
  name: string;
}

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordDialog({ id, name }: Props) {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset state khi dialog đóng — tránh leak MK cũ ở lần mở sau
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setNewPassword('');
      setError(null);
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Mật khẩu mới tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/team-members/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });

      if (res.ok) {
        // Toast KHÔNG echo MK (security smell). Admin phải tự copy MK trước
        // khi submit, hoặc paste vào chat với user.
        toast.success(`Đã reset mật khẩu cho ${name}. Hãy báo họ mật khẩu mới.`);
        handleOpenChange(false);
        return;
      }

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Không thể reset mật khẩu');
    } catch {
      setError('Lỗi kết nối — thử lại sau');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            title={`Reset mật khẩu cho ${name}`}
            className="inline-flex items-center text-zinc-400 hover:text-blue-600"
          >
            <KeyRound className="size-3.5" />
          </button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset mật khẩu cho {name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="reset-new-password"
              className="text-xs font-medium text-zinc-700"
            >
              Mật khẩu mới
            </label>
            <input
              id="reset-new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 transition-colors focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 disabled:opacity-50"
            />
            <p className="text-[11px] text-zinc-500">
              Copy mật khẩu này gửi cho {name} qua kênh an toàn (chat nội bộ,
              không gửi qua email).
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-xs text-red-700"
            >
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={loading}>
                  Huỷ
                </Button>
              }
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? 'Đang reset…' : 'Reset mật khẩu'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
