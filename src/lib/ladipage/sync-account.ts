// Single-account Ladipage sync helper — fetches conversion count for one
// social_account and UPSERTs into landing_page_conversion.
//
// Used by:
//   - cron job D (job-ladipage-sync.ts) — loops over all active FB pages
//   - manual sync (run-sync.ts) — single account from /channels/[id] button
//
// Centralised here so error classification + occurred_date computation +
// upsert logic live in exactly one place.

import { fetchLadipageCount } from './api-client';
import { upsertLandingPageConversion } from './upsert-conversion';
import { LadipageError } from './types';

const TZ = 'Asia/Ho_Chi_Minh';

/**
 * Today's date in Asia/Ho_Chi_Minh as 'YYYY-MM-DD'.
 *
 * The DB container runs UTC, so Postgres CURRENT_DATE rolls over at 07:00 VN.
 * Compute the local calendar date in app code so a 23:30 VN job stays on the
 * intended day, and a manual click at 23:55 VN still writes "today".
 */
export function todayInVn(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date()); // 'YYYY-MM-DD'
}

export type LadipageSyncStatus = 'upserted' | 'no_data' | 'failed';

export interface LadipageSyncResult {
  status: LadipageSyncStatus;
  count?: number;
  /** Human-readable reason when status is 'no_data' or 'failed'. */
  reason?: string;
}

/**
 * Sync conversion count for one FB account.
 *
 * Never throws — always resolves with a status so callers (cron loop, manual
 * sync) can decide how to react without try/catch boilerplate. Critical errors
 * are still logged via console.error inside the helper.
 *
 * @param accountId    social_account.id (UUID)
 * @param externalId   social_account.external_id — used as id_page in webhook body
 * @param occurredDate Optional ISO 'YYYY-MM-DD'; defaults to today in VN
 */
export async function syncLadipageForAccount(
  accountId: string,
  externalId: string,
  occurredDate: string = todayInVn()
): Promise<LadipageSyncResult> {
  try {
    const { count, raw } = await fetchLadipageCount(externalId);

    await upsertLandingPageConversion({
      accountId,
      occurredDate,
      conversionCount: count,
      rawResponse: raw,
    });

    return { status: 'upserted', count };
  } catch (err) {
    if (err instanceof LadipageError) {
      if (err.code === 'NO_DATA') {
        return { status: 'no_data', reason: err.message };
      }
      // AUTH / INVALID_REQUEST / NETWORK / UNKNOWN — caller decides log level
      console.error(
        `[ladipage] FAIL account=${accountId} code=${err.code} msg=${err.message}`
      );
      return { status: 'failed', reason: `${err.code}: ${err.message}` };
    }
    const msg = (err as Error).message ?? String(err);
    console.error(`[ladipage] FAIL account=${accountId} unknown error:`, err);
    return { status: 'failed', reason: msg };
  }
}
