'use client';

// Client component — tabs filter theo nguồn tin.
// URL searchParams là source of truth (deep-link + back/forward hoạt động).
// Pattern y hệt library-platform-tabs.tsx để giữ UX nhất quán.

import { useRouter, useSearchParams } from 'next/navigation';
import { NEWS_SOURCES } from '@/lib/news/sources';

const TAB_ALL = { id: '', name: 'Tất cả' } as const;

export function NewsSourceTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get('source') ?? '';

  function handleSelect(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === '') {
      params.delete('source');
    } else {
      params.set('source', value);
    }
    const qs = params.toString();
    router.push('/news' + (qs ? '?' + qs : ''));
  }

  const tabs = [TAB_ALL, ...NEWS_SOURCES.map((s) => ({ id: s.id, name: s.name }))];

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1 -mb-1">
      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider shrink-0">
        Nguồn
      </span>
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id || 'all'}
            type="button"
            onClick={() => handleSelect(tab.id)}
            className={
              'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ' +
              (isActive
                ? 'bg-zinc-900 text-white'
                : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50')
            }
          >
            {tab.name}
          </button>
        );
      })}
    </div>
  );
}
