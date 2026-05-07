// Facebook Graph API HTTP client with retry, timeout, and token-expiry detection.
// All data-fetching calls go through the `fb()` wrapper defined here.

import type { FBApiError, FBPageInsight, FBPagePost, FBPaginatedResponse } from './types';
import { TokenExpiredError } from './types';
import { recordCall, truncateForLog } from '@/lib/sync/call-context';

export const FB_VERSION = 'v25.0';
const GRAPH_BASE = 'https://graph.facebook.com';

/** Error codes that indicate an OAuth token is expired or revoked. */
const TOKEN_EXPIRED_CODES = new Set([190, 102]);

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [1_000, 3_000] as const;

/** Safety cap for cursor-based pagination — total = MAX_PAGES × per-call limit.
 *  10 × 100 = 1000 posts/sync covers any reasonable 30-day window and prevents
 *  runaway loops on malformed paging responses or token-cursor desync. */
const MAX_PAGES = 10;

/** Throttle window between consecutive FB calls (paging hops, sequential
 *  metric probes, pipeline stages). Randomised to avoid traffic patterns
 *  that look like a script — FB's anti-abuse heuristics dislike fixed cadence. */
const FB_DELAY_MIN_MS = 3_000;
const FB_DELAY_MAX_MS = 7_000;

/** Sleep a uniformly-random amount in [FB_DELAY_MIN_MS, FB_DELAY_MAX_MS).
 *  Exported so callers (run-sync, cron jobs) can space their pipeline stages
 *  the same way as paging hops do internally. */
export function fbThrottle(): Promise<void> {
  const span = FB_DELAY_MAX_MS - FB_DELAY_MIN_MS;
  return sleep(FB_DELAY_MIN_MS + Math.random() * span);
}

/** Posts field expansion — fetches everything in ONE call per page.
 * Includes metadata + comments/reactions summary + shares + insights expansion.
 * Mirrors the curl spec: post_media_view + post_total_media_view_unique +
 * post_clicks_by_type + post_reactions_by_type_total.
 * On #100 (dead metric), caller falls back to POSTS_FIELDS_MINIMAL.
 * NO whitespace inside the value — Graph API is picky. */
const POSTS_FIELDS_FULL = [
  'id',
  'message',
  'story',
  'created_time',
  'permalink_url',
  'full_picture',
  'attachments{media_type,type,title,description,media,subattachments}',
  'comments.summary(true){id,message,created_time,from}',
  'shares',
  'reactions.summary(true)',
  'insights.metric(post_media_view,post_total_media_view_unique,post_clicks_by_type,post_reactions_by_type_total)',
].join(',');

/** Fallback: posts without insights expansion (used when #100 occurs). */
const POSTS_FIELDS_MINIMAL = [
  'id',
  'message',
  'story',
  'created_time',
  'permalink_url',
  'full_picture',
  'attachments{media_type,type,title,description,media,subattachments}',
  'comments.summary(true)',
  'shares',
  'reactions.summary(true)',
].join(',');

/** Sleep helper for backoff delays. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Core FB Graph API fetch wrapper.
 *
 * - Retries up to 2 times on network errors or HTTP 5xx (exponential backoff: 1s, 3s).
 * - Timeout per attempt: 30s via AbortController.
 * - Throws TokenExpiredError on FB error codes 190 / 102.
 * - Never retries on 4xx responses (caller error, not transient).
 */
export async function fb<T>(
  path: string,
  params: Record<string, string>,
  token: string
): Promise<T> {
  const url = new URL(`${GRAPH_BASE}/${FB_VERSION}${path}`);
  url.searchParams.set('access_token', token);
  for (const [key, val] of Object.entries(params)) {
    url.searchParams.set(key, val);
  }

  let lastError: unknown;
  const startedAt = new Date().toISOString();
  const callStartTs = Date.now();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // attempt index 1 → delay[0]=1s, attempt 2 → delay[1]=3s
      await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 3_000);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(timeoutId);

      // Parse body regardless of status to extract FB error details
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = null;
      }

      // Check for FB-level error in response body (FB often returns 200 with error body)
      const fbError = extractFbError(body);
      if (fbError) {
        recordCall({
          endpoint: path,
          params,
          startedAt,
          durationMs: Date.now() - callStartTs,
          httpStatus: res.status,
          ok: false,
          error: `(#${fbError.code}) ${fbError.message}`,
          responseSample: truncateForLog(body),
        });
        if (TOKEN_EXPIRED_CODES.has(fbError.code)) {
          throw new TokenExpiredError(
            `FB token expired or revoked (code ${fbError.code}): ${fbError.message}`
          );
        }
        throw new Error(`FB API error (code ${fbError.code}) on ${path}: ${fbError.message}`);
      }

      if (!res.ok) {
        if (res.status >= 500) {
          // 5xx — eligible for retry
          lastError = new Error(`FB HTTP ${res.status} on attempt ${attempt + 1}`);
          continue;
        }
        // 4xx — do not retry
        recordCall({
          endpoint: path,
          params,
          startedAt,
          durationMs: Date.now() - callStartTs,
          httpStatus: res.status,
          ok: false,
          error: `HTTP ${res.status}`,
          responseSample: truncateForLog(body),
        });
        throw new Error(`FB HTTP ${res.status}: ${JSON.stringify(body)}`);
      }

      recordCall({
        endpoint: path,
        params,
        startedAt,
        durationMs: Date.now() - callStartTs,
        httpStatus: res.status,
        ok: true,
        responseSample: truncateForLog(body),
      });
      return body as T;
    } catch (err) {
      clearTimeout(timeoutId);

      // Never retry TokenExpiredError — it's a definitive auth failure
      if (err instanceof TokenExpiredError) throw err;

      // AbortError = timeout — retry
      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new Error(`FB request timed out (attempt ${attempt + 1})`);
        continue;
      }

      // Network errors (fetch itself threw) — retry
      if (err instanceof TypeError) {
        lastError = err;
        continue;
      }

      // Any other error (e.g. our own Error throws above) — do not retry
      throw err;
    }
  }

  throw lastError ?? new Error('FB request failed after retries');
}

