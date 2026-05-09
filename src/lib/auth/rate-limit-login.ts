// In-memory rate limiter for login attempts — acceptable for single-admin use.
// State resets on server restart (documented risk, acceptable per phase spec).

interface RateLimitEntry {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number;
}

const WINDOW_MS = 5 * 60 * 1000;   // 5 minutes
const THRESHOLD = 5;                 // max attempts before lockout
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

const store = new Map<string, RateLimitEntry>();

function getEntry(email: string): RateLimitEntry {
  const now = Date.now();
  const entry = store.get(email);

  if (!entry) {
    return { count: 0, firstAttemptAt: now, lockedUntil: 0 };
  }

  // Window expired and not locked — reset
  if (entry.lockedUntil === 0 && now - entry.firstAttemptAt > WINDOW_MS) {
    return { count: 0, firstAttemptAt: now, lockedUntil: 0 };
  }

  // Lockout đã hết hạn → reset count, cho user thử lại từ đầu.
  // Nếu không reset, count cũ vẫn >= THRESHOLD → fail tiếp theo sẽ lock ngay.
  if (entry.lockedUntil > 0 && entry.lockedUntil <= now) {
    return { count: 0, firstAttemptAt: now, lockedUntil: 0 };
  }

  return entry;
}

/**
 * Check whether the email is currently allowed to attempt login.
 * Does NOT mutate state — call recordFailure() on bad attempt.
 */
export function checkRateLimit(
  email: string
): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = getEntry(email);

  if (entry.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }

  return { allowed: true };
}

/**
 * Record a failed login attempt. Triggers lockout after THRESHOLD failures
 * within WINDOW_MS.
 */
export function recordFailure(email: string): void {
  const now = Date.now();
  const entry = getEntry(email);

  entry.count += 1;

  if (entry.count >= THRESHOLD) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }

  store.set(email, entry);
}

/**
 * Clear failure history on successful login.
 */
export function clearFailures(email: string): void {
  store.delete(email);
}
