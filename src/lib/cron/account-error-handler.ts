// Per-account error handler used by all cron jobs.
// Isolates one account failure from the rest of the batch.
// TokenExpiredError triggers status update + alert creation.
// All other errors are logged to stderr and skipped.

import { TokenExpiredError } from '@/lib/fb/types';
import { markAccountTokenExpired } from '@/lib/fb/token-expired-handler';

/**
 * Handle an error thrown while processing a single account in a cron job.
 * - TokenExpiredError: marks account as token_expired, creates alert
 * - Any other error: logs to stderr (job continues with next account)
 *
 * Never throws — callers can safely await this and move to the next account.
 */
export async function handleAccountError(
  accountId: string,
  err: unknown
): Promise<void> {
  if (err instanceof TokenExpiredError) {
    console.warn(`[cron] Token expired for account ${accountId} — marking token_expired`);
    try {
      await markAccountTokenExpired(accountId);
    } catch (markErr) {
      console.error(`[cron] Failed to mark token expired for account ${accountId}:`, markErr);
    }
    return;
  }

  const message = err instanceof Error ? err.message : String(err);
  console.error(`[cron] Account ${accountId} sync error: ${message}`);
}
