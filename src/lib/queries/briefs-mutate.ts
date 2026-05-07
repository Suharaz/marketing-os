// Mutations: createBrief + updateBriefStatus + updateBriefContent.
// Mỗi mutation tự log activity sau khi thành công.
// Trả về Brief đã insert/update để client cập nhật state ngay (không cần refetch).

import { db } from '@/lib/db';
import {
  BRIEF_SELECT_SQL,
  mapBriefRow,
  type BriefRow,
} from '@/lib/briefs/brief-row-mapper';
import type {
  Brief,
  BriefAttachment,
  BriefFormatT,
  BriefPriorityT,
  BriefReferenceLink,
  BriefStatusT,
} from '@/lib/briefs/brief-types';
import { logActivity } from './briefs-activity';

/** Actor info từ session — phải truyền vào mọi mutation để log */
export interface ActorInfo {
  member_id: string;
  name: string;
}

export interface CreateBriefInput {
  title: string;
  description: string;
  format: BriefFormatT;
  priority: BriefPriorityT;
  /** Persona name — sẽ lookup briefs_persona.name; default "AI for Founder" */
  persona_name: string;
  reference_links: BriefReferenceLink[];
  attachments: BriefAttachment[];
  deadline: string | null;
}

/** Tạo display_id ngắn dạng "brief_<base36 timestamp>" — readable, unique đủ dùng */
function generateDisplayId(): string {
  return `brief_${Date.now().toString(36)}`;
}

export async function createBrief(
  input: CreateBriefInput,
  actor: ActorInfo
): Promise<Brief> {
  // Bước 1: lookup persona_id theo name. Persona phải đã seed sẵn.
  const personaResult = await db.query<{ id: string }>(
    `SELECT id FROM briefs_persona WHERE name = $1 LIMIT 1`,
    [input.persona_name]
  );
  const personaRow = personaResult.rows[0];
  if (!personaRow) {
    throw new Error(`Persona "${input.persona_name}" không tồn tại — chạy seed trước`);
  }

  // Bước 2: INSERT brief với RETURNING id để JOIN persona ở query 3
  const insertResult = await db.query<{ id: string }>(
    `INSERT INTO briefs (
       display_id, title, description, status, format, priority,
       persona_id, source, reference_links, attachments, deadline,
       created_by_member_id
     ) VALUES (
       $1, $2, $3, 'mine', $4, $5,
       $6, 'Manual brief', $7::jsonb, $8::jsonb, $9, $10
     )
     RETURNING id`,
    [
      generateDisplayId(),
      input.title,
      input.description,
      input.format,
      input.priority,
      personaRow.id,
      JSON.stringify(input.reference_links),
      JSON.stringify(input.attachments),
      input.deadline,
      actor.member_id,
    ]
  );
  const newId = insertResult.rows[0]?.id;
  if (!newId) throw new Error('INSERT failed — không có id trả về');

  // Bước 3: log activity
  await logActivity({
    brief_id: newId,
    action: 'created',
    actor_member_id: actor.member_id,
    actor_name: actor.name,
    to_status: 'mine',
  });

  // Bước 4: SELECT lại với JOIN để có data đầy đủ (persona name + dot_color)
  const fullResult = await db.query<BriefRow>(
    `${BRIEF_SELECT_SQL} WHERE b.id = $1`,
    [newId]
  );
  const fullRow = fullResult.rows[0];
  if (!fullRow) throw new Error('SELECT after INSERT trả về 0 rows');
  return mapBriefRow(fullRow);
}

/** Update status — return brief đã update; null nếu id không tồn tại */
export async function updateBriefStatus(
  id: string,
  status: BriefStatusT,
  actor: ActorInfo
): Promise<Brief | null> {
  // Get from_status để log
  const currentResult = await db.query<{ status: BriefStatusT }>(
    `SELECT status FROM briefs WHERE id = $1`,
    [id]
  );
  const currentRow = currentResult.rows[0];
  if (!currentRow) return null;
  const fromStatus = currentRow.status;

  await db.query(`UPDATE briefs SET status = $1 WHERE id = $2`, [status, id]);

  await logActivity({
    brief_id: id,
    action: 'status_changed',
    actor_member_id: actor.member_id,
    actor_name: actor.name,
    from_status: fromStatus,
    to_status: status,
  });

  const fullResult = await db.query<BriefRow>(
    `${BRIEF_SELECT_SQL} WHERE b.id = $1`,
    [id]
  );
  const fullRow = fullResult.rows[0];
  return fullRow ? mapBriefRow(fullRow) : null;
}

/** Update content fields — title, description, format, priority, deadline, links.
 *  Không update status (dùng updateBriefStatus). Không update rich content
 *  (core_message, deconstruct, ...) — đó là Spy Room job. */
export interface UpdateBriefContentInput {
  title: string;
  description: string;
  format: BriefFormatT;
  priority: BriefPriorityT;
  reference_links: BriefReferenceLink[];
  attachments: BriefAttachment[];
  deadline: string | null;
}

/** Update draft content — phần writer viết bài.
 *  Khác với updateBriefContent (sửa metadata brief). */
export async function updateBriefDraftContent(
  id: string,
  draftContent: string,
  actor: ActorInfo
): Promise<Brief | null> {
  const updateResult = await db.query<{ id: string }>(
    `UPDATE briefs SET draft_content = $1 WHERE id = $2 RETURNING id`,
    [draftContent, id]
  );
  if (updateResult.rows.length === 0) return null;

  await logActivity({
    brief_id: id,
    action: 'content_edited',
    actor_member_id: actor.member_id,
    actor_name: actor.name,
    detail: `Sửa nội dung bài viết (${draftContent.length} ký tự)`,
  });

  const fullResult = await db.query<BriefRow>(
    `${BRIEF_SELECT_SQL} WHERE b.id = $1`,
    [id]
  );
  const fullRow = fullResult.rows[0];
  return fullRow ? mapBriefRow(fullRow) : null;
}

export async function updateBriefContent(
  id: string,
  input: UpdateBriefContentInput,
  actor: ActorInfo
): Promise<Brief | null> {
  const updateResult = await db.query<{ id: string }>(
    `UPDATE briefs SET
       title = $1,
       description = $2,
       format = $3,
       priority = $4,
       reference_links = $5::jsonb,
       attachments = $6::jsonb,
       deadline = $7
     WHERE id = $8
     RETURNING id`,
    [
      input.title,
      input.description,
      input.format,
      input.priority,
      JSON.stringify(input.reference_links),
      JSON.stringify(input.attachments),
      input.deadline,
      id,
    ]
  );
  if (updateResult.rows.length === 0) return null;

  await logActivity({
    brief_id: id,
    action: 'content_edited',
    actor_member_id: actor.member_id,
    actor_name: actor.name,
    detail: `Cập nhật: ${input.title}`,
  });

  const fullResult = await db.query<BriefRow>(
    `${BRIEF_SELECT_SQL} WHERE b.id = $1`,
    [id]
  );
  const fullRow = fullResult.rows[0];
  return fullRow ? mapBriefRow(fullRow) : null;
}
