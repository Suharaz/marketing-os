// Map từ DB row (snake_case, raw types) → Brief TS interface (camelCase mostly preserved
// vì Brief đã dùng snake_case match DB schema). Tách function riêng để query files
// chỉ lo SQL, không lo formatting.

import type {
  Brief,
  BriefAttachment,
  BriefAudienceTarget,
  BriefDeconstructFormula,
  BriefFormatT,
  BriefPersona,
  BriefPriorityT,
  BriefReferenceLink,
  BriefStatusT,
} from './brief-types';

/** Row trả về từ JOIN briefs + briefs_persona */
export interface BriefRow {
  id: string;
  display_id: string;
  title: string;
  description: string;
  status: BriefStatusT;
  format: BriefFormatT;
  priority: BriefPriorityT;
  persona_id: string;
  persona_name: string;
  persona_dot_color: string;
  assigned_to: string | null;
  source: string;
  core_message: string | null;
  audience_target: BriefAudienceTarget | null;
  deconstruct: BriefDeconstructFormula | null;
  persona_tone: string | null;
  proof_points: string[];
  rules: string[];
  reference_links: BriefReferenceLink[];
  attachments: BriefAttachment[];
  deadline: Date | null;
  draft_content: string | null;
  created_at: Date;
  updated_at: Date;
}

/** Convert Date → ISO string (Date không serialize qua JSON sạch) */
function toIso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

export function mapBriefRow(row: BriefRow): Brief {
  const persona: BriefPersona = {
    id: row.persona_id,
    name: row.persona_name,
    dot_color: row.persona_dot_color,
  };
  return {
    id: row.id,
    display_id: row.display_id,
    title: row.title,
    description: row.description,
    status: row.status,
    format: row.format,
    priority: row.priority,
    persona,
    assigned_to: row.assigned_to,
    source: row.source,
    core_message: row.core_message,
    audience_target: row.audience_target,
    deconstruct: row.deconstruct,
    persona_tone: row.persona_tone,
    proof_points: row.proof_points ?? [],
    rules: row.rules ?? [],
    reference_links: row.reference_links ?? [],
    attachments: row.attachments ?? [],
    deadline: toIso(row.deadline),
    draft_content: row.draft_content,
    created_at: toIso(row.created_at) ?? '',
    updated_at: toIso(row.updated_at) ?? '',
  };
}

/** SELECT clause dùng chung cho list + get-one — JOIN persona */
export const BRIEF_SELECT_SQL = `
  SELECT
    b.id, b.display_id, b.title, b.description,
    b.status, b.format, b.priority,
    b.persona_id,
    p.name AS persona_name,
    p.dot_color AS persona_dot_color,
    b.assigned_to, b.source,
    b.core_message, b.audience_target, b.deconstruct,
    b.persona_tone, b.proof_points, b.rules,
    b.reference_links, b.attachments,
    b.deadline, b.draft_content, b.created_at, b.updated_at
  FROM briefs b
  JOIN briefs_persona p ON p.id = b.persona_id
`;
