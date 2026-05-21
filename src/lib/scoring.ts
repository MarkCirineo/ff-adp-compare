// ============================================
// Value Scoring Engine
// ============================================

export interface ValueTier {
  max: number;
  color: string;
  bgColor: string;
  label: string;
}

export const VALUE_TIERS: ValueTier[] = [
  { max: -8,       color: '#fca5a5', bgColor: 'rgba(220, 38, 38, 0.2)', label: 'Major Reach' },
  { max: -3,       color: '#fdba74', bgColor: 'rgba(234, 88, 12, 0.15)', label: 'Reach' },
  { max: 3,        color: '#a3a3a3', bgColor: 'rgba(115, 115, 115, 0.1)', label: 'Fair Value' },
  { max: 8,        color: '#86efac', bgColor: 'rgba(22, 163, 74, 0.15)', label: 'Value' },
  { max: Infinity,  color: '#4ade80', bgColor: 'rgba(21, 128, 61, 0.2)', label: 'Major Steal' },
];

/**
 * Compute value score: raw pick difference between platform ADP and expert consensus.
 * 
 * Value = PlatformADP − ECR
 * 
 * Positive → player going later than experts say → STEAL (you can grab them later)
 * Negative → player going earlier than experts say → REACH (platform is overdrafting)
 * 
 * The number directly represents picks of disagreement, e.g. +5 means
 * "this player is going 5 picks later on this platform than experts rank them."
 */
export function computeValueScore(
  adp: number,
  rank: number,
): number {
  return parseFloat((adp - rank).toFixed(1));
}

/**
 * Get the value tier for a given score.
 */
export function getValueTier(score: number): ValueTier {
  return VALUE_TIERS.find((t) => score <= t.max) ?? VALUE_TIERS[VALUE_TIERS.length - 1];
}

/**
 * Format value score for display.
 */
export function formatValueScore(score: number | null): string {
  if (score === null) return '—';
  const sign = score > 0 ? '+' : '';
  // Show as integer when it's a whole number (cleaner for rank-based diffs)
  const formatted = score % 1 === 0 ? score.toFixed(0) : score.toFixed(1);
  return `${sign}${formatted}`;
}
