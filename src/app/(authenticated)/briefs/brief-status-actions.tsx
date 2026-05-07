'use client';

// Action bar dưới brief detail — đổi status theo flow.
// Mỗi status hiện tại có set action khác nhau:
//   mine        → "Bắt đầu viết" (→ draft)
//   draft       → "Submit để review" (→ submitted) | "Quay lại Inbox" (→ mine)
//   submitted   → "Approve & Publish" (→ published) | "Yêu cầu sửa" (→ revision)
//   revision    → "Submit lại" (→ submitted)
//   published   → "Mark cần sửa" (→ revision)

import { ArrowLeft, ArrowRight, Check, RotateCcw, Send, X } from 'lucide-react';
import type { ComponentType } from 'react';
import { Button } from '@/components/ui/button';
import type { BriefStatusT } from '@/lib/briefs/brief-types';

interface StatusAction {
  label: string;
  /** Status sẽ chuyển tới khi click */
  to: BriefStatusT;
  icon: ComponentType<{ className?: string }>;
  /** Tailwind classes cho variant — primary action dùng amber, secondary outline */
  variant: 'primary' | 'secondary';
}

const ACTIONS_BY_STATUS: Record<BriefStatusT, StatusAction[]> = {
  mine: [
    { label: 'Bắt đầu viết',     to: 'draft',     icon: ArrowRight, variant: 'primary' },
  ],
  draft: [
    { label: 'Submit để review', to: 'submitted', icon: Send,       variant: 'primary' },
    { label: 'Quay lại Inbox',   to: 'mine',      icon: ArrowLeft,  variant: 'secondary' },
  ],
  submitted: [
    { label: 'Approve & Publish', to: 'published', icon: Check,     variant: 'primary' },
    { label: 'Yêu cầu sửa',       to: 'revision',  icon: X,         variant: 'secondary' },
  ],
  revision: [
    { label: 'Submit lại',       to: 'submitted', icon: RotateCcw,  variant: 'primary' },
  ],
  published: [
    { label: 'Mark cần sửa',     to: 'revision',  icon: X,          variant: 'secondary' },
  ],
};

interface BriefStatusActionsProps {
  currentStatus: BriefStatusT;
  onChangeStatus: (next: BriefStatusT) => void;
}

export function BriefStatusActions({
  currentStatus,
  onChangeStatus,
}: BriefStatusActionsProps) {
  const actions = ACTIONS_BY_STATUS[currentStatus];
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-zinc-100">
      <span className="text-xs text-zinc-500 mr-1">Hành động:</span>
      {actions.map((action) => {
        const Icon = action.icon;
        const isPrimary = action.variant === 'primary';
        return (
          <Button
            key={action.to}
            type="button"
            onClick={() => onChangeStatus(action.to)}
            className={
              isPrimary
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : ''
            }
            variant={isPrimary ? 'default' : 'outline'}
            size="sm"
          >
            <Icon className="size-3.5" />
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}
