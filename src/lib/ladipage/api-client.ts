// Ladipage webhook API client.
// Single responsibility: POST to n8n webhook, classify response, return count.
// No retry here — cron orchestrator decides retry policy per error code.
//
// Behaviour verified by curl against the live webhook on 2026-05-08:
//   - Method:  POST only (GET returns 404 "not registered")
//   - Header:  api-key: <key>           (lowercase, exact spelling)
//   - Body:    {"id_page": "<string>"}  (NOT query string)
//   - Success: 200 → {"count": <number>}
//   - 500 + "No item to return was found" → page exists but has no conversions yet
//   - 500 + "Error in workflow"           → request body malformed (missing id_page)

import { LadipageError, type LadipageSuccessResponse } from './types';

// Webhook n8n typically responds in 10-14s per page (it queries FB Graph API
// + Ladipage DB internally). 30s gives ~2× headroom over the worst observed
// case so transient slowness doesn't trip AbortController.
const TIMEOUT_MS = 30_000;

/**
 * Read + validate env vars on demand.
 *
 * NOT at module-load: Next.js build collects route metadata by importing
 * every route's module chain in a build-time sandbox. If we threw here at
 * import time, build would fail whenever LADIPAGE_* aren't present in the
 * build environment (which is normal — secrets are runtime concerns).
 * Throwing inside the function delays the check until the cron job actually
 * runs, where missing config will surface as a clear error in the job log.
 */
function getConfig(): { webhookUrl: string; apiKey: string } {
  const webhookUrl = process.env.LADIPAGE_WEBHOOK_URL;
  const apiKey = process.env.LADIPAGE_API_KEY;
  if (!webhookUrl || !apiKey) {
    throw new Error(
      '[ladipage] LADIPAGE_WEBHOOK_URL and LADIPAGE_API_KEY env vars are required'
    );
  }
  return { webhookUrl, apiKey };
}

/**
 * Fetch conversion count for one page (today only — n8n filters server-side).
 *
 * Returns the raw count plus the unparsed body so callers can persist it for
 * audit (raw_response JSONB column).
 *
 * Throws LadipageError with a classified `code` field — callers should branch
 * on `code` rather than parsing message strings.
 */
export async function fetchLadipageCount(idPage: string): Promise<{
  count: number;
  raw: unknown;
}> {
  const { webhookUrl, apiKey } = getConfig();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        // Lowercase header name verified by curl — n8n auth check is case-sensitive
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ id_page: idPage }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const msg = (err as Error).message ?? String(err);
    throw new LadipageError(
      'NETWORK',
      `Network error fetching id_page=${idPage}: ${msg}`
    );
  }
  clearTimeout(timeoutId);

  // Parse JSON regardless of status — n8n returns error details as JSON body
  const body: unknown = await res.json().catch(() => null);

  if (
    res.status === 200 &&
    body !== null &&
    typeof body === 'object' &&
    typeof (body as LadipageSuccessResponse).count === 'number'
  ) {
    return { count: (body as LadipageSuccessResponse).count, raw: body };
  }

  // Auth errors — key wrong or revoked
  if (res.status === 401 || res.status === 403) {
    throw new LadipageError(
      'AUTH',
      `API key rejected (HTTP ${res.status})`,
      res.status,
      body
    );
  }

  // Classify 500 by message — n8n distinguishes "no data" from "workflow error"
  const errMessage =
    body !== null &&
    typeof body === 'object' &&
    typeof (body as { message?: unknown }).message === 'string'
      ? (body as { message: string }).message
      : '';

  if (res.status === 500 && errMessage === 'No item to return was found') {
    throw new LadipageError(
      'NO_DATA',
      `Page ${idPage} has no Ladipage data yet`,
      res.status,
      body
    );
  }
  if (res.status === 500 && errMessage === 'Error in workflow') {
    throw new LadipageError(
      'INVALID_REQUEST',
      'n8n workflow error (likely missing or wrong-typed id_page)',
      res.status,
      body
    );
  }

  throw new LadipageError(
    'UNKNOWN',
    `Unexpected response from Ladipage webhook: HTTP ${res.status}`,
    res.status,
    body
  );
}
