'use client';

// Client component — chip-style horizontal tabs for filtering by platform.
// Uses URL searchParams as the single source of truth (so back/forward + deep
// linking work). Selecting a tab sets ?platform=<value> and resets the cursor.

import { useRouter, useSearchParams } from 'next/navigation';

const TABS = [
  { value: '',          label: 'Tất cả' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'facebook',  label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube',   label: 'YouTube' },
  { value: 'threads',   label: 'Threads' },
  { value: 'zalo',      label: 'Zalo' },
] as const;

export function LibraryPlatformTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active = the first platform in the comma list, or '' when no filter set.
  // We treat the tabs as a single-select shortcut on top of the multi-select
  // filter param so the chip + sidebar checkboxes stay coherent.
  const activeRaw = searchParams.get('platform') ?? '';
  const active = activeRaw.split(',')[0]?.trim() ?? '';

  function handleSelect(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === '') {
      params.delete('platform');
    } else {
      params.set('platform', value);
    }
    params.delete('cursor');
    router.push('/library?' + params.toString());
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1 -mb-1">
      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider shrink-0">
        Nền tảng
      </span>
      {TABS.map((tab) => {
        const isActive = active === tab.value;
        return (
          <button
            key={tab.value || 'all'}
            type="button"
            onClick={() => handleSelect(tab.value)}
            className={
              'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ' +
              (isActive
                ? 'bg-zinc-900 text-white'
                : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50')
            }
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
