// AsyncLocalStorage-based call tracker — records every FB API call made within
// a sync run. Used to populate api_sync_log.details for the manual sync UI.
//
// Pattern: caller wraps the sync logic in callContext.run(arr, async () => { ... }).
// All fb() calls inside push their entry to arr. Caller persists arr to DB.

import { AsyncLocalStorage } from 'node:async_hooks';

export interface CallEntry {
  endpoint: string;          // e.g. "/123456/insights"
  params: Record<string, string>; // params with access_token redacted
  startedAt: string;         // ISO timestamp
  durationMs: number;
  httpStatus: number;
  ok: boolean;
  error?: string;            // FB error message if any
  responseSample?: unknown;  // truncated raw response (capped to ~2KB)
}

export const callContext = new AsyncLocalStorage<CallEntry[]>();

export function recordCall(entry: CallEntry): void {
  const store = callContext.getStore();
  if (store) store.push(entry);
}

/** Prepare a response value for jsonb storage.
 *  Returns the value as-is so JSONB stores the full structured payload —
 *  you can query nested fields with `details->0->'responseSample'->'data'`.
 *  Cycles / BigInt are still possible Postgres failures; in those rare cases
 *  fall back to a string form so the row insert doesn't crash the whole sync. */
export function truncateForLog(value: unknown): unknown {
  try {
    // Round-trip through JSON to detect cycles / BigInt early. If it succeeds,
    // the original value is safe for pg-node to serialize into jsonb.
    JSON.stringify(value);
    return value;
  } catch {
    return String(value);
  }
}
