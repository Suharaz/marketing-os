'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { AlertData } from '@/lib/queries/alerts';

interface AlertsFeedProps {
  initialData: AlertData[];
}

const SEVERITY_STYLES: Record<AlertData['severity'], { bg: string; icon: string; border: string }> = {
  critical: { bg: 'bg-red-50', icon: '⚠', border: 'border-l-red-500' },
  warning:  { bg: 'bg-amber-50', icon: '⚡', border: 'border-l-amber-400' },
  info:     { bg: 'bg-blue-50', icon: 'ℹ', border: 'border-l-blue-400' },
};

export function AlertsFeed({ initialData }: AlertsFeedProps) {
  const [alerts, setAlerts] = useState<AlertData[]>(initialData);
  const [marking, setMarking] = useState<Set<string>>(new Set());

  async function handleMarkRead(id: string) {
    // Optimistic: remove immediately
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    setMarking((prev) => new Set(prev).add(id));

    try {
      const res = await fetch(`/api/alerts/${id}/mark-read`, { method: 'POST' });
      if (!res.ok) {
        // Restore on failure
        setAlerts((prev) => {
          const restored = initialData.find((a) => a.id === id);
          if (!restored) return prev;
          return [restored, ...prev].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
      }
    } catch {
      // Restore on network error
      setAlerts((prev) => {
        const restored = initialData.find((a) => a.id === id);
        if (!restored) return prev;
        return [restored, ...prev].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    } finally {
      setMarking((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div className="rounded-xl bg-white ring-1 ring-zinc-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-700">Cảnh báo</h3>
        {alerts.length > 0 && (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
            {alerts.length} mới
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <p className="text-sm text-zinc-400 py-8 text-center">
          Không có cảnh báo chưa đọc
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {alerts.map((alert) => {
            const style = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.info;
            const isProcessing = marking.has(alert.id);

            return (
              <li
                key={alert.id}
                className={`flex items-start gap-3 rounded-lg border-l-4 px-3 py-2.5 ${style.bg} ${style.border} transition-opacity ${isProcessing ? 'opacity-40' : ''}`}
              >
                <span className="text-base shrink-0 mt-0.5">{style.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-800 leading-snug">
                    {alert.title}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
                    {alert.message}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-1">
                    {formatDistanceToNow(new Date(alert.createdAt), {
                      addSuffix: true,
                      locale: vi,
                    })}
                  </p>
                </div>
                <button
                  onClick={() => handleMarkRead(alert.id)}
                  disabled={isProcessing}
                  className="shrink-0 rounded-md px-2 py-1 text-[10px] font-medium text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors disabled:pointer-events-none"
                  aria-label="Đánh dấu đã đọc"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
