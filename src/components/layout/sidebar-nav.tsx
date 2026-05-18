'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Radio,
  BookOpen,
  Wallet,
  Users,
  Inbox,
  Activity,
  Package,
  Newspaper,
} from 'lucide-react';
import type { SessionData } from '@/lib/auth/session-config';
import { UserMenu } from './user-menu';

const BASE_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/briefs', label: 'Xưởng nội dung', icon: Inbox },
  { href: '/channels', label: 'Kênh', icon: Radio },
  { href: '/library', label: 'Thư viện', icon: BookOpen },
  { href: '/skills', label: 'Thư viện Skill', icon: Package },
  { href: '/revenue', label: 'Doanh thu', icon: Wallet },
  { href: '/news', label: 'Tin tức AI', icon: Newspaper },
];

const ADMIN_ITEMS = [
  { href: '/team', label: 'Quản lý team', icon: Users },
  { href: '/cron-logs', label: 'Lịch sử cron', icon: Activity },
];

interface SidebarProps {
  user: SessionData;
  isAdmin?: boolean;
}

export function SidebarNav({ user, isAdmin = false }: SidebarProps) {
  const pathname = usePathname();
  // Gộp menu admin nếu user là admin — non-admin sẽ không thấy link "Quản lý team"
  const NAV_ITEMS = isAdmin ? [...BASE_ITEMS, ...ADMIN_ITEMS] : BASE_ITEMS;

  return (
    <aside className="flex flex-col w-56 shrink-0 min-h-screen bg-zinc-900 text-zinc-100 py-6">
      <div className="px-4 mb-8">
        <span className="text-lg font-bold tracking-tight text-white">
          Marketing OS
        </span>
      </div>

      <nav className="flex flex-col gap-1 px-2 flex-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 pt-3 mt-3 border-t border-zinc-800 space-y-2">
        <UserMenu user={user} />
        <p className="px-2 text-xs text-zinc-500">v1.0 · MVP</p>
      </div>
    </aside>
  );
}
