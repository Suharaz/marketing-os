'use client';

// Dialog viết/sửa nội dung bài viết (draft_content).
// Khác với BriefFormDialog — chỉ 1 textarea lớn cho content, không có
// metadata fields (title, format, links...).

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { Brief } from '@/lib/briefs/brief-types';

interface BriefContentEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brief: Brief | null;
  /** Throw nếu fail — dialog tự bắt và hiện lỗi */
  onSubmit: (briefId: string, draftContent: string) => Promise<void>;
}

export function BriefContentEditor({
  open,
  onOpenChange,
  brief,
  onSubmit,
}: BriefContentEditorProps) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Preload nội dung khi mở dialog
  useEffect(() => {
    if (!open || !brief) return;
    setContent(brief.draft_content ?? '');
    setSubmitError(null);
  }, [open, brief]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!brief || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(brief.id, content);
      onOpenChange(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  if (!brief) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Width rộng hơn form-dialog để có chỗ viết */}
      <DialogContent className="max-w-2xl sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Viết bài: {brief.title}</DialogTitle>
          <DialogDescription>
            Soạn nội dung bài viết theo brief. Tham khảo core message + công thức ở detail view.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="brief-content">Nội dung</Label>
              <span className="text-xs text-zinc-400 font-mono">
                {content.length} ký tự
              </span>
            </div>
            <textarea
              id="brief-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                brief.status === 'mine'
                  ? 'Bắt đầu viết draft đầu tiên...'
                  : 'Soạn nội dung bài viết...'
              }
              rows={18}
              autoFocus
              className="w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-sm leading-relaxed transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y font-sans"
            />
          </div>

          {submitError && (
            <p className="text-xs text-rose-600">{submitError}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Huỷ
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {submitting ? 'Đang lưu…' : 'Lưu nội dung'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
