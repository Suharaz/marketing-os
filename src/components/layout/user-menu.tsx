'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { SessionData } from '@/lib/auth/session-config';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { ChevronUp, LogOut } from 'lucide-react';

interface Props {
  user: SessionData;
}

// User dropdown — đặt ở chân sidebar. Hover lên → mở menu đăng xuất.
// Tách từ topbar.tsx (đã xoá) để giữ logout flow khi bỏ global header.
export function UserMenu({ user }: Props) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  const initials = user.name
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : user.email.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 w-full rounded-lg px-2 py-2 text-sm hover:bg-zinc-800 transition-colors outline-none"
        disabled={loggingOut}
      >
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white shrink-0">
          {initials}
        </span>
        <span className="text-zinc-200 truncate flex-1 text-left">
          {user.name || user.email}
        </span>
        <ChevronUp className="size-3.5 text-zinc-500 shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top">
        {/* Base UI yêu cầu Label phải wrap trong Group — không được dùng standalone */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-zinc-900 text-sm">{user.name}</span>
              <span className="text-xs text-zinc-400 font-normal">{user.email}</span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleLogout}>
          <LogOut className="size-4" />
          {loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
