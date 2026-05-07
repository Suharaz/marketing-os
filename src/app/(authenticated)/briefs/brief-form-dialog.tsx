'use client';

// Form dialog dual-mode: create brief mới HOẶC edit content brief đã có.
// - mode='create': field rỗng, submit POST /api/briefs
// - mode='edit':  field pre-fill từ initialBrief, submit PATCH /api/briefs/[id]
// Persona/core_message/deconstruct... do "Spy Room" auto-fill, không edit ở đây.

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type {
  Brief,
  BriefAttachment,
  BriefFormatT,
  BriefPriorityT,
  BriefReferenceLink,
} from '@/lib/briefs/brief-types';
import type {
  CreateBriefInput,
  UpdateBriefContentInput,
} from '@/lib/queries/briefs-mutate';
import { FORMAT_CONFIG, PRIORITY_CONFIG } from '@/lib/briefs/brief-types';

// Default persona name — phải match name trong bảng briefs_persona (seed data)
const DEFAULT_PERSONA_NAME = 'AI for Founder';

const FORMAT_OPTIONS: BriefFormatT[] = [
  'tiktok', 'fb_reels', 'fb_post', 'yt_shorts', 'threads', 'instagram_post',
];
const PRIORITY_OPTIONS: BriefPriorityT[] = ['high', 'medium', 'low'];

/** Convert ISO datetime → format yêu cầu của <input type="datetime-local">: YYYY-MM-DDTHH:mm */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  // Format theo local timezone, không UTC
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface BriefFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** undefined = create mode; có brief = edit mode */
  initialBrief?: Brief | null;
  /** Throw nếu fail — dialog tự bắt và hiện lỗi.
   *  Nhận union vì cùng 1 form xử lý cả create + edit. */
  onSubmit: (input: CreateBriefInput | UpdateBriefContentInput) => Promise<void>;
}

export function BriefFormDialog({
  open,
  onOpenChange,
  initialBrief,
  onSubmit,
}: BriefFormDialogProps) {
  const isEdit = !!initialBrief;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState<BriefFormatT>('tiktok');
  const [priority, setPriority] = useState<BriefPriorityT>('medium');
  const [links, setLinks] = useState<BriefReferenceLink[]>([]);
  const [attachments, setAttachments] = useState<BriefAttachment[]>([]);
  const [deadline, setDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset/preload form mỗi khi dialog mở hoặc initialBrief đổi
  useEffect(() => {
    if (!open) return;
    if (initialBrief) {
      setTitle(initialBrief.title);
      setDescription(initialBrief.description);
      setFormat(initialBrief.format);
      setPriority(initialBrief.priority);
      setLinks(initialBrief.reference_links);
      setAttachments(initialBrief.attachments);
      setDeadline(isoToLocalInput(initialBrief.deadline));
    } else {
      setTitle('');
      setDescription('');
      setFormat('tiktok');
      setPriority('medium');
      setLinks([]);
      setAttachments([]);
      setDeadline('');
    }
    setSubmitError(null);
  }, [open, initialBrief]);

  function handleAddLink() {
    setLinks((prev) => [...prev, { id: `link-${Date.now()}`, url: '', label: null }]);
  }
  function handleUpdateLink(id: string, url: string) {
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, url } : l)));
  }
  function handleRemoveLink(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const newAttachments: BriefAttachment[] = files.map((f) => ({
      id: `file-${Date.now()}-${f.name}`,
      filename: f.name,
      size_bytes: f.size,
      mime_type: f.type,
      url: URL.createObjectURL(f),
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
    // Reset input để chọn lại cùng file vẫn fire onChange
    e.target.value = '';
  }
  function handleRemoveAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    const baseFields = {
      title: title.trim(),
      description: description.trim(),
      format,
      priority,
      reference_links: links.filter((l) => l.url.trim() !== ''),
      attachments,
      deadline: deadline ? new Date(deadline).toISOString() : null,
    };

    const input: CreateBriefInput | UpdateBriefContentInput = isEdit
      ? baseFields
      : { ...baseFields, persona_name: DEFAULT_PERSONA_NAME };

    try {
      await onSubmit(input);
      onOpenChange(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Lưu brief thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Sửa brief' : 'Brief mới'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Cập nhật tiêu đề, mô tả, link, deadline và phân loại brief.'
              : 'Dán link bài viết mẫu, upload ảnh, mô tả yêu cầu — gói gọn trong một brief.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Title — required */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brief-title">
              Tiêu đề <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="brief-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: AI Founder 52t vs Cháu 24t — FOMO story..."
              required
            />
          </div>

          {/* Format + Priority — 2 cột */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="brief-format">Format</Label>
              <select
                id="brief-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as BriefFormatT)}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {FORMAT_OPTIONS.map((f) => (
                  <option key={f} value={f}>{FORMAT_CONFIG[f].label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="brief-priority">Priority</Label>
              <select
                id="brief-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as BriefPriorityT)}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brief-desc">Mô tả yêu cầu</Label>
            <textarea
              id="brief-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Yêu cầu chi tiết: độ dài, tone, focus, target audience..."
              rows={3}
              className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y"
            />
          </div>

          {/* Reference links */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Link bài viết mẫu</Label>
              <Button type="button" variant="ghost" size="xs" onClick={handleAddLink}>
                <Plus className="size-3" />
                Thêm link
              </Button>
            </div>
            {links.length === 0 ? (
              <p className="text-xs text-zinc-400 italic">Chưa có link nào.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {links.map((link) => (
                  <div key={link.id} className="flex items-center gap-2">
                    <Input
                      value={link.url}
                      onChange={(e) => handleUpdateLink(link.id, e.target.value)}
                      placeholder="https://..."
                      type="url"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRemoveLink(link.id)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* File upload */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brief-files">Ảnh/file đính kèm</Label>
            <input
              id="brief-files"
              type="file"
              multiple
              onChange={handleFileChange}
              className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200"
            />
            {attachments.length > 0 && (
              <ul className="flex flex-col gap-1 mt-1">
                {attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between text-xs bg-zinc-50 rounded px-2 py-1"
                  >
                    <span className="truncate">{a.filename}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(a.id)}
                      className="text-zinc-400 hover:text-rose-600"
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Deadline */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brief-deadline">Deadline</Label>
            <Input
              id="brief-deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          {submitError && (
            <p className="text-xs text-rose-600 -mt-2">{submitError}</p>
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
              {submitting ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Tạo brief'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
