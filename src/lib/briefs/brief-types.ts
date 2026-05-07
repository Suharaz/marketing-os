// Type definitions cho Brief feature.
// Tách riêng khỏi mock data để sau khi chuyển sang DB,
// chỉ cần update query functions, types vẫn giữ nguyên.

export type BriefStatusT =
  | 'mine'        // Briefs của tôi — vừa nhận, chưa bắt đầu
  | 'draft'       // Đang viết draft
  | 'submitted'   // Đã submit cho review
  | 'published'   // Đã publish lên kênh
  | 'revision';   // Cần sửa theo feedback

/** Format cụ thể của content — không phải platform thuần.
 *  TikTok video khác Facebook Reels khác Facebook Post. */
export type BriefFormatT =
  | 'tiktok'
  | 'fb_reels'
  | 'fb_post'
  | 'yt_shorts'
  | 'yt_long'
  | 'threads'
  | 'instagram_post'
  | 'instagram_reels';

export type BriefPriorityT = 'high' | 'medium' | 'low';

/** Persona/voice profile gắn với brief — VD "AI for Founder", "Solopreneur" */
export interface BriefPersona {
  id: string;
  name: string;
  /** Tailwind color class cho dot đứng trước tên — bg-rose-500, bg-amber-500... */
  dot_color: string;
}

/** Link tham khảo — bài viết mẫu, đối thủ, nguồn cảm hứng */
export interface BriefReferenceLink {
  id: string;
  url: string;
  label: string | null;
}

/** File đính kèm — ảnh, PDF, Word */
export interface BriefAttachment {
  id: string;
  filename: string;
  size_bytes: number;
  mime_type: string;
  url: string;
}

/** Công thức deconstruct từ Spy Room — analyse content viral để tái áp dụng */
export interface BriefDeconstructFormula {
  hook_3s: string;
  structure: string;
  emotion_arc: string;
  pacing: string;
  cta: string;
}

/** Audience + cảm xúc target — section "TARGET AUDIENCE & EMOTION" */
export interface BriefAudienceTarget {
  audience: string;
  emotion_target: string;
}

export interface Brief {
  id: string;
  /** Display ID human-readable, VD "brief_042_linh_tt" */
  display_id: string;
  title: string;
  description: string;
  status: BriefStatusT;
  format: BriefFormatT;
  priority: BriefPriorityT;
  persona: BriefPersona;
  /** Người được phân — null nếu chưa assign */
  assigned_to: string | null;
  /** Nguồn brief — VD "Spy Room", "Manual", "Customer". Hiện trong meta line */
  source: string;

  // Content production fields
  core_message: string | null;
  audience_target: BriefAudienceTarget | null;
  deconstruct: BriefDeconstructFormula | null;
  persona_tone: string | null;
  proof_points: string[];
  rules: string[];

  // Attachments + workflow
  reference_links: BriefReferenceLink[];
  attachments: BriefAttachment[];
  deadline: string | null;
  /** Nội dung bài viết — null khi brief mới (status=mine), writer fill khi sang draft */
  draft_content: string | null;
  created_at: string;
  updated_at: string;
}

/** Cấu hình hiển thị cho từng status — label tiếng Việt + màu badge */
export const STATUS_CONFIG: Record<
  BriefStatusT,
  { label: string; badgeClass: string; description: string }
> = {
  mine: {
    label: 'Briefs của tôi',
    badgeClass: 'bg-amber-100 text-amber-700',
    description: 'Brief mới nhận, chưa bắt đầu xử lý',
  },
  draft: {
    label: 'Drafts',
    badgeClass: 'bg-blue-100 text-blue-700',
    description: 'Đang viết draft',
  },
  submitted: {
    label: 'Đã submit',
    badgeClass: 'bg-violet-100 text-violet-700',
    description: 'Đã submit cho review',
  },
  published: {
    label: 'Published',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    description: 'Đã publish lên kênh',
  },
  revision: {
    label: 'Revisions cần sửa',
    badgeClass: 'bg-rose-100 text-rose-700',
    description: 'Cần chỉnh sửa theo feedback',
  },
};

/** Thứ tự hiển thị các tab — match flow Brief → Draft → Submitted → Published (+ Revisions) */
export const STATUS_ORDER: BriefStatusT[] = [
  'mine',
  'draft',
  'submitted',
  'published',
  'revision',
];

/** Cấu hình hiển thị cho từng format — uppercase pill */
export const FORMAT_CONFIG: Record<
  BriefFormatT,
  { label: string; dotColor: string }
> = {
  tiktok:           { label: 'TIKTOK',     dotColor: 'bg-rose-500' },
  fb_reels:         { label: 'FB REELS',   dotColor: 'bg-blue-500' },
  fb_post:          { label: 'FB POST',    dotColor: 'bg-blue-500' },
  yt_shorts:        { label: 'YT SHORTS',  dotColor: 'bg-red-500' },
  yt_long:          { label: 'YT LONG',    dotColor: 'bg-red-600' },
  threads:          { label: 'THREADS',    dotColor: 'bg-zinc-700' },
  instagram_post:   { label: 'IG POST',    dotColor: 'bg-pink-500' },
  instagram_reels:  { label: 'IG REELS',   dotColor: 'bg-pink-500' },
};

export const PRIORITY_CONFIG: Record<
  BriefPriorityT,
  { label: string; badgeClass: string }
> = {
  high:   { label: 'HIGH', badgeClass: 'bg-amber-100 text-amber-700' },
  medium: { label: 'MED',  badgeClass: 'bg-yellow-50 text-yellow-700' },
  low:    { label: 'LOW',  badgeClass: 'bg-zinc-100 text-zinc-500' },
};
