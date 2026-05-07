'use client';

// Advanced filters launched from a button — kept as a dialog so the main
// content area is uncluttered. Tabs handle the common "platform" filter
// inline; this dialog covers everything else (account, post type, date
// range, campaign tag) and remains the source of truth for those keys.

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import type { AccountOption } from '@/lib/queries/library-posts';

const PLATFORMS = [
  { value: 'facebook',  label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'youtube',   label: 'YouTube' },
  { value: 'threads',   label: 'Threads' },
  { value: 'zalo',      label: 'Zalo' },
];

const POST_TYPES = [
  { value: 'photo',  label: 'Ảnh' },
  { value: 'video',  label: 'Video' },
  { value: 'reel',   label: 'Reel' },
  { value: 'status', label: 'Status' },
  { value: 'link',   label: 'Link' },
];

function parseMultiParam(searchParams: URLSearchParams, key: string): string[] {
  const raw = searchParams.get(key);
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

interface FilterSidebarProps {
  accounts: AccountOption[];
}

export function LibraryFilterSidebar({ accounts }: FilterSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  // Initialise state from current URL — re-sync whenever URL changes so the
  // dialog reopens with the current filter set.
  const [platforms, setPlatforms] = useState<string[]>(() => parseMultiParam(searchParams, 'platform'));
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(() => parseMultiParam(searchParams, 'account'));
  const [types, setTypes] = useState<string[]>(() => parseMultiParam(searchParams, 'type'));
  const [from, setFrom] = useState(searchParams.get('from') ?? '');
  const [to, setTo] = useState(searchParams.get('to') ?? '');
  const [tag, setTag] = useState(searchParams.get('tag') ?? '');

  useEffect(() => {
    if (!open) return;
    setPlatforms(parseMultiParam(searchParams, 'platform'));
    setSelectedAccounts(parseMultiParam(searchParams, 'account'));
    setTypes(parseMultiParam(searchParams, 'type'));
    setFrom(searchParams.get('from') ?? '');
    setTo(searchParams.get('to') ?? '');
    setTag(searchParams.get('tag') ?? '');
  }, [open, searchParams]);

  // Active count for the trigger badge — surfaces "filters are on" at a glance.
  const activeCount =
    parseMultiParam(searchParams, 'account').length +
    parseMultiParam(searchParams, 'type').length +
    (searchParams.get('from') ? 1 : 0) +
    (searchParams.get('to') ? 1 : 0) +
    (searchParams.get('tag') ? 1 : 0);

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function handleApply() {
    const params = new URLSearchParams(searchParams.toString());

    if (platforms.length > 0) params.set('platform', platforms.join(','));
    else params.delete('platform');

    if (selectedAccounts.length > 0) params.set('account', selectedAccounts.join(','));
    else params.delete('account');

    if (types.length > 0) params.set('type', types.join(','));
    else params.delete('type');

    if (from) params.set('from', from); else params.delete('from');
    if (to) params.set('to', to); else params.delete('to');
    if (tag.trim()) params.set('tag', tag.trim()); else params.delete('tag');

    params.delete('cursor');
    router.push('/library?' + params.toString());
    setOpen(false);
  }

  function handleReset() {
    setPlatforms([]);
    setSelectedAccounts([]);
    setTypes([]);
    setFrom('');
    setTo('');
    setTag('');
    router.push('/library');
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={(props) => (
          <button
            {...props}
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <SlidersHorizontal className="size-4" />
            Bộ lọc nâng cao
            {activeCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-violet-100 text-violet-700 text-[10px] font-semibold h-5 min-w-5 px-1">
                {activeCount}
              </span>
            )}
          </button>
        )}
      />

      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bộ lọc nâng cao</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 mt-2">
          {/* Platform — duplicated here so power users can multi-select.
              The main view's tabs only support single-select shortcuts. */}
          <section className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Nền tảng</p>
            <div className="grid grid-cols-2 gap-1.5">
              {PLATFORMS.map((p) => (
                <label key={p.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={platforms.includes(p.value)}
                    onChange={() => toggle(platforms, setPlatforms, p.value)}
                    className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-sm text-zinc-700">{p.label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Account */}
          {accounts.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Tài khoản</p>
              <div className="max-h-40 overflow-y-auto flex flex-col gap-1 pr-1 rounded border border-zinc-100 bg-zinc-50/60 p-2">
                {accounts.map((acc) => (
                  <label key={acc.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedAccounts.includes(acc.id)}
                      onChange={() => toggle(selectedAccounts, setSelectedAccounts, acc.id)}
                      className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                    />
                    <span className="text-xs text-zinc-700 truncate">{acc.name}</span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* Post type */}
          <section className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Loại bài</p>
            <div className="grid grid-cols-2 gap-1.5">
              {POST_TYPES.map((t) => (
                <label key={t.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={types.includes(t.value)}
                    onChange={() => toggle(types, setTypes, t.value)}
                    className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-sm text-zinc-700">{t.label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Date range */}
          <section className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Khoảng ngày</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded border border-zinc-200 px-2 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                min={from || undefined}
                className="w-full rounded border border-zinc-200 px-2 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
          </section>

          {/* Campaign tag */}
          <section className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Campaign tag</p>
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="VD: promo_q1"
              className="w-full rounded border border-zinc-200 px-2 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </section>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-zinc-100 mt-1">
          <DialogClose
            render={(props) => (
              <button
                {...props}
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                Đặt lại
              </button>
            )}
          />
          <button
            onClick={handleApply}
            type="button"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
          >
            Áp dụng
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
