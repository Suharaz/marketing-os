// Time-range options for dashboard widgets.
// All windows EXCLUDE today (today's data is still syncing, incomplete).
// SQL pattern: date >= CURRENT_DATE - $1::int AND date < CURRENT_DATE

export const TIME_RANGE_OPTIONS = [7, 14, 30, 90] as const;
export type TimeRangeDays = (typeof TIME_RANGE_OPTIONS)[number];
export const DEFAULT_RANGE_DAYS: TimeRangeDays = 7;

/** Parse a raw query-string value into a valid TimeRangeDays. Falls back to default on invalid. */
export function parseRangeParam(raw: unknown): TimeRangeDays {
  const n = typeof raw === 'string' ? Number(raw) : NaN;
  return (TIME_RANGE_OPTIONS as readonly number[]).includes(n)
    ? (n as TimeRangeDays)
    : DEFAULT_RANGE_DAYS;
}
