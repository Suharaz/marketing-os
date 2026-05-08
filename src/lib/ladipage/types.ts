// Ladipage webhook type definitions.
// Separated from the API client so callers can import types without pulling
// in fetch/env-var dependencies (matters for unit tests and edge runtimes).

/** Body shape returned by the n8n webhook on success (HTTP 200). */
export interface LadipageSuccessResponse {
  count: number;
}

/** Body shape returned by the n8n webhook on error (HTTP 500). */
export interface LadipageErrorResponse {
  code?: number;
  message: string;
}

/**
 * Internal classification used by the cron job to decide log level.
 * - NO_DATA:         Page exists in n8n but has no conversions yet → warn + skip
 * - INVALID_REQUEST: Body sent was malformed (missing id_page) → caller bug
 * - AUTH:            401/403 from server → key revoked/wrong → critical
 * - NETWORK:         fetch threw / abort / DNS → transient, retry-able
 * - UNKNOWN:         5xx that does not match a known message → critical
 */
export type LadipageErrorCode =
  | 'NO_DATA'
  | 'INVALID_REQUEST'
  | 'AUTH'
  | 'NETWORK'
  | 'UNKNOWN';

export class LadipageError extends Error {
  public readonly code: LadipageErrorCode;
  public readonly httpStatus?: number;
  public readonly rawBody?: unknown;

  constructor(
    code: LadipageErrorCode,
    message: string,
    httpStatus?: number,
    rawBody?: unknown
  ) {
    super(message);
    this.name = 'LadipageError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.rawBody = rawBody;
  }
}
