// UPSERT helper for landing_page_conversion.
// Idempotent — relies on UNIQUE(account_id, occurred_date) constraint defined
// in migration 015. Safe to run multiple times per day; later runs overwrite
// the earlier snapshot for that (page, day).

import { db } from '@/lib/db';

export interface UpsertLandingPageConversionInput {
  accountId: string;
  /** ISO date string in 'YYYY-MM-DD' format, computed in Asia/Ho_Chi_Minh TZ. */
  occurredDate: string;
  conversionCount: number;
  /** Original webhook response body — stored verbatim for audit/debugging. */
  rawResponse: unknown;
}

export async function upsertLandingPageConversion(
  input: UpsertLandingPageConversionInput
): Promise<void> {
  const { accountId, occurredDate, conversionCount, rawResponse } = input;

  await db.query(
    `INSERT INTO landing_page_conversion
       (account_id, occurred_date, conversion_count, raw_response, synced_at)
     VALUES ($1, $2, $3, $4::jsonb, NOW())
     ON CONFLICT (account_id, occurred_date)
     DO UPDATE SET
       conversion_count = EXCLUDED.conversion_count,
       raw_response     = EXCLUDED.raw_response,
       synced_at        = NOW()`,
    [accountId, occurredDate, conversionCount, JSON.stringify(rawResponse)]
  );
}
