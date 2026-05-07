import { z } from 'zod'

export const conversionInput = z.object({
  source_account_id: z.string().uuid(),
  source_post_id: z.string().uuid().nullable().optional(),
  channel_label: z.string().min(1).max(100),
  conversion_count: z.number().int().min(1),
  revenue_vnd: z.number().int().min(0).max(100_000_000_000),
  occurred_at: z.string().datetime(),
  note: z.string().max(500).nullable().optional(),
})

export type ConversionInput = z.infer<typeof conversionInput>
