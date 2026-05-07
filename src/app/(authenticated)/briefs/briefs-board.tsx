'use client';

// Client component — state + actions delegate vào useBriefsState hook.
// File này chỉ lo render JSX và truyền callbacks xuống children.

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BriefInboxList } from './brief-inbox-list';
import { BriefDetailView } from './brief-detail-view';
import { BriefFormDialog } from './brief-form-dialog';
import { BriefContentEditor } from './brief-content-editor';
import { LoadMoreBriefsButton } from './load-more-briefs-button';
import { useBriefsState } from './use-briefs-state';
import { useState } from 'react';
import {
  STATUS_ORDER,
  STATUS_CONFIG,
  type Brief,
} from '@/lib/briefs/brief-types';
import type { BriefCounts } from '@/lib/queries/briefs-counts';

interface BriefsBoardProps {
  initialBriefs: Brief[];
  initialCursor: string | null;
  initialCounts: BriefCounts;
}

export function BriefsBoard({
  initialBriefs,
  initialCursor,
  initialCounts,
}: BriefsBoardProps) {
  const {
    currentTab,
    counts,
    activeTab,
    setActiveTab,
    selectedBriefId,
    setSelectedBriefId,
    selectedBrief,
    error,
    clearError,
    activityRefetchKey,
    loadMore,
    createBrief,
    editBrief,
    editDraftContent,
    changeStatus,
  } = useBriefsState({ initialBriefs, initialCursor, initialCounts });

  // 2 dialog tách biệt:
  //   - isFormOpen: BriefFormDialog (sửa brief metadata)
  //   - isContentEditorOpen: BriefContentEditor (viết/sửa bài)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBrief, setEditingBrief] = useState<Brief | null>(null);

  const [isContentEditorOpen, setIsContentEditorOpen] = useState(false);
  const [editingContentBrief, setEditingContentBrief] = useState<Brief | null>(null);

  function handleEditBriefClick(brief: Brief) {
    setEditingBrief(brief);
    setIsFormOpen(true);
  }
  function handleEditContentClick(brief: Brief) {
    setEditingContentBrief(brief);
    setIsContentEditorOpen(true);
  }
  function handleNewClick() {
    setEditingBrief(null);
    setIsFormOpen(true);
  }
  function handleFormOpenChange(open: boolean) {
    setIsFormOpen(open);
    if (!open) setEditingBrief(null);
  }
  function handleContentEditorOpenChange(open: boolean) {
    setIsContentEditorOpen(open);
    if (!open) setEditingContentBrief(null);
  }
  // Form submit handler — branch theo mode
  async function handleFormSubmit(input: unknown) {
    if (editingBrief) {
      await editBrief(
        editingBrief.id,
        // editBrief expects UpdateBriefContentInput; form đảm bảo shape đúng
        input as Parameters<typeof editBrief>[1]
      );
    } else {
      await createBrief(input as Parameters<typeof createBrief>[0]);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Xưởng nội dung</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Nhận brief · sản xuất content · auto-score trước khi publish
          </p>
        </div>
        <Button
          onClick={handleNewClick}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          <Plus className="size-4" />
          Brief mới
        </Button>
      </div>

      {/* Error banner — dismissable */}
      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg bg-rose-50 ring-1 ring-rose-200 px-3 py-2 text-sm text-rose-700">
          <span>⚠️ {error}</span>
          <button
            type="button"
            onClick={clearError}
            className="text-rose-400 hover:text-rose-700"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Status tabs với count badges */}
      <div className="flex flex-wrap gap-1 border-b border-zinc-200">
        {STATUS_ORDER.map((status) => {
          const cfg = STATUS_CONFIG[status];
          const isActive = activeTab === status;
          const count = counts[status] ?? 0;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setActiveTab(status)}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px border-b-2 ${
                isActive
                  ? 'border-amber-500 text-zinc-900'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {cfg.label}
              <span
                className={`text-[11px] font-semibold px-1.5 min-w-[20px] text-center rounded ${
                  isActive ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2-column layout — inbox + load-more bên trái, detail bên phải */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-5 items-start">
        <div className="flex flex-col gap-3">
          <BriefInboxList
            briefs={currentTab.briefs}
            selectedBriefId={selectedBriefId}
            onSelect={setSelectedBriefId}
            countLabel={
              currentTab.loading && !currentTab.loaded
                ? 'Đang tải…'
                : `${currentTab.briefs.length}${currentTab.cursor ? '+' : ''}`
            }
          />
          <LoadMoreBriefsButton
            hasMore={currentTab.cursor !== null}
            loading={currentTab.loading}
            onLoadMore={loadMore}
          />
        </div>

        <BriefDetailView
          brief={selectedBrief}
          onChangeStatus={changeStatus}
          onEditBrief={handleEditBriefClick}
          onEditContent={handleEditContentClick}
          activityRefetchKey={activityRefetchKey}
        />
      </div>

      <BriefFormDialog
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        initialBrief={editingBrief}
        onSubmit={handleFormSubmit}
      />

      <BriefContentEditor
        open={isContentEditorOpen}
        onOpenChange={handleContentEditorOpenChange}
        brief={editingContentBrief}
        onSubmit={editDraftContent}
      />
    </div>
  );
}
