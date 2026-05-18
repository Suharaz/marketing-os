'use client';

// Nút "Fetch tin ngay" — gọi POST /api/news/ingest rồi refresh trang
// để hiển thị tin mới ingest. Có cooldown 30s tránh user spam endpoint.
//
// Tại sao 30s mà không debounce server-side?
//   - Endpoint chỉ admin gọi (auth-gated), volume thấp → không cần debounce DB
//   - 30s đủ thời gian để job ingestion chạy xong (4 nguồn × ~3s = 12s)
//   - Trải nghiệm: user click 2 lần liên tiếp sẽ thấy "Đợi 30s..." → rõ ràng

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

const COOLDOWN_MS = 30_000;

export function NewsFetchNowButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  // useTransition: trigger router.refresh() mà không freeze UI
  const [, startTransition] = useTransition();

  const isCoolingDown = cooldownUntil !== null && Date.now() < cooldownUntil;
  const disabled = loading || isCoolingDown;

  async function handleClick() {
    if (disabled) return;
    setLoading(true);
    try {
      const res = await fetch('/api/news/ingest', { method: 'POST' });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? 'Fetch thất bại.');
        return;
      }

      toast.success('Đã fetch tin mới — đang refresh.');
      setCooldownUntil(Date.now() + COOLDOWN_MS);
      // router.refresh() re-runs server component → page render lại với data mới
      startTransition(() => router.refresh());
    } catch {
      toast.error('Lỗi kết nối. Thử lại sau.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={disabled}
      variant="default"
      size="sm"
      className="gap-2"
    >
      <RefreshCw className={'size-3.5 ' + (loading ? 'animate-spin' : '')} />
      {loading ? 'Đang fetch…' : isCoolingDown ? 'Đợi 30s…' : 'Fetch ngay'}
    </Button>
  );
}
