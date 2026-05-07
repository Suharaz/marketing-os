'use client';

// Timeline activity của 1 brief — render dưới detail view.
// Tự fetch từ /api/briefs/[id]/activity khi briefId đổi.

import { useEffect, useState } from 'react';
import type { BriefActivity } from '@/lib/queries/briefs-activity';
import { STATUS_CONFIG } from '@/lib/briefs/brief-types';

interface BriefActivityTimelineProps {
  briefId: string;
  /** Refetch khi giá trị này đổi — caller bump sau create/edit/status change */
  refetchKey: number;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

function describe(activity: BriefActivity): string {
  const who = activity.actor_name ?? 'Người dùng cũ';
  switch (activity.action) {
    case 'created':
      return `${who} tạo brief`;
    case 'status_changed': {
      const from = activity.from_status ? STATUS_CONFIG[activity.from_status].label : '';
      const to = activity.to_status ? STATUS_CONFIG[activity.to_status].label : '';
      return `${who} chuyển ${from} → ${to}`;
    }
    case 'content_edited':
      return activity.detail
        ? `${who} sửa: ${activity.detail}`
        : `${who} sửa nội dung`;
    default:
      return `${who} thực hiện ${activity.action}`;
  }
}

const ACTION_DOT_COLOR: Record<BriefActivity['action'], string> = {
  created: 'bg-emerald-500',
  status_changed: 'bg-amber-500',
  content_edited: 'bg-blue-500',
};

export function BriefActivityTimeline({ briefId, refetchKey }: BriefActivityTimelineProps) {
  const [activities, setActivities] = useState<BriefActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/briefs/${briefId}/activity`)
      .then((res) => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return res.json();
      })
      .then((data: { activity: BriefActivity[] }) => {
        if (cancelled) return;
        setActivities(data.activity);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Lỗi tải activity');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [briefId, refetchKey]);

  if (loading) {
    return <p className="text-xs text-zinc-400 italic">Đang tải lịch sử…</p>;
  }
  if (error) {
    return <p className="text-xs text-rose-600">⚠️ {error}</p>;
  }
  if (activities.length === 0) {
    return <p className="text-xs text-zinc-400 italic">Chưa có hoạt động nào.</p>;
  }

  return (
    <ol className="space-y-2.5">
      {activities.map((a) => (
        <li key={a.id} className="flex gap-3 text-sm">
          <span className={`mt-1.5 size-2 shrink-0 rounded-full ${ACTION_DOT_COLOR[a.action]}`} />
          <div className="flex-1 min-w-0">
            <p className="text-zinc-700">{describe(a)}</p>
            <p className="text-xs text-zinc-400 font-mono">{formatTime(a.created_at)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
