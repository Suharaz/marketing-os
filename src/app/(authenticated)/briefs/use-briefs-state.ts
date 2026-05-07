'use client';

// Custom hook quản lý toàn bộ state + API calls cho BriefsBoard.
// Tách khỏi component để briefs-board.tsx chỉ lo JSX, dễ đọc.
//
// State shape:
//   - tabs[status]: { briefs, cursor, loaded, loading } — cache per-tab
//   - counts: badge numbers (1 query riêng, refetch khi mutate)
//   - active: tab đang chọn
//   - selectedId: brief id đang hiện ở detail view

import { useCallback, useEffect, useState } from 'react';
import type { Brief, BriefStatusT } from '@/lib/briefs/brief-types';
import type {
  CreateBriefInput,
  UpdateBriefContentInput,
} from '@/lib/queries/briefs-mutate';
import type { BriefCounts } from '@/lib/queries/briefs-counts';

interface TabState {
  briefs: Brief[];
  cursor: string | null;
  loaded: boolean;
  loading: boolean;
}

const EMPTY_TAB: TabState = { briefs: [], cursor: null, loaded: false, loading: false };

interface UseBriefsStateArgs {
  initialBriefs: Brief[];
  initialCursor: string | null;
  initialCounts: BriefCounts;
}

export function useBriefsState({
  initialBriefs,
  initialCursor,
  initialCounts,
}: UseBriefsStateArgs) {
  const [tabs, setTabs] = useState<Record<BriefStatusT, TabState>>({
    mine:      { briefs: initialBriefs, cursor: initialCursor, loaded: true, loading: false },
    draft:     { ...EMPTY_TAB },
    submitted: { ...EMPTY_TAB },
    published: { ...EMPTY_TAB },
    revision:  { ...EMPTY_TAB },
  });
  const [counts, setCounts] = useState<BriefCounts>(initialCounts);
  const [activeTab, setActiveTab] = useState<BriefStatusT>('mine');
  const [selectedBriefId, setSelectedBriefId] = useState<string | null>(
    initialBriefs[0]?.id ?? null
  );
  const [error, setError] = useState<string | null>(null);
  // Bump để force activity timeline refetch sau mutation
  const [activityRefetchKey, setActivityRefetchKey] = useState(0);

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  const fetchTabPage = useCallback(
    async (status: BriefStatusT, cursor: string | null) => {
      const params = new URLSearchParams({ status });
      if (cursor) params.set('cursor', cursor);
      const res = await fetch(`/api/briefs?${params.toString()}`);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      return (await res.json()) as { briefs: Brief[]; nextCursor: string | null };
    },
    []
  );

  const refetchCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/briefs/counts');
      if (res.ok) {
        const data = (await res.json()) as { counts: BriefCounts };
        setCounts(data.counts);
      }
    } catch (err) {
      console.error('Refetch counts failed', err);
    }
  }, []);

  // ─── Auto-fetch khi switch tab nếu chưa load ──────────────────────────────────
  useEffect(() => {
    const tab = tabs[activeTab];
    if (tab.loaded || tab.loading) return;

    setTabs((prev) => ({ ...prev, [activeTab]: { ...prev[activeTab], loading: true } }));
    fetchTabPage(activeTab, null)
      .then((data) => {
        setTabs((prev) => ({
          ...prev,
          [activeTab]: { briefs: data.briefs, cursor: data.nextCursor, loaded: true, loading: false },
        }));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Lỗi tải brief');
        setTabs((prev) => ({ ...prev, [activeTab]: { ...prev[activeTab], loading: false } }));
      });
  }, [activeTab, tabs, fetchTabPage]);

  // ─── Auto-select brief đầu khi đổi tab / sau load ──────────────────────────────
  useEffect(() => {
    const list = tabs[activeTab].briefs;
    const first = list[0];
    if (!first) {
      setSelectedBriefId(null);
      return;
    }
    const stillValid = list.some((b) => b.id === selectedBriefId);
    if (!stillValid) setSelectedBriefId(first.id);
  }, [tabs, activeTab, selectedBriefId]);

  // ─── Actions ──────────────────────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    const tab = tabs[activeTab];
    if (!tab.cursor || tab.loading) return;
    setTabs((prev) => ({ ...prev, [activeTab]: { ...prev[activeTab], loading: true } }));
    try {
      const data = await fetchTabPage(activeTab, tab.cursor);
      setTabs((prev) => ({
        ...prev,
        [activeTab]: {
          briefs: [...prev[activeTab].briefs, ...data.briefs],
          cursor: data.nextCursor,
          loaded: true,
          loading: false,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải thêm');
      setTabs((prev) => ({ ...prev, [activeTab]: { ...prev[activeTab], loading: false } }));
    }
  }, [activeTab, tabs, fetchTabPage]);

  const createBrief = useCallback(
    async (input: CreateBriefInput) => {
      const res = await fetch('/api/briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as { brief?: Brief; error?: string };
      if (!res.ok || !data.brief) throw new Error(data.error ?? 'Tạo brief thất bại');
      // Prepend vào tab mine + count++ + switch tab + select
      setTabs((prev) => ({
        ...prev,
        mine: { ...prev.mine, briefs: [data.brief!, ...prev.mine.briefs] },
      }));
      setCounts((prev) => ({ ...prev, mine: prev.mine + 1 }));
      setActiveTab('mine');
      setSelectedBriefId(data.brief.id);
      setActivityRefetchKey((k) => k + 1);
    },
    []
  );

  /** Helper update brief trong tất cả tabs (id unique nên scan cả 5 tab an toàn) */
  const replaceBriefInTabs = useCallback((updated: Brief) => {
    setTabs((prev) => {
      const next = { ...prev };
      for (const status of Object.keys(next) as BriefStatusT[]) {
        next[status] = {
          ...next[status],
          briefs: next[status].briefs.map((b) => (b.id === updated.id ? updated : b)),
        };
      }
      return next;
    });
  }, []);

  const editBrief = useCallback(
    async (briefId: string, input: UpdateBriefContentInput) => {
      const res = await fetch(`/api/briefs/${briefId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as { brief?: Brief; error?: string };
      if (!res.ok || !data.brief) throw new Error(data.error ?? 'Sửa brief thất bại');
      replaceBriefInTabs(data.brief);
      setActivityRefetchKey((k) => k + 1);
    },
    [replaceBriefInTabs]
  );

  const editDraftContent = useCallback(
    async (briefId: string, draftContent: string) => {
      const res = await fetch(`/api/briefs/${briefId}/draft-content`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft_content: draftContent }),
      });
      const data = (await res.json()) as { brief?: Brief; error?: string };
      if (!res.ok || !data.brief) throw new Error(data.error ?? 'Lưu nội dung thất bại');
      replaceBriefInTabs(data.brief);
      setActivityRefetchKey((k) => k + 1);
    },
    [replaceBriefInTabs]
  );

  const changeStatus = useCallback(
    async (briefId: string, next: BriefStatusT) => {
      const fromTab = activeTab;
      try {
        const res = await fetch(`/api/briefs/${briefId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: next }),
        });
        const data = (await res.json()) as { brief?: Brief; error?: string };
        if (!res.ok || !data.brief) throw new Error(data.error ?? 'Đổi status thất bại');

        setTabs((prev) => {
          const updated: Record<BriefStatusT, TabState> = {
            ...prev,
            [fromTab]: {
              ...prev[fromTab],
              briefs: prev[fromTab].briefs.filter((b) => b.id !== briefId),
            },
          };
          // Chỉ prepend vào tab đích nếu nó đã load — nếu chưa, sẽ fetch khi user switch
          if (prev[next].loaded) {
            updated[next] = { ...prev[next], briefs: [data.brief!, ...prev[next].briefs] };
          }
          return updated;
        });
        setCounts((prev) => ({
          ...prev,
          [fromTab]: Math.max(0, prev[fromTab] - 1),
          [next]: prev[next] + 1,
        }));
        setActiveTab(next);
        setSelectedBriefId(briefId);
        setActivityRefetchKey((k) => k + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Đổi status thất bại');
      }
    },
    [activeTab]
  );

  // ─── Derived ──────────────────────────────────────────────────────────────────
  const currentTab = tabs[activeTab];
  const selectedBrief =
    currentTab.briefs.find((b) => b.id === selectedBriefId) ?? null;

  return {
    tabs,
    currentTab,
    counts,
    activeTab,
    setActiveTab,
    selectedBriefId,
    setSelectedBriefId,
    selectedBrief,
    error,
    clearError: () => setError(null),
    activityRefetchKey,
    loadMore,
    createBrief,
    editBrief,
    editDraftContent,
    changeStatus,
    refetchCounts,
  };
}
