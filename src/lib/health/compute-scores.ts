// Pure functions for computing channel health sub-scores and final health score.
// All scores are in range 0-100. No DB access — easy to unit test.
//
// Formula weights: health = 0.4×er + 0.3×consistency + 0.2×growth + 0.1×reach

/** Clamp a number to [min, max] inclusive. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * ER score from last-30d average engagement_rate (0..1 decimal from DB GENERATED column).
 * Assumes 10% ER (0.10) = perfect score 100.
 * Formula: avg(er) × 1000, capped at 100.
 */
export function erScore(avgEngagementRate: number): number {
  return clamp(avgEngagementRate * 1000, 0, 100);
}

/**
 * Consistency score based on post count in the last 7 days.
 * Target default is 7 posts/week (1/day). Linear scale up to target = 100.
 */
export function consistencyScore(postsLast7d: number, target = 7): number {
  if (target <= 0) return 0;
  return clamp((postsLast7d / target) * 100, 0, 100);
}

/**
 * Growth score based on follower change over last 7 days.
 * Formula: (today - prev) / prev × 100 + 50, clamped 0-100.
 * Neutral (no change) → 50. If prev=0 → 50 (cannot compute, neutral).
 */
export function growthScore(followersToday: number, followers7dAgo: number): number {
  if (followers7dAgo <= 0) return 50;
  const pctChange = ((followersToday - followers7dAgo) / followers7dAgo) * 100;
  return clamp(pctChange + 50, 0, 100);
}

/**
 * Reach score based on average daily reach over last 30 days.
 * Target default is 10,000 reach/day = perfect score 100. Linear.
 */
export function reachScore(avgReach: number, target = 10_000): number {
  if (target <= 0) return 0;
  return clamp((avgReach / target) * 100, 0, 100);
}

export interface HealthInputScores {
  er: number;
  consistency: number;
  growth: number;
  reach: number;
}

/**
 * Compute final health score from 4 sub-scores (each 0-100).
 * Weights: 0.4 ER + 0.3 consistency + 0.2 growth + 0.1 reach.
 * Result rounded to 2 decimal places.
 */
export function computeHealthScore({ er, consistency, growth, reach }: HealthInputScores): number {
  const raw = 0.4 * er + 0.3 * consistency + 0.2 * growth + 0.1 * reach;
  return Math.round(raw * 100) / 100;
}
