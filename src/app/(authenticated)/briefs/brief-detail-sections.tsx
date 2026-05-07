// Sub-section components cho brief detail view.
// Mỗi section có header (emoji + uppercase label) + body.
// Server component — pure render, không state.

import type {
  BriefAttachment,
  BriefAudienceTarget,
  BriefDeconstructFormula,
  BriefReferenceLink,
} from '@/lib/briefs/brief-types';

interface SectionHeaderProps {
  emoji: string;
  label: string;
}

export function SectionHeader({ emoji, label }: SectionHeaderProps) {
  return (
    <h4 className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-zinc-700 mb-2">
      <span>{emoji}</span>
      <span>{label}</span>
    </h4>
  );
}

// ─── Core message — orange accent box ───────────────────────────────────────────
interface CoreMessageBoxProps {
  message: string;
}

export function CoreMessageBox({ message }: CoreMessageBoxProps) {
  return (
    <div className="border-l-4 border-amber-500 bg-amber-50/60 px-4 py-3 rounded-r">
      <p className="text-sm italic text-zinc-800 leading-relaxed">{message}</p>
    </div>
  );
}

// ─── Audience target — 2 fields ─────────────────────────────────────────────────
interface AudienceTargetBlockProps {
  target: BriefAudienceTarget;
}

export function AudienceTargetBlock({ target }: AudienceTargetBlockProps) {
  return (
    <div className="space-y-1.5 text-sm text-zinc-700">
      <p>
        <span className="font-semibold">Audience:</span> {target.audience}
      </p>
      <p>
        <span className="font-semibold">Emotion target:</span> {target.emotion_target}
      </p>
    </div>
  );
}

// ─── Deconstruct formula — table 5 rows ─────────────────────────────────────────
interface DeconstructTableProps {
  formula: BriefDeconstructFormula;
}

const DECONSTRUCT_ROWS: Array<{
  key: keyof BriefDeconstructFormula;
  label: string;
}> = [
  { key: 'hook_3s',     label: 'HOOK 3S' },
  { key: 'structure',   label: 'STRUCTURE' },
  { key: 'emotion_arc', label: 'EMOTION ARC' },
  { key: 'pacing',      label: 'PACING' },
  { key: 'cta',         label: 'CTA' },
];

export function DeconstructTable({ formula }: DeconstructTableProps) {
  return (
    <div className="rounded-lg ring-1 ring-zinc-200 bg-zinc-50/50 overflow-hidden divide-y divide-zinc-200">
      {DECONSTRUCT_ROWS.map((row) => (
        <div key={row.key} className="grid grid-cols-[120px_1fr] gap-3 px-4 py-2.5">
          <span className="text-xs font-mono font-semibold tracking-wide text-zinc-500 uppercase">
            {row.label}
          </span>
          <span className="text-sm text-zinc-700 leading-snug">
            {formula[row.key]}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Reference links — clickable list ───────────────────────────────────────────
interface ReferenceLinksListProps {
  links: BriefReferenceLink[];
}

export function ReferenceLinksList({ links }: ReferenceLinksListProps) {
  return (
    <ul className="space-y-1.5 text-sm">
      {links.map((link) => (
        <li key={link.id} className="flex gap-2 items-start">
          <span className="text-zinc-400 shrink-0">·</span>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-700 hover:text-amber-900 hover:underline break-all"
          >
            {link.label || link.url}
          </a>
        </li>
      ))}
    </ul>
  );
}

// ─── Attachments — file name + size ─────────────────────────────────────────────
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

interface AttachmentsListProps {
  attachments: BriefAttachment[];
}

export function AttachmentsList({ attachments }: AttachmentsListProps) {
  return (
    <ul className="space-y-1.5 text-sm">
      {attachments.map((a) => (
        <li
          key={a.id}
          className="flex items-center justify-between gap-2 px-3 py-1.5 rounded bg-zinc-50 ring-1 ring-zinc-200"
        >
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            download={a.filename}
            className="text-zinc-700 hover:text-amber-700 truncate flex-1"
          >
            {a.filename}
          </a>
          <span className="text-xs text-zinc-400 font-mono shrink-0">
            {formatBytes(a.size_bytes)}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ─── Bullet list — proof points / rules ─────────────────────────────────────────
interface BulletListProps {
  items: string[];
}

export function BulletList({ items }: BulletListProps) {
  return (
    <ul className="space-y-1.5 text-sm text-zinc-700 leading-relaxed">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-zinc-400">·</span>
          <span className="flex-1">{item}</span>
        </li>
      ))}
    </ul>
  );
}
