// ============================================
// ADP Scout — Shared Types
// ============================================

/** Scoring format */
export type ScoringFormat = 'std' | 'half_ppr' | 'ppr';

/** League format */
export type LeagueFormat = 'redraft' | 'dynasty' | 'keeper';

/** Roster type */
export type RosterType = '1qb' | '2qb' | 'superflex';

/** Fantasy positions */
export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';

/** Data source identifier */
export type DataSource = 'sleeper' | 'yahoo' | 'espn' | 'fantasypros';

/** Sync status */
export type SyncStatus = 'success' | 'error' | 'partial';

// ---- Player ----

export interface PlayerBase {
  id: string;
  name: string;
  normalizedName: string;
  team: string | null;
  position: Position;
  byeWeek: number | null;
  sleeperId: string | null;
  espnId: string | null;
  yahooId: string | null;
}

// ---- ADP ----

export interface AdpEntry {
  source: DataSource;
  adp: number;
  scoring: ScoringFormat;
  season: number;
}

// ---- Ranking ----

export interface RankingEntry {
  source: DataSource;
  rank: number;
  posRank: string | null;
  scoring: ScoringFormat;
  season: number;
}

// ---- Projection ----

export interface ProjectionEntry {
  source: DataSource;
  season: number;
  ptsStd: number | null;
  ptsHalfPpr: number | null;
  ptsPpr: number | null;
  passYd: number | null;
  passTd: number | null;
  rushYd: number | null;
  rushTd: number | null;
  rec: number | null;
  recYd: number | null;
  recTd: number | null;
}

// ---- Composite (for frontend) ----

export interface PlayerRow extends PlayerBase {
  adp: Record<DataSource, number | null>;
  avgAdp: number | null;
  ranking: Record<DataSource, number | null>;
  avgRanking: number | null;
  posRank: string | null;
  projPts: number | null;
  valueScore: number | null;
}

// ---- League Settings ----

export interface LeagueSettings {
  id?: string;
  name: string;
  leagueSize: number;
  draftPosition: number;
  scoring: ScoringFormat;
  format: LeagueFormat;
  roster: RosterType;
}

// ---- Draft ----

export interface DraftPick {
  round: number;
  pick: number;       // overall pick number (1-indexed)
  pickInRound: number; // pick within the round (1-indexed)
  isUserPick: boolean;
}

// ---- Sync ----

export interface SyncResult {
  source: DataSource;
  status: SyncStatus;
  playersFound: number;
  adpRecords: number;
  rankingRecords: number;
  projectionRecords: number;
  errors: string[];
  durationMs: number;
}

// ---- Value Scoring ----

export interface ValueTier {
  max: number;
  color: string;
  label: string;
}
