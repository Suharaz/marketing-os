// Status dot — chấm tròn biểu thị connection status của kênh.
//
// Active: dot xanh tĩnh + halo "ping" lan ra ngoài (pattern GitHub/Vercel/Slack
// cho "live indicator"). Dùng Tailwind animate-ping (built-in, zero CSS custom).
// KHÔNG dùng animate-pulse vì opacity fade quá yếu + conflict semantics với skeleton.
//
// token_expired / disconnected: dot tĩnh, không animate.

import { cn } from '@/lib/utils';

interface Props {
  status: string;
  className?: string;
}

const STATIC_COLOR: Record<string, string> = {
  token_expired: 'bg-red-500',
  disconnected: 'bg-zinc-400',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Đang hoạt động',
  token_expired: 'Token hết hạn',
  disconnected: 'Ngắt kết nối',
};

export function StatusDot({ status, className }: Props) {
  const label = STATUS_LABEL[status] ?? status;

  if (status === 'active') {
    return (
      <span
        className={cn('relative inline-flex size-2.5 shrink-0', className)}
        aria-label={label}
        title={label}
      >
        {/* Halo nhấp nháy phía sau — Tailwind motion-safe tự respect prefers-reduced-motion */}
        <span className="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
        {/* Dot tĩnh phía trước */}
        <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-block size-2.5 shrink-0 rounded-full ring-2 ring-white',
        STATIC_COLOR[status] ?? 'bg-zinc-400',
        className
      )}
      aria-label={label}
      title={label}
    />
  );
}
