'use client';

// KPI editor — inline edit "bài đăng / ngày" cho 1 channel.
// State: display (default) | editing. Lưu qua PATCH /api/channels/[id].
// Hiển thị derived target theo 30 ngày để user dễ hình dung.

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  accountId: string;
  initialKpiPerDay: number;
}

export function KpiEditor({ accountId, initialKpiPerDay }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(initialKpiPerDay));
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState(initialKpiPerDay);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0 || num > 100) {
      toast.error('KPI phải là số nguyên từ 0 đến 100');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/channels/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kpi_posts_per_day: num }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error ?? 'Không lưu được KPI');
        return;
      }
      toast.success('Đã cập nhật KPI');
      setCurrent(num);
      setEditing(false);
      // Refresh server data để các component khác (table dashboard) update
      router.refresh();
    } catch {
      toast.error('Lỗi kết nối. Thử lại sau.');
    } finally {
      setSaving(false);
    }
  }

  function onCancel() {
    setValue(String(current));
    setEditing(false);
  }

  // Hiển thị tham chiếu 30 ngày để user thấy KPI/ngày "có ý nghĩa gì"
  const monthlyEquivalent = current * 30;

  if (!editing) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-2">
        <div className="flex flex-col">
          <span className="text-xs text-zinc-500">KPI bài đăng / ngày</span>
          <span className="text-base font-semibold text-zinc-900 tabular-nums">
            {current}
            <span className="ml-1.5 text-xs font-normal text-zinc-500">
              (~{monthlyEquivalent} bài/tháng)
            </span>
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditing(true)}
          className="ml-auto"
        >
          ✎ Sửa
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSave}
      className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2"
    >
      <span className="text-xs text-zinc-600">KPI / ngày:</span>
      <Input
        type="number"
        min="0"
        max="100"
        step="1"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={saving}
        autoFocus
        className="w-20 h-8"
      />
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? 'Đang lưu…' : 'Lưu'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onCancel}
        disabled={saving}
      >
        Hủy
      </Button>
    </form>
  );
}
