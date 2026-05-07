// FB Graph Insights with `period=day` always reports in Pacific Time
// (America/Los_Angeles), regardless of the Page's timezone setting. This
// helper produces a YYYY-MM-DD calendar date in PT for any timestamp,
// handling PDT/PST DST automatically via the Intl API.

const PT_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Convert a Date or ISO timestamp string into the PT calendar date (YYYY-MM-DD).
 *
 * Handles two callers:
 * - FB Insights `end_time`: PT-midnight marking the END of a report day.
 *   Caller must pass `endTimeMinusOneMs` (or use `ptDateKeyFromEndTime`)
 *   so the moment lands inside the report day, not on the boundary.
 * - Post `created_time` or `new Date()`: any moment in time → its PT date.
 */
export function toPtDateKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  // en-CA locale formats as "YYYY-MM-DD" — perfect for DB date column.
  return PT_FORMATTER.format(date);
}

/**
 * Convert FB Insights `end_time` (PT-midnight string) into the PT date of
 * the report day it represents. Subtracts 1ms to land inside the day before
 * formatting — without this, the boundary moment maps to the next PT date.
 */
export function ptDateKeyFromEndTime(endTime: string): string {
  return toPtDateKey(new Date(new Date(endTime).getTime() - 1));
}

/**
 * Compute Unix timestamp (seconds) for `todayT08:00:00+0000`.
 *
 * Used as `until` parameter on every FB Graph request. Setting this explicitly
 * (instead of letting FB default to "now") ensures the request window covers
 * past the most recent PT-midnight boundary, so FB returns the latest finalised
 * daily insight row instead of cutting it off at the current moment.
 *
 * 08:00 UTC = midnight PST (winter) or 01:00 PDT (summer). Picking 08:00
 * covers both DST cases — FB has had its full PT-day rollover regardless of
 * which timezone offset is active.
 */
export function getTodayUntilUtcSec(): number {
  const d = new Date();
  d.setUTCHours(8, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}
