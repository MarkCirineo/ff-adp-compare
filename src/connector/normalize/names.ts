// ============================================
// Name Normalization
// ============================================
// Transforms platform-specific player names into a canonical form
// for cross-platform fuzzy matching.

/**
 * Normalize a player name for matching:
 * - Lowercase
 * - Strip suffixes: Jr., Sr., II, III, IV, V
 * - Remove punctuation: apostrophes, periods, hyphens → space
 * - Collapse whitespace
 *
 * @example
 * normalizeName("Ja'Marr Chase")       → "jamarr chase"
 * normalizeName("De'Von Achane")        → "devon achane"
 * normalizeName("Travis Kelce Jr.")     → "travis kelce"
 * normalizeName("Patrick Mahomes II")   → "patrick mahomes"
 * normalizeName("D.J. Moore")           → "dj moore"
 * normalizeName("Amon-Ra St. Brown")    → "amon ra st brown"
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\.?\b/gi, '')
    .replace(/[.''\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
