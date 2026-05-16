'use client';

// Copy-to-clipboard button cho Page ID.
//
// LƯU Ý: card list được wrap trong <Link>. Click vào nút phải:
//   - preventDefault (chặn navigation của Link)
//   - stopPropagation (chặn Link bắt click bubble)
// Nếu thiếu 1 trong 2 → user click copy nhưng app navigate sang detail.

import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  className?: string;
}

export function CopyIdButton({ value, className }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Đã copy Page ID');
      // Reset icon sau 1.5s — vừa đủ để user thấy feedback
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Copy thất bại — clipboard không khả dụng');
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'ml-1 inline-flex items-center justify-center rounded p-0.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors',
        className
      )}
      aria-label={copied ? 'Đã copy' : 'Copy Page ID'}
      title={copied ? 'Đã copy' : 'Copy Page ID'}
    >
      {copied ? (
        <CheckIcon />
      ) : (
        <ClipboardIcon />
      )}
    </button>
  );
}

// Inline SVG để tránh thêm dependency hoặc import từ lucide-react (đỡ bloat bundle).
function ClipboardIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-emerald-600"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
