'use client';

// Cột inbox bên trái — header "Brief Inbox" + count "N mới" + danh sách item.
// Wrapper card với divider giữa các item.

import { BriefInboxItem } from './brief-inbox-item';
import type { Brief } from '@/lib/briefs/brief-types';

interface BriefInboxListProps {
  briefs: Brief[];
  selectedBriefId: string | null;
  onSelect: (briefId: string) => void;
  /** Label hiển thị bên phải header — VD "5 mới" */
  countLabel: string;
}

export function BriefInboxList({
  briefs,
  selectedBriefId,
  onSelect,
  countLabel,
}: BriefInboxListProps) {
  return (
    <div className="flex flex-col rounded-xl bg-white ring-1 ring-zinc-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <h3 className="text-sm font-semibold text-zinc-900">Brief Inbox</h3>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
          {countLabel}
        </span>
      </div>

      {/* List — divider giữa các item, không cần border riêng cho từng item */}
      {briefs.length === 0 ? (
        <p className="text-xs text-zinc-400 text-center py-8 italic">
          Chưa có brief nào.
        </p>
      ) : (
        <div className="divide-y divide-zinc-100">
          {briefs.map((b) => (
            <BriefInboxItem
              key={b.id}
              brief={b}
              isSelected={selectedBriefId === b.id}
              onSelect={() => onSelect(b.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
