'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin (toàn quyền)',
  member: 'Member (chỉ kênh được gán)',
};

export function CreateMemberForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName('');
    setEmail('');
    setPassword('');
    setRole('member');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    // Client-side validation cơ bản — server vẫn validate độc lập
    if (name.trim().length === 0) {
      toast.error('Tên không được để trống.');
      return;
    }
    if (password.length < 8) {
      toast.error('Mật khẩu tối thiểu 8 ký tự.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error ?? 'Tạo user thất bại.');
        return;
      }

      toast.success(`Đã tạo user ${name}.`);
      reset();
      router.refresh();
    } catch {
      toast.error('Lỗi kết nối. Thử lại sau.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm flex flex-col gap-4"
    >
      <h2 className="text-base font-semibold text-zinc-900">Tạo thành viên mới</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-600">Họ tên</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={submitting}
            className="h-9 rounded-md border border-zinc-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-600">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
            className="h-9 rounded-md border border-zinc-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-600">Mật khẩu (≥ 8 ký tự)</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={submitting}
            className="h-9 rounded-md border border-zinc-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-600">Vai trò</span>
          <Select
            value={role}
            onValueChange={(v) => v && setRole(v as 'admin' | 'member')}
            disabled={submitting}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue>
                {(v: unknown) =>
                  typeof v === 'string' ? ROLE_LABELS[v] ?? v : 'Chọn vai trò'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">{ROLE_LABELS.member}</SelectItem>
              <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Đang tạo…' : 'Tạo thành viên'}
        </Button>
      </div>
    </form>
  );
}
