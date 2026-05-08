// Zod schema for manual revenue entries.
// Single source of truth for both API route validation and form-side typing.

import { z } from 'zod';

export const revenueInputSchema = z.object({
  /** social_account.id — must be an existing UUID. */
  account_id: z.string().uuid('Account ID phải là UUID hợp lệ'),

  /** Amount in VND. Stored as BIGINT — max safe int is enough for any
   *  realistic revenue figure (9_007_199_254_740_991 VND ≈ 9 quadrillion). */
  amount_vnd: z
    .number()
    .int('Số tiền phải là số nguyên (VND không có đơn vị nhỏ hơn)')
    .nonnegative('Số tiền không được âm')
    .max(Number.MAX_SAFE_INTEGER),

  /** ISO 'YYYY-MM-DD'. Form sends date string from <input type="date">. */
  occurred_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải định dạng YYYY-MM-DD'),

  /** Optional free-text note. */
  note: z.string().max(500).nullable().optional(),
});

export type RevenueInput = z.infer<typeof revenueInputSchema>;