/** Extract FB error object from a parsed response body if present. */
function extractFbError(body: unknown): FBApiError | null {
  if (
    body !== null &&
    typeof body === 'object' &&
    'error' in body &&
    body.error !== null &&
    typeof body.error === 'object'
  ) {
    const e = body.error as Record<string, unknown>;
    if (typeof e['code'] === 'number') {
      return {
        code: e['code'] as number,
        message: String(e['message'] ?? ''),
        type: String(e['type'] ?? ''),
        error_subcode: typeof e['error_subcode'] === 'number' ? e['error_subcode'] : undefined,
        fbtrace_id: typeof e['fbtrace_id'] === 'string' ? e['fbtrace_id'] : undefined,
      };
    }
  }
  return null;
}

/**
 * Fetch every page of a cursor-paginated FB Graph endpoint.
 *
 * Stops when:
 *  - response has no `paging.next` (no more pages), OR
 *  - response has no `paging.cursors.after` (cursor missing), OR
 *  - response data is empty, OR
 *  - MAX_PAGES safety cap is hit (logged as warning).
 *
 * Each page reuses the same `fb()` wrapper, inheriting retry/timeout/error
 * handling. Cursor is passed via `after` query param — never logs the URL.
 */
async function fetchAllPaginated<T>(
  path: string,
  params: Record<string, string>,
  token: string
): Promise<T[]> {
  const all: T[] = [];
  let after: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    // Random throttle between pages (skip before page 0 — first call has no prior wait)
    if (page > 0) await fbThrottle();

    const callParams = after ? { ...params, after } : params;
    const res = await fb<FBPaginatedResponse<T>>(path, callParams, token);

    if (res.data?.length) all.push(...res.data);

    const nextCursor = res.paging?.cursors?.after;
    const hasNext = !!res.paging?.next;
    if (!hasNext || !nextCursor || !res.data?.length) break;
    after = nextCursor;
  }

  // Hit cap = likely truncated. Surface so we can raise MAX_PAGES if needed.
  if (all.length >= MAX_PAGES * 100) {
    console.warn(
      `[fetchAllPaginated] Hit MAX_PAGES (${MAX_PAGES}) on ${path} — possible truncation`
    );
  }

  return all;
}

/**
 * Fetch recent posts for a page with full field expansion.
 * Auto-paginates via cursor; capped at MAX_PAGES × 100 posts.
 *
 * @param token  Decrypted page access token
 * @param pageId Facebook page ID
 * @param since  Unix timestamp (seconds) — lower bound for post created_time
 * @param until  Unix timestamp (seconds) — upper bound. Defaults to "now".
 */
export async function fetchPagePosts(
  token: string,
  pageId: string,
  since: number,
  until: number = Math.floor(Date.now() / 1000)
): Promise<FBPagePost[]> {
  const baseParams = {
    since: String(since),
    until: String(until),
    limit: '100',
  };

  // Try full field expansion first (1 call returns everything per page)
  try {
    return await fetchAllPaginated<FBPagePost>(
      `/${pageId}/posts`,
      { ...baseParams, fields: POSTS_FIELDS_FULL },
      token
    );
  } catch (err) {
    const msg = (err as Error).message;
    // Fall back ONLY for #100 invalid metric — other errors propagate
    if (!msg.includes('(code 100)') && !msg.includes('(#100)')) throw err;
    console.warn('[fetchPagePosts] insights expansion failed, falling back to metadata-only');
    return await fetchAllPaginated<FBPagePost>(
      `/${pageId}/posts`,
      { ...baseParams, fields: POSTS_FIELDS_MINIMAL },
      token
    );
  }
}

/** Page-level metrics fetched in ONE /insights call.
 *  Mirrors the URL the user dictated:
 *    GET /v25.0/{page-id}/insights?metric=...&period=day
 *  Mapping to DB columns lives in `parse-insights.ts`. */
const PAGE_INSIGHT_METRICS = [
  'page_follows',
  'page_daily_follows_unique',
  'page_media_view',
  'page_total_media_view_unique',
  'page_post_engagements',
  'page_total_actions',
  'page_views_total',
  'page_actions_post_reactions_total',
] as const;

/**
 * Fetch page-level daily insights — followers, reach, engagement, actions, views, reactions.
 * Single endpoint call; replaces the old split between `fetchPageInsights` and
 * `fetchPageFollowersCount` (the latter is gone — `page_follows` covers it).
 *
 * `until` MUST be set explicitly (typically `todayT08:00:00+0000`). FB defaults
 * `until` to "now"; if "now" hasn't crossed the most recent PT-midnight, the
 * latest finalised end_time row gets cut off and the response is short by 1 day.
 *
 * @param token  Decrypted page access token
 * @param pageId Facebook page ID
 * @param since  Unix timestamp (seconds) — start of range
 * @param until  Unix timestamp (seconds) — end of range (today 08:00 UTC)
 */
export async function fetchPageInsights(
  token: string,
  pageId: string,
  since: number,
  until: number
): Promise<FBPageInsight[]> {
  const data = await fb<FBPaginatedResponse<FBPageInsight>>(
    `/${pageId}/insights`,
    {
      metric: PAGE_INSIGHT_METRICS.join(','),
      period: 'day',
      since: String(since),
      until: String(until),
    },
    token
  );

  return data.data ?? [];
}
