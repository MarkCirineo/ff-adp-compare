import type { ValueTier, Position } from './types.js';

// ============================================
// ADP Scout — Constants
// ============================================

/** All fantasy-relevant positions */
export const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

/** Value tier color mapping (negative = reach, positive = value) */
export const VALUE_TIERS: ValueTier[] = [
  { max: -8,       color: '#B91C1C', label: 'Major Reach' },
  { max: -3,       color: '#EA580C', label: 'Reach' },
  { max: 3,        color: '#737373', label: 'Fair Value' },
  { max: 8,        color: '#16A34A', label: 'Value' },
  { max: Infinity,  color: '#15803D', label: 'Major Steal' },
];

/** Position badge colors */
export const POSITION_COLORS: Record<Position, string> = {
  QB:  '#DC2626',
  RB:  '#2563EB',
  WR:  '#059669',
  TE:  '#D97706',
  K:   '#7C3AED',
  DEF: '#6B7280',
};

/** ESPN team ID → abbreviation */
export const ESPN_TEAM_MAP: Record<number, string> = {
  1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE',
  6: 'DAL', 7: 'DEN', 8: 'DET', 9: 'GB', 10: 'TEN',
  11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA',
  16: 'MIN', 17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ',
  21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC', 25: 'SF',
  26: 'SEA', 27: 'TB', 28: 'WAS', 29: 'CAR', 30: 'JAX',
  33: 'BAL', 34: 'HOU',
};

/** ESPN position ID → position */
export const ESPN_POSITION_MAP: Record<number, string> = {
  1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'DEF',
};

/** Default league settings */
export const DEFAULT_LEAGUE: {
  leagueSize: number;
  draftPosition: number;
  scoring: 'half_ppr';
  format: 'redraft';
  roster: '1qb';
} = {
  leagueSize: 12,
  draftPosition: 1,
  scoring: 'half_ppr',
  format: 'redraft',
  roster: '1qb',
};
