'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { FbOAuthPage } from '@/lib/auth/session-config';

interface Props {
  pages: FbOAuthPage[];
}

export function PagePicker({ pages }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    pages[0]?.id ?? null
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleConnect() {
    if (!selectedId) return;

    const page = pages.find((p) => p.id === selectedId);
    if (!page) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Token is read from session server-side — we only send pageId + name.
        // The server-side POST handler reads pageToken from the request body;
        // we pass the page access_token here (it is short-lived page token,
        // distinct from the long-lived user token which stays server-only).
        body: JSON.stringify({
          pageId: page.id,
          pageToken: page.access_token,
          name: page.name,
        }),
      });

      if (res.status === 409) {
        toast.error('Trang này đã được kết nối. Thử trang khác.');
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error ?? 'Kết nối thất bại.');
        return;
      }

      const data = await res.json() as { accountId: string };
      toast.success(`Đã kết nối "${page.name}"`);
      router.push(`/channels/${data.accountId}`);
    } catch {
      toast.error('Lỗi kết nối. Thử lại sau.');
    } finally {
      setSubmitting(false);
    }
  }

  if (pages.length === 0) {
    return (
      <div className="text-center py-10 text-zinc-500 text-sm">
        Tài khoản này không có trang Facebook nào để kết nối.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-600">
        Chọn trang Facebook bạn muốn kết nối:
      </p>

      <ul className="flex flex-col gap-2">
        {pages.map((page) => (
          <li key={page.id}>
            <label
              className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
                selectedId === page.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-zinc-200 bg-white hover:border-zinc-300'
              }`}
            >
              <input
                type="radio"
                name="page"
                value={page.id}
                checked={selectedId === page.id}
                onChange={() => setSelectedId(page.id)}
                className="accent-blue-600"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-zinc-900">{page.name}</p>
                {page.category && (
                  <p className="text-xs text-zinc-500">{page.category}</p>
                )}
              </div>
            </label>
          </li>
        ))}
      </ul>

      <Button
        onClick={handleConnect}
        disabled={!selectedId || submitting}
        className="w-full sm:w-auto"
      >
        {submitting ? 'Đang kết nối…' : 'Kết nối'}
      </Button>
    </div>
  );
}
