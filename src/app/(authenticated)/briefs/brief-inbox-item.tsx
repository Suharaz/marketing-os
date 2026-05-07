'use client';

// 1 brief item trong cột inbox bên trái — phiên bản tối giản:
// chỉ còn title (2 dòng max) + date/deadline footer.

import type { Brief } from '@/lib/briefs/brief-types';

function formatDeadline(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  if (isToday) return `Deadline ${time}`;
  const dateStr = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  }).format(d);
  return `${dateStr} · ${time}`;
}

interface BriefInboxItemProps {
  brief: Brief;
  isSelected: boolean;
  onSelect: () => void;
}

export function BriefInboxItem({ brief, isSelected, onSelect }: BriefInboxItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full text-left px-3 py-3 border-l-2 transition-colors ${
        isSelected
          ? 'border-amber-500 bg-amber-50/60'
          : 'border-transparent hover:bg-zinc-50'
      }`}
    >
      {/* Title — 2 dòng max */}
      <p className="text-sm font-medium text-zinc-900 line-clamp-2 leading-snug mb-1.5">
        {brief.title}
      </p>

      {/* Footer — date/deadline */}
      <p className="text-xs text-zinc-500 font-mono">
        {formatDeadline(brief.deadline)}
      </p>
    </button>
  );
}
