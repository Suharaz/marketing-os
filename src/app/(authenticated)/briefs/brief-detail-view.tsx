// Detail view bên phải — pills, title, meta, sections, status action bar.
// 'use client' vì có button onChangeStatus.

'use client';

import { FileText, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Brief, BriefStatusT } from '@/lib/briefs/brief-types';
import {
  AttachmentsList,
  AudienceTargetBlock,
  BulletList,
  CoreMessageBox,
  DeconstructTable,
  ReferenceLinksList,
  SectionHeader,
} from './brief-detail-sections';
import { BriefStatusActions } from './brief-status-actions';
import { BriefActivityTimeline } from './brief-activity-timeline';

interface BriefDetailViewProps {
  brief: Brief | null;
  /** Callback khi user click action chuyển status trong action bar */
  onChangeStatus: (briefId: string, next: BriefStatusT) => void;
  /** Sửa metadata brief (title, format, links...) — cho status=mine */
  onEditBrief: (brief: Brief) => void;
  /** Sửa nội dung bài viết (draft_content) — cho status >= draft */
  onEditContent: (brief: Brief) => void;
  /** Bump để force activity timeline refetch sau mutation */
  activityRefetchKey: number;
}

// Format meta line: "Phân cho X · Source · Deadline ..."
function buildMetaLine(brief: Brief): string {
  const parts: string[] = [];
  if (brief.assigned_to) parts.push(`Phân cho ${brief.assigned_to}`);
  if (brief.source) parts.push(brief.source);
  if (brief.deadline) {
    const d = new Date(brief.deadline);
    const now = new Date();
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const time = new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
    parts.push(isToday ? `Deadline hôm nay ${time}` : `Deadline ${d.toLocaleDateString('vi-VN')} ${time}`);
  }
  return parts.join(' · ');
}

export function BriefDetailView({
  brief,
  onChangeStatus,
  onEditBrief,
  onEditContent,
  activityRefetchKey,
}: BriefDetailViewProps) {
  if (!brief) {
    return (
      <div className="rounded-xl bg-white ring-1 ring-zinc-200 py-24 text-center">
        <p className="text-sm text-zinc-500">Chọn brief từ inbox để xem chi tiết.</p>
      </div>
    );
  }

  const meta = buildMetaLine(brief);

  return (
    <article className="rounded-xl bg-white ring-1 ring-zinc-200 p-6 flex flex-col gap-6">
      {/* Title + meta + nút edit theo context */}
      <div className="border-b border-zinc-100 pb-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h1 className="text-xl font-bold text-zinc-900 leading-tight flex-1">
            {brief.title}
          </h1>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Sửa brief metadata — chỉ cho status=mine, sau đó brief đã chốt */}
            {brief.status === 'mine' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onEditBrief(brief)}
              >
                <Pencil className="size-3.5" />
                Sửa brief
              </Button>
            )}
            {/* Viết/sửa nội dung — cho mọi status, primary action khi đã sang draft */}
            <Button
              type="button"
              size="sm"
              onClick={() => onEditContent(brief)}
              className={
                brief.status === 'mine'
                  ? ''
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }
              variant={brief.status === 'mine' ? 'outline' : 'default'}
            >
              <FileText className="size-3.5" />
              {brief.draft_content ? 'Sửa bài viết' : 'Viết bài'}
            </Button>
          </div>
        </div>
        {meta && <p className="text-sm text-zinc-500">{meta}</p>}
      </div>

      {/* Sections — chỉ render khi có data tương ứng */}
      {brief.core_message && (
        <section>
          <SectionHeader emoji="⚡" label="Core message (bất biến)" />
          <CoreMessageBox message={brief.core_message} />
        </section>
      )}

      {brief.audience_target && (
        <section>
          <SectionHeader emoji="🎯" label="Target audience & emotion" />
          <AudienceTargetBlock target={brief.audience_target} />
        </section>
      )}

      {brief.deconstruct && (
        <section>
          <SectionHeader emoji="🛠️" label="Công thức deconstruct (từ Spy Room)" />
          <DeconstructTable formula={brief.deconstruct} />
        </section>
      )}

      {brief.persona_tone && (
        <section>
          <SectionHeader emoji="🎭" label="Persona & tone" />
          <p className="text-sm text-zinc-700 leading-relaxed">{brief.persona_tone}</p>
        </section>
      )}

      {brief.proof_points.length > 0 && (
        <section>
          <SectionHeader emoji="💡" label="Proof points có thể dùng" />
          <BulletList items={brief.proof_points} />
        </section>
      )}

      {brief.rules.length > 0 && (
        <section>
          <SectionHeader emoji="🚫" label="Rules bắt buộc" />
          <BulletList items={brief.rules} />
        </section>
      )}

      {/* Empty state khi brief chưa có rich content — hiện description thô */}
      {!brief.core_message && brief.description && (
        <section>
          <SectionHeader emoji="📝" label="Mô tả" />
          <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">
            {brief.description}
          </p>
        </section>
      )}

      {brief.reference_links.length > 0 && (
        <section>
          <SectionHeader emoji="🔗" label="Link tham khảo" />
          <ReferenceLinksList links={brief.reference_links} />
        </section>
      )}

      {brief.attachments.length > 0 && (
        <section>
          <SectionHeader emoji="📎" label="File đính kèm" />
          <AttachmentsList attachments={brief.attachments} />
        </section>
      )}

      {/* Draft content section — luôn render khi đã có content,
          hoặc khi status không phải mine (writer cần thấy chỗ viết) */}
      {(brief.draft_content || brief.status !== 'mine') && (
        <section>
          <SectionHeader emoji="✍️" label="Nội dung bài viết" />
          {brief.draft_content ? (
            <div className="rounded-lg ring-1 ring-zinc-200 bg-zinc-50/50 px-4 py-3">
              <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">
                {brief.draft_content}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-6 text-center">
              <p className="text-sm text-zinc-500">Chưa có nội dung.</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                Bấm "Viết bài" ở trên để bắt đầu.
              </p>
            </div>
          )}
        </section>
      )}

      <BriefStatusActions
        currentStatus={brief.status}
        onChangeStatus={(next) => onChangeStatus(brief.id, next)}
      />

      {/* Activity timeline — luôn render dưới cùng */}
      <section className="pt-4 border-t border-zinc-100">
        <SectionHeader emoji="🕓" label="Lịch sử hoạt động" />
        <BriefActivityTimeline briefId={brief.id} refetchKey={activityRefetchKey} />
      </section>
    </article>
  );
}
