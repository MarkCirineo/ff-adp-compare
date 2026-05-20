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
 * Compute value score: positive = undervalued (steal), negative = overvalued (reach).
 * 
 * ADP higher than rank → player going later than expected → VALUE (positive)
 * ADP lower than rank → player going earlier than expected → REACH (negative)
 * 
 * Round multiplier: early-round value discrepancies matter more.
 */
export function computeValueScore(
  adp: number,
  rank: number,
  leagueSize: number
): number {
  const rawDiff = adp - rank;
  const round = Math.ceil(adp / leagueSize);
  const roundMultiplier = 1 + (2 / Math.max(round, 1));
  return parseFloat((rawDiff * roundMultiplier).toFixed(1));
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
  return `${sign}${score.toFixed(1)}`;
}
