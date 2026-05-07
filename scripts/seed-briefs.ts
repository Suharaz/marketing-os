/**
 * seed-briefs.ts
 * Populate bảng briefs + briefs_persona với data mẫu.
 * Run: npx tsx scripts/seed-briefs.ts
 *
 * Số lượng (match UI mockup): 5 mine, 3 draft, 12 submitted, 47 published, 2 revision.
 * Idempotent — xoá hết briefs cũ rồi insert lại để chạy nhiều lần được.
 *
 * NOTE: Persona chia 2 — "AI for Founder" (rose) và "Solopreneur" (amber).
 * Brief đầu tiên có full rich content (core_message, deconstruct, persona_tone, ...)
 * để demo detail view; những brief còn lại chỉ có metadata cơ bản.
 */

import 'dotenv/config';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

// ─── Date helpers ───────────────────────────────────────────────────────────────
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
function todayAt(hour: number): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
}

// Tất cả format hợp lệ — match enum brief_format_t trong migration
type BriefFormat =
  | 'tiktok' | 'fb_reels' | 'fb_post' | 'yt_shorts' | 'yt_long'
  | 'threads' | 'instagram_post' | 'instagram_reels';

// Subset dùng cho cycle khi gen submitted/published — không cần đủ tất cả
const FORMATS_CYCLE: BriefFormat[] = [
  'tiktok', 'fb_reels', 'fb_post', 'yt_shorts', 'threads',
];
const PRIORITIES = ['high', 'medium', 'low'] as const;

