// In-memory debounce store for manual sync triggers.
// Prevents a single page from being manually synced more than once per window.
// NOTE: In-memory only — resets on server restart. Acceptable for MVP; Phase 05
// cron jobs have their own scheduling guarantees and don't use this store.

const lastTriggeredAt = new Map<string, number>();

const DEFAULT_WINDOW_MS = 60_000; // 60 seconds

export interface DebounceResult {
  allowed: boolean;
  /** Seconds until the account can be synced again. Only set when allowed=false. */
  retryAfterSec?: number;
}

/**
 * Check whether a manual sync for `accountId` is allowed.
 * Records the trigger timestamp if allowed.
 *
 * @param accountId   social_account.id (UUID string)
 * @param windowMs    Debounce window in milliseconds (default 60 000)
 */
export function shouldAllowSync(
  accountId: string,
  windowMs: number = DEFAULT_WINDOW_MS
): DebounceResult {
  const now = Date.now();
  const last = lastTriggeredAt.get(accountId);

  if (last !== undefined) {
    const elapsed = now - last;
    if (elapsed < windowMs) {
      const retryAfterSec = Math.ceil((windowMs - elapsed) / 1_000);
      return { allowed: false, retryAfterSec };
    }
  }

  lastTriggeredAt.set(accountId, now);
  return { allowed: true };
}
