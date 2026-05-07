import { db } from '@/lib/db'
import type { ConversionInput } from '@/lib/validation/conversion-schema'

export interface ConversionRow {
  id: string
  source_account_id: string | null
  source_post_id: string | null
  channel_label: string
  conversion_count: number
  revenue_vnd: number
  currency: string
  occurred_at: string
  note: string | null
  created_by: string
  created_at: string
  account_name: string | null
  platform: string | null
  post_content: string | null
  post_permalink: string | null
  created_by_name: string | null
}

export interface PostOption {
  id: string
  content: string | null
  published_at: string | null
}

export async function fetchRecentConversions(limit = 50): Promise<ConversionRow[]> {
  const res = await db.query<ConversionRow>(
    `SELECT
       mc.id, mc.source_account_id, mc.source_post_id, mc.channel_label,
       mc.conversion_count, mc.revenue_vnd, mc.currency, mc.occurred_at,
       mc.note, mc.created_by, mc.created_at,
       sa.name  AS account_name,
       sa.platform,
       sp.content AS post_content,
       sp.permalink AS post_permalink,
       tm.name  AS created_by_name
     FROM manual_conversion mc
     LEFT JOIN social_account sa ON sa.id = mc.source_account_id
     LEFT JOIN social_post   sp ON sp.id = mc.source_post_id
     LEFT JOIN team_member   tm ON tm.id = mc.created_by
     ORDER BY mc.occurred_at DESC
     LIMIT $1`,
    [limit]
  )
  return res.rows.map((row) => ({
    ...row,
    conversion_count: Number(row.conversion_count),
    revenue_vnd: Number(row.revenue_vnd),
  }))
}

export async function createConversion(
  input: ConversionInput,
  createdBy: string
): Promise<string> {
  const res = await db.query<{ id: string }>(
    `INSERT INTO manual_conversion
       (source_account_id, source_post_id, channel_label, conversion_count,
        revenue_vnd, occurred_at, note, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      input.source_account_id,
      input.source_post_id ?? null,
      input.channel_label,
      input.conversion_count,
      input.revenue_vnd,
      input.occurred_at,
      input.note ?? null,
      createdBy,
    ]
  )
  const id = res.rows[0]?.id
  if (!id) throw new Error('INSERT returned no id')
  return id
}

export async function deleteConversion(id: string): Promise<void> {
  await db.query('DELETE FROM manual_conversion WHERE id = $1', [id])
}

export async function fetchPostsByAccount(
  accountId: string,
  q?: string
): Promise<PostOption[]> {
  if (q) {
    const res = await db.query<PostOption>(
      `SELECT id, content, published_at
       FROM social_post
       WHERE account_id = $1 AND content ILIKE $2
       ORDER BY published_at DESC
       LIMIT 20`,
      [accountId, `%${q}%`]
    )
    return res.rows
  }
  const res = await db.query<PostOption>(
    `SELECT id, content, published_at
     FROM social_post
     WHERE account_id = $1
     ORDER BY published_at DESC
     LIMIT 20`,
    [accountId]
  )
  return res.rows
}
