'use client';

// Channel detail header — sau revamp:
//   - Bỏ 2 badge Facebook + Hoạt động (đồng nhất với list card)
//   - PlatformIcon vuông + StatusDot ripple/halo cạnh tên
//   - Page ID + CopyIdButton + Sync time inline trên 1 dòng (ngăn cách bằng ·)
//   - Reuse component từ _components/ (DRY với card)

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { OwnerSelector } from './owner-selector';
import { KpiEditor } from './kpi-editor';
import { StatusDot } from '../_components/status-dot';
import { CopyIdButton } from '../_components/copy-id-button';
import { PlatformIcon } from '../_components/platform-icon';

interface MemberOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Props {
  accountId: string;
  externalId: string;
  name: string;
  platform: string;
  status: string;
  lastSyncedAt: string | null;
  ownerId: string | null;
  ownerName: string | null;
  members: MemberOption[];
  // KPI số bài đăng / ngày — chỉnh được qua KpiEditor
  kpiPostsPerDay: number;
  // Quyền admin → mới được đổi owner & hủy kết nối kênh.
  // Non-admin chỉ thấy text owner read-only, không thấy nút Hủy kết nối.
  isAdmin: boolean;
}

export function ChannelHeader({
  accountId,
  externalId,
  name,
  platform,
  status,
  lastSyncedAt,
  ownerId,
  ownerName,
  members,
  kpiPostsPerDay,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);

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
      const data = (await res.json()) as { message?: string; status?: string };
      toast.info(
        data.message ?? 'Đang đồng bộ ở phía sau — vài phút nữa kết quả sẽ cập nhật.'
      );
      setCooldownUntil(Date.now() + 60_000);
    } catch {
      toast.error('Lỗi kết nối. Thử lại sau.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm(`Ngắt kết nối kênh "${name}"? Dữ liệu bài viết sẽ được giữ lại.`))
      return;

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
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4 min-w-0">
        <PlatformIcon platform={platform} size="lg" />

        <div className="flex flex-col gap-1 min-w-0">
          {/* Row 1: dot status + tên page (h1) */}
          <div className="flex items-center gap-2">
            <StatusDot status={status} />
            <h1 className="text-2xl font-bold text-zinc-900 truncate">{name}</h1>
          </div>

          {/* Row 2: Page ID + copy + sync inline (· separator) */}
          <p className="text-xs text-zinc-500 font-mono flex items-center flex-wrap gap-x-1">
            <span>ID: {externalId}</span>
            <CopyIdButton value={externalId} />
            <span className="text-zinc-300 mx-1">·</span>
            <span className="font-sans">Sync: {syncedAgo}</span>
          </p>

          {/* Row 3: Người phụ trách */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-zinc-500">Người phụ trách:</span>
            {isAdmin ? (
              <OwnerSelector
                accountId={accountId}
                currentOwnerId={ownerId}
                members={members}
              />
            ) : (
              <span className="text-sm font-medium text-zinc-700">
                {ownerName ?? <span className="italic text-zinc-400">Chưa gán</span>}
              </span>
            )}
          </div>

          {/* Row 4: KPI editor — số bài đăng mục tiêu / ngày */}
          <div className="mt-3">
            <KpiEditor accountId={accountId} initialKpiPerDay={kpiPostsPerDay} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          onClick={handleSync}
          disabled={syncing || isCoolingDown}
          variant="default"
          size="sm"
        >
          {syncing ? 'Đang đồng bộ…' : 'Đồng bộ ngay'}
        </Button>
        {isAdmin && (
          <Button onClick={handleDisconnect} variant="destructive" size="sm">
            Hủy kết nối
          </Button>
        )}
      </div>
    </div>
  );
}
