// ============================================
// Draft Calculator — Snake & Linear
// ============================================

export type DraftMode = 'snake' | 'linear';

export interface DraftPick {
  round: number;
  pick: number;         // overall (1-indexed)
  pickInRound: number;  // within round (1-indexed)
  isUserPick: boolean;
}

/**
 * Generate all picks for a draft (snake or linear).
 * Returns picks up to `totalRounds * leagueSize`.
 */
export function generateSnakeDraft(
  leagueSize: number,
  draftPosition: number,
  totalRounds: number = 18,
  mode: DraftMode = 'snake'
): DraftPick[] {
  const picks: DraftPick[] = [];

  for (let round = 1; round <= totalRounds; round++) {
    for (let slot = 1; slot <= leagueSize; slot++) {
      const pickInRound = mode === 'snake'
        ? (round % 2 === 1 ? slot : leagueSize - slot + 1)
        : slot;
      const overallPick = (round - 1) * leagueSize + slot;

      picks.push({
        round,
        pick: overallPick,
        pickInRound,
        isUserPick: pickInRound === draftPosition,
      });
    }
  }

  return picks;
}

/**
 * Get only the user's picks in a draft.
 * Snake: picks snake back and forth (1→N, N→1, …).
 * Linear: picks are always the same slot each round.
 */
export function getUserPicks(
  leagueSize: number,
  draftPosition: number,
  totalRounds: number = 18,
  mode: DraftMode = 'snake'
): DraftPick[] {
  const userPicks: DraftPick[] = [];

  for (let round = 1; round <= totalRounds; round++) {
    const pickInRound = mode === 'snake'
      ? (round % 2 === 1 ? draftPosition : leagueSize - draftPosition + 1)
      : draftPosition;
    const overallPick = (round - 1) * leagueSize + pickInRound;

    userPicks.push({
      round,
      pick: overallPick,
      pickInRound,
      isUserPick: true,
    });
  }

  return userPicks;
}

/**
 * Determine which round a given ADP falls in.
 */
export function adpToRound(adp: number, leagueSize: number): number {
  return Math.ceil(adp / leagueSize);
}

/**
 * Check if a given overall pick number is the user's pick.
 */
export function isUserPickNumber(
  overallPick: number,
  leagueSize: number,
  draftPosition: number
): boolean {
  const round = Math.ceil(overallPick / leagueSize);
  const pickInRound = round % 2 === 1
    ? ((overallPick - 1) % leagueSize) + 1
    : leagueSize - ((overallPick - 1) % leagueSize);
  return pickInRound === draftPosition;
}