// ─── Lookup admin user — set created_by + log activity ─────────────────────────
async function getAdminUser(): Promise<{ id: string; name: string }> {
  const r = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM team_member WHERE role = 'admin' ORDER BY created_at LIMIT 1`
  );
  const row = r.rows[0];
  if (!row) {
    throw new Error('No admin user found — chạy seed-dev-data.ts trước');
  }
  return row;
}

// ─── Personas — UPSERT để chạy lại không bị duplicate ──────────────────────────
async function upsertPersonas(): Promise<{ founderId: string; soloId: string }> {
  const result = await pool.query<{ id: string; name: string }>(
    `INSERT INTO briefs_persona (name, dot_color)
     VALUES ('AI for Founder', 'bg-rose-500'),
            ('Solopreneur', 'bg-amber-500')
     ON CONFLICT (name) DO UPDATE SET dot_color = EXCLUDED.dot_color
     RETURNING id, name`
  );
  const founder = result.rows.find((r) => r.name === 'AI for Founder');
  const solo = result.rows.find((r) => r.name === 'Solopreneur');
  if (!founder || !solo) throw new Error('Persona upsert thiếu row');
  return { founderId: founder.id, soloId: solo.id };
}

// ─── Brief insert helper ────────────────────────────────────────────────────────
interface InsertBriefArgs {
  display_id: string;
  title: string;
  description?: string;
  status: 'mine' | 'draft' | 'submitted' | 'published' | 'revision';
  format: BriefFormat;
  priority: typeof PRIORITIES[number];
  persona_id: string;
  assigned_to?: string | null;
  source?: string;
  core_message?: string | null;
  audience_target?: object | null;
  deconstruct?: object | null;
  persona_tone?: string | null;
  proof_points?: string[];
  rules?: string[];
  reference_links?: object[];
  attachments?: object[];
  deadline?: Date | null;
  created_at?: Date;
}

async function insertBrief(b: InsertBriefArgs, admin: { id: string; name: string }) {
  // INSERT brief
  const r = await pool.query<{ id: string }>(
    `INSERT INTO briefs (
       display_id, title, description, status, format, priority, persona_id,
       assigned_to, source, core_message, audience_target, deconstruct,
       persona_tone, proof_points, rules, reference_links, attachments,
       deadline, created_at, created_by_member_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15,$16::jsonb,$17::jsonb,$18,$19,$20)
     RETURNING id`,
    [
      b.display_id, b.title, b.description ?? '', b.status, b.format, b.priority,
      b.persona_id, b.assigned_to ?? null, b.source ?? 'Manual',
      b.core_message ?? null,
      b.audience_target ? JSON.stringify(b.audience_target) : null,
      b.deconstruct ? JSON.stringify(b.deconstruct) : null,
      b.persona_tone ?? null,
      b.proof_points ?? [],
      b.rules ?? [],
      JSON.stringify(b.reference_links ?? []),
      JSON.stringify(b.attachments ?? []),
      b.deadline ?? null,
      b.created_at ?? new Date(),
      admin.id,
    ]
  );

  // Log activity "created" cho seed data — để timeline có entry ban đầu
  const briefId = r.rows[0]?.id;
  if (briefId) {
    await pool.query(
      `INSERT INTO brief_activity (brief_id, action, actor_member_id, actor_name, to_status, created_at)
       VALUES ($1, 'created', $2, $3, $4, $5)`,
      [briefId, admin.id, admin.name, b.status, b.created_at ?? new Date()]
    );
  }
}

// ─── Main seed ──────────────────────────────────────────────────────────────────
async function seed() {
  console.log('[seed-briefs] Looking up admin user...');
  const admin = await getAdminUser();

  console.log('[seed-briefs] Truncating briefs table...');
  await pool.query('TRUNCATE TABLE briefs CASCADE');

  console.log('[seed-briefs] Upserting personas...');
  const { founderId, soloId } = await upsertPersonas();

  console.log('[seed-briefs] Inserting hero brief (full content)...');
  await insertBrief({
    display_id: 'brief_042_linh_tt',
    title: 'AI Founder 52t vs Cháu 24t — FOMO story cho chủ DN cũ',
    description: 'TikTok story FOMO theo công thức Spy Room.',
    status: 'mine',
    format: 'tiktok',
    priority: 'high',
    persona_id: founderId,
    assigned_to: 'Linh Nguyễn',
    source: 'Tạo tự động từ Spy Room 2h trước',
    deadline: todayAt(18),
    created_at: daysAgo(0),
    core_message:
      'AI không thay thế chủ doanh nghiệp, nó thay thế những chủ DN không biết dùng AI.',
    audience_target: {
      audience: 'Chủ DN 35-55 tuổi, đã có công ty 5-15 năm, chưa adopt AI.',
      emotion_target: 'FOMO + inspiration (không shame, không attack).',
    },
    deconstruct: {
      hook_3s: 'Mở bằng 1 câu chuyện giật mình của nhân vật thứ 3 (không tự kể)',
      structure: 'Hook → Problem setup → Reveal → Insight → Soft CTA',
      emotion_arc: 'Curiosity (0-5s) → FOMO (5-20s) → Hope (20-35s)',
      pacing: 'Fast cut 2-3s/shot, text-on-screen nhấn 3 điểm chính',
      cta: 'Soft: "Save để xem lại" — không đẩy link bio trực tiếp',
    },
    persona_tone:
      'Giọng Linh — chill, relatable, self-deprecating. Dùng first-person "mình". Signature phrase: "thật ra thì...", "mình từng nghĩ...". Tránh: "chuyên gia nói", "theo nghiên cứu".',
    proof_points: [
      'Case anh CEO 52 tuổi, 3 công ty, 200 nhân viên, cà phê với Steve tuần trước',
      'Data: công ty adopt AI sớm tăng 3x so với đối thủ cùng ngành (nguồn: McKinsey)',
      'Khoá AI for Founder khai giảng 15/5 · taki.vn/ai',
    ],
    rules: [
      'Không attack/shame thế hệ 50+ — họ là audience',
      'Không nói "AI sẽ thay thế bạn" — phải là "thay thế người không biết dùng"',
      'CTA mềm — không bán khoá học trực tiếp trong 35s đầu',
      'Giữ độ dài 35-45s, không quá 60s',
    ],
  }, admin);

  // Mine — 4 briefs còn lại
  const restMine: Array<Partial<InsertBriefArgs> & { display_id: string; title: string }> = [
    { display_id: 'brief_043_solo_reels', title: '3 tool AI miễn phí thay được trợ lý 15tr/tháng', format: 'fb_reels', priority: 'medium', persona_id: soloId, assigned_to: 'Mai', deadline: todayAt(12) },
    { display_id: 'brief_044_solo_post', title: 'Case study: Shop mỹ phẩm 2 người giảm 60% chi phí sau 30 ngày', format: 'fb_post', priority: 'medium', persona_id: founderId, deadline: daysFromNow(0) },
    { display_id: 'brief_045_solo_yt', title: 'Tôi tiết kiệm 12 giờ/tuần nhờ 1 prompt ChatGPT', format: 'yt_shorts', priority: 'low', persona_id: soloId, deadline: daysFromNow(1) },
    { display_id: 'brief_046_threads', title: 'Thread 5 post: AI không thay thế bạn, nó thay thế người không dùng AI', format: 'threads', priority: 'low', persona_id: founderId, deadline: daysFromNow(2) },
  ];
  for (const m of restMine) {
    await insertBrief({ ...m, status: 'mine', created_at: daysAgo(0) } as InsertBriefArgs, admin);
  }

  // Drafts (3)
  const drafts: InsertBriefArgs[] = [
    { display_id: 'brief_037', title: 'Bài blog "5 mẹo trang điểm mùa hè không trôi"', status: 'draft', format: 'fb_post', priority: 'medium', persona_id: soloId, deadline: daysFromNow(2) },
    { display_id: 'brief_038', title: 'Caption Facebook campaign Black Friday', status: 'draft', format: 'fb_post', priority: 'high', persona_id: founderId },
    { display_id: 'brief_039', title: 'Script video YouTube "Top 10 laptop dưới 20 triệu"', status: 'draft', format: 'yt_long', priority: 'medium', persona_id: soloId, deadline: daysFromNow(6) },
  ];
  for (const d of drafts) await insertBrief(d, admin);

  // Submitted (12)
  for (let i = 0; i < 12; i++) {
    await insertBrief({
      display_id: `brief_${String(20 + i).padStart(3, '0')}`,
      title: `[Đã submit ${i + 1}] Bài review sản phẩm số ${i + 1}`,
      status: 'submitted',
      format: FORMATS_CYCLE[i % FORMATS_CYCLE.length]!,
      priority: PRIORITIES[i % PRIORITIES.length]!,
      persona_id: i % 2 === 0 ? founderId : soloId,
      created_at: daysAgo(7 + i),
    }, admin);
  }

  // Published (47)
  for (let i = 0; i < 47; i++) {
    await insertBrief({
      display_id: `brief_${String(100 + i).padStart(3, '0')}`,
      title: `[Đã đăng ${i + 1}] Nội dung campaign Q${(i % 4) + 1} 2026`,
      status: 'published',
      format: FORMATS_CYCLE[i % FORMATS_CYCLE.length]!,
      priority: PRIORITIES[i % PRIORITIES.length]!,
      persona_id: i % 3 === 0 ? founderId : soloId,
      created_at: daysAgo(15 + i),
    }, admin);
  }

  // Revisions (2)
  await insertBrief({ display_id: 'brief_018', title: 'Bài review điện thoại Samsung S26 — cần sửa intro', description: 'Reviewer feedback: intro chưa đủ hook.', status: 'revision', format: 'fb_post', priority: 'high', persona_id: founderId, created_at: daysAgo(6) }, admin);
  await insertBrief({ display_id: 'brief_019', title: 'Caption IG son Dior — sửa hashtag', description: 'Hashtag chưa đủ, cần thêm 3 hashtag local.', status: 'revision', format: 'instagram_post', priority: 'medium', persona_id: soloId, created_at: daysAgo(3) }, admin);

  const total = await pool.query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text AS count FROM briefs GROUP BY status ORDER BY status`
  );
  console.log('[seed-briefs] Done. Counts:');
  for (const row of total.rows) console.log(`  ${row.status}: ${row.count}`);
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error('[seed-briefs] FAILED:', err);
    pool.end();
    process.exit(1);
  });
