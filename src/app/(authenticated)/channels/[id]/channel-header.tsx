'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { OwnerSelector } from './owner-selector';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
  active: { label: 'Hoạt động', variant: 'default' },
  token_expired: { label: 'Token hết hạn', variant: 'destructive' },
  disconnected: { label: 'Ngắt kết nối', variant: 'secondary' },
};

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
};

interface MemberOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Props {
  accountId: string;
  name: string;
  platform: string;
  status: string;
  lastSyncedAt: string | null;
  ownerId: string | null;
  ownerName: string | null;
  members: MemberOption[];
  // Quyền admin → mới được đổi owner & hủy kết nối kênh.
  // Non-admin chỉ thấy text owner read-only, không thấy nút Hủy kết nối.
  isAdmin: boolean;
}

export function ChannelHeader({
  accountId,
  name,
  platform,
  status,
  lastSyncedAt,
  ownerId,
  ownerName,
  members,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);

  const statusCfg = STATUS_CONFIG[status] ?? { label: status, variant: 'outline' as const };
  const syncedAgo = lastSyncedAt
    ? formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true, locale: vi })
    : 'Chưa sync';

  const isCoolingDown = cooldownUntil !== null && Date.now() < cooldownUntil;

  async function handleSync() {
    if (isCoolingDown || syncing) return;

    setSyncing(true);
    try {
      const res = await fetch('/api/sync/fetch-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      if (res.status === 429) {
        toast.warning('Đợi 60s trước khi đồng bộ lại.');
        setCooldownUntil(Date.now() + 60_000);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error ?? 'Đồng bộ thất bại.');
        return;
      }

      // Backend trả 202 (fire-and-forget): sync chạy background, có thể mất vài phút.
      // Kết quả thực tế sẽ phản ánh ở "Lần sync cuối" sau khi user refresh trang.
      const data = await res.json() as { message?: string; status?: string };
      toast.info(data.message ?? 'Đang đồng bộ ở phía sau — vài phút nữa kết quả sẽ cập nhật.');
      setCooldownUntil(Date.now() + 60_000);
    } catch {
      toast.error('Lỗi kết nối. Thử lại sau.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm(`Ngắt kết nối kênh "${name}"? Dữ liệu bài viết sẽ được giữ lại.`)) return;

    try {
      const res = await fetch(`/api/channels/${accountId}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Không thể ngắt kết nối. Thử lại sau.');
        return;
      }
      toast.success('Đã ngắt kết nối kênh.');
      router.push('/channels');
    } catch {
      toast.error('Lỗi kết nối. Thử lại sau.');
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-zinc-900">{name}</h1>
          <Badge variant="outline">{PLATFORM_LABELS[platform] ?? platform}</Badge>
          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
        </div>
        <p className="text-sm text-zinc-500">Lần sync cuối: {syncedAgo}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm text-zinc-500">Người phụ trách:</span>
          {isAdmin ? (
            <OwnerSelector
              accountId={accountId}
              currentOwnerId={ownerId}
              members={members}
            />
          ) : (
            // Non-admin: read-only — không có dropdown, chỉ hiện tên hoặc "Chưa gán"
            <span className="text-sm font-medium text-zinc-700">
              {ownerName ?? <span className="italic text-zinc-400">Chưa gán</span>}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={handleSync}
          disabled={syncing || isCoolingDown}
          variant="default"
          size="sm"
        >
          {syncing ? 'Đang đồng bộ…' : 'Đồng bộ ngay'}
        </Button>
        {isAdmin && (
          <Button
            onClick={handleDisconnect}
            variant="destructive"
            size="sm"
          >
            Hủy kết nối
          </Button>
        )}
      </div>
    </div>
  );
}
