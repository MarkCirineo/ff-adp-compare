'use client';

// ============================================
// Draft Edge — Main Dashboard
// ============================================

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { APP_CONFIG } from '@/lib/config';
import { computeValueScore, getValueTier, formatValueScore } from '@/lib/scoring';
import { getUserPicks } from '@/lib/draft';
import type { DraftMode } from '@/lib/draft';

// ---- Types ----
interface PlayerRow {
  id: string;
  name: string;
  team: string | null;
  position: string;
  byeWeek: number | null;
  imageUrl: string | null;
  adp: Record<string, number | null>;
  avgAdp: number | null;
  ecr: number | null;
  ranking: Record<string, number | null>;
  avgRanking: number | null;
  posRank: string | null;
  projPts: number | null;
}

type Platform = 'sleeper' | 'espn' | 'yahoo';

type SortKey =
  | 'avgAdp'
  | 'name'
  | 'position'
  | 'platformAdp'
  | 'sleeperAdp'
  | 'espnAdp'
  | 'yahooAdp'
  | 'ecr'
  | 'value'
  | 'projPts'
  | 'bye';

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const;

const PLATFORM_META: Record<Platform, { label: string; icon: string; color: string }> = {
  sleeper: { label: 'Sleeper', icon: '🟢', color: '#3dd8a0' },
  espn:    { label: 'ESPN',    icon: '🔴', color: '#ff4545' },
  yahoo:   { label: 'Yahoo',   icon: '🟣', color: '#7c5cfc' },
};

// ---- LocalStorage persistence key ----
const SETTINGS_KEY = 'draft-edge-settings';

interface PersistedSettings {
  platform: Platform;
  scoring: 'std' | 'half_ppr' | 'ppr';
  leagueSize: number;
  draftPosition: number | null;
  draftMode: DraftMode;
}

function loadSettings(): Partial<PersistedSettings> {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<PersistedSettings>;
  } catch {
    return {};
  }
}

function saveSettings(s: PersistedSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch { /* quota errors, etc. */ }
}

export default function DashboardPage() {
  // ---- State ----
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // League settings
  const [platform, setPlatform] = useState<Platform>('sleeper');
  const [scoring, setScoring] = useState<'std' | 'half_ppr' | 'ppr'>('half_ppr');
  const [leagueSize, setLeagueSize] = useState(12);
  const [draftPosition, setDraftPosition] = useState<number | null>(null);
  const [draftMode, setDraftMode] = useState<DraftMode>('snake');

  // Guard: don't persist until we've hydrated from localStorage
  const [hydrated, setHydrated] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState<string>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('avgAdp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const tableScrollRef = useRef<HTMLDivElement>(null);

  // ---- Hydrate settings from localStorage on mount ----
  useEffect(() => {
    const saved = loadSettings();
    if (saved.platform) setPlatform(saved.platform);
    if (saved.scoring) setScoring(saved.scoring);
    if (saved.leagueSize) setLeagueSize(saved.leagueSize);
    if (saved.draftPosition !== undefined) setDraftPosition(saved.draftPosition);
    if (saved.draftMode) setDraftMode(saved.draftMode);
    // Ensure pick doesn't exceed league size
    if (
      saved.draftPosition !== null &&
      saved.draftPosition !== undefined &&
      saved.leagueSize &&
      saved.draftPosition > saved.leagueSize
    ) {
      setDraftPosition(null);
    }
    setHydrated(true);
  }, []);

  // ---- Persist settings to localStorage on change ----
  useEffect(() => {
    if (!hydrated) return;
    saveSettings({ platform, scoring, leagueSize, draftPosition, draftMode });
  }, [hydrated, platform, scoring, leagueSize, draftPosition, draftMode]);

  // ---- Data Fetch ----
  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/players?scoring=${scoring}&format=redraft`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPlayers(data.players || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [scoring]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // ---- Draft Picks (only when pick position is set) ----
  const userPicks = useMemo(
    () => draftPosition !== null ? getUserPicks(leagueSize, draftPosition, 18, draftMode) : [],
    [leagueSize, draftPosition, draftMode]
  );

  // Pre-compute a Set of user pick overall numbers for O(1) lookup in rows
  const userPickSet = useMemo(
    () => new Set(userPicks.map((p) => p.pick)),
    [userPicks]
  );

  // ---- Helper: get platform-specific ADP ----
  const getPlatformAdp = useCallback((player: PlayerRow): number | null => {
    // For Yahoo, we use ranking since they don't provide traditional ADP
    if (platform === 'yahoo') {
      return player.adp.yahoo ?? player.ranking.yahoo ?? null;
    }
    return player.adp[platform] ?? null;
  }, [platform]);

  // ---- Computed Players (with value scores) ----
  const computedPlayers = useMemo(() => {
    return players.map((p, idx) => {
      const platformAdp = getPlatformAdp(p);
      const rank = p.ecr;

      // Only compute value if both platform ADP and ECR exist AND both are within
      // the draftable range (first 15 rounds = standard draft length).
      const draftableLimit = leagueSize * 15;
      const valueScore =
        platformAdp !== null && rank !== null && platformAdp <= draftableLimit && rank <= draftableLimit
          ? computeValueScore(platformAdp, rank)
          : null;

      return {
        ...p,
        platformAdp,
        valueScore,
        displayRank: idx + 1,
      };
    });
  }, [players, leagueSize, getPlatformAdp]);

  // ---- Filtered & Sorted ----
  const filteredPlayers = useMemo(() => {
    let result = computedPlayers;

    // Position filter
    if (posFilter !== 'ALL') {
      result = result.filter((p) => p.position === posFilter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.team && p.team.toLowerCase().includes(q))
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal: number | string | null = null;
      let bVal: number | string | null = null;

      switch (sortKey) {
        case 'avgAdp':
          aVal = a.avgAdp;
          bVal = b.avgAdp;
          break;
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'position':
          aVal = a.position;
          bVal = b.position;
          break;
        case 'platformAdp':
          aVal = a.platformAdp;
          bVal = b.platformAdp;
          break;
        case 'sleeperAdp':
          aVal = a.adp.sleeper;
          bVal = b.adp.sleeper;
          break;
        case 'espnAdp':
          aVal = a.adp.espn;
          bVal = b.adp.espn;
          break;
        case 'yahooAdp':
          aVal = a.adp.yahoo;
          bVal = b.adp.yahoo;
          break;
        case 'ecr':
          aVal = a.ecr;
          bVal = b.ecr;
          break;
        case 'value':
          aVal = a.valueScore;
          bVal = b.valueScore;
          break;
        case 'projPts':
          aVal = a.projPts;
          bVal = b.projPts;
          break;
        case 'bye':
          aVal = a.byeWeek;
          bVal = b.byeWeek;
          break;
      }

      // Nulls last
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const numA = aVal as number;
      const numB = bVal as number;
      return sortDir === 'asc' ? numA - numB : numB - numA;
    });

    return result;
  }, [computedPlayers, posFilter, search, sortKey, sortDir]);

  // ---- Sort Handler ----
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'value' || key === 'projPts' ? 'desc' : 'asc');
    }
  };

  const SortHeader = ({ label, sortId, className, title }: { label: string; sortId: SortKey; className?: string; title?: string }) => (
    <th
      className={`${className ?? ''} ${sortKey === sortId ? 'sorted' : ''}`}
      onClick={() => handleSort(sortId)}
      role="columnheader"
      aria-sort={sortKey === sortId ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      title={title}
    >
      {label}
      {sortKey === sortId && (
        <span className="sort-indicator">{sortDir === 'asc' ? '▲' : '▼'}</span>
      )}
    </th>
  );

  // ---- Stats ----
  const stats = useMemo(() => {
    const sources = {
      sleeper: players.filter((p) => p.adp.sleeper !== null).length,
      espn: players.filter((p) => p.adp.espn !== null).length,
      // Yahoo provides rankings (not ADP), so count those
      yahoo: players.filter((p) => p.ranking.yahoo !== null).length,
    };
    return {
      total: players.length,
      sources,
    };
  }, [players]);

  const activePlatformMeta = PLATFORM_META[platform];

  // ---- Render ----
  return (
    <>
      {/* Header */}
      <header className="app-header" role="banner">
        <div className="app-header__logo">
          <div className="app-header__logo-icon">⚡</div>
          {APP_CONFIG.name}
        </div>

        {/* Compact player counts — top right */}
        <div className="header-stats">
          <div className="header-stat" title={`${stats.sources.sleeper} players from Sleeper`}>
            <span className="header-stat__dot header-stat__dot--sleeper" />
            {stats.sources.sleeper}
          </div>
          <div className="header-stat" title={`${stats.sources.espn} players from ESPN`}>
            <span className="header-stat__dot header-stat__dot--espn" />
            {stats.sources.espn}
          </div>
          <div className="header-stat" title={`${stats.sources.yahoo} players from Yahoo`}>
            <span className="header-stat__dot header-stat__dot--yahoo" />
            {stats.sources.yahoo}
          </div>
          <div className="header-stat header-stat--total" title={`${stats.total} total players`}>
            {stats.total} total
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="app-main" role="main">
        {/* Settings Panel — the hero controls */}
        <div className="settings-hero">
          <div className="settings-hero__group settings-hero__group--platform">
            <label className="settings-hero__label">Platform</label>
            <div className="platform-selector" role="radiogroup" aria-label="Select your draft platform">
              {(Object.keys(PLATFORM_META) as Platform[]).map((p) => (
                <button
                  key={p}
                  className={`platform-btn ${platform === p ? 'platform-btn--active' : ''}`}
                  onClick={() => setPlatform(p)}
                  aria-pressed={platform === p}
                  style={{
                    '--platform-color': PLATFORM_META[p].color,
                  } as React.CSSProperties}
                >
                  <span className="platform-btn__icon">{PLATFORM_META[p].icon}</span>
                  <span className="platform-btn__label">{PLATFORM_META[p].label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="settings-hero__divider" />

          <div className="settings-hero__group">
            <label className="settings-hero__label" htmlFor="scoring-select">Scoring</label>
            <select
              id="scoring-select"
              className="select select--hero"
              value={scoring}
              onChange={(e) => setScoring(e.target.value as 'std' | 'half_ppr' | 'ppr')}
            >
              <option value="std">Standard</option>
              <option value="half_ppr">Half PPR</option>
              <option value="ppr">PPR</option>
            </select>
          </div>

          <div className="settings-hero__group">
            <label className="settings-hero__label" htmlFor="league-size">Teams</label>
            <select
              id="league-size"
              className="select select--hero"
              value={leagueSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                setLeagueSize(newSize);
                // Reset draft position if it exceeds new league size
                if (draftPosition !== null && draftPosition > newSize) {
                  setDraftPosition(null);
                }
              }}
            >
              {[8, 10, 12, 14, 16].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div className="settings-hero__group">
            <label className="settings-hero__label" htmlFor="draft-pos">Pick #</label>
            <select
              id="draft-pos"
              className="select select--hero"
              value={draftPosition ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                setDraftPosition(val === '' ? null : Number(val));
              }}
            >
              <option value="">—</option>
              {Array.from({ length: leagueSize }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>#{n}</option>
              ))}
            </select>
          </div>

          <div className="settings-hero__group">
            <label className="settings-hero__label">Draft Mode</label>
            <div className="draft-mode-toggle" role="radiogroup" aria-label="Draft mode">
              <button
                className={`draft-mode-btn ${draftMode === 'snake' ? 'draft-mode-btn--active' : ''}`}
                onClick={() => setDraftMode('snake')}
                aria-pressed={draftMode === 'snake'}
              >
                Snake
              </button>
              <button
                className={`draft-mode-btn ${draftMode === 'linear' ? 'draft-mode-btn--active' : ''}`}
                onClick={() => setDraftMode('linear')}
                aria-pressed={draftMode === 'linear'}
              >
                Linear
              </button>
            </div>
          </div>

          {/* Show next pick info if draft position is set */}
          {draftPosition !== null && userPicks[0] && (
            <>
              <div className="settings-hero__divider" />
              <div className="settings-hero__pick-info">
                <span className="settings-hero__pick-label">Next Pick</span>
                <span className="settings-hero__pick-value">
                  <span className="pick-dot" />
                  #{userPicks[0].pick}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Controls */}
        <div className="controls-bar">
          <input
            id="player-search"
            type="text"
            className="input search-input"
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search players"
          />

          <div className="position-filters" role="group" aria-label="Filter by position">
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                className={`pos-pill pos-pill--${pos.toLowerCase()} ${
                  posFilter === pos ? 'pos-pill--active' : ''
                }`}
                onClick={() => setPosFilter(pos)}
                aria-pressed={posFilter === pos}
              >
                {pos}
              </button>
            ))}
          </div>

          <span className="results-count">
            {filteredPlayers.length} players
          </span>
        </div>

        {/* Table */}
        <div className="table-container">
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner" />
              <span className="loading-text">Loading player data...</span>
            </div>
          ) : error ? (
            <div className="empty-state">
              <div className="empty-state__icon">⚠️</div>
              <div className="empty-state__title">Failed to load</div>
              <div className="empty-state__text">{error}</div>
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">🏈</div>
              <div className="empty-state__title">No players found</div>
              <div className="empty-state__text">
                {players.length === 0
                  ? 'Run "yarn sync" to fetch player data.'
                  : 'Try adjusting your filters.'}
              </div>
            </div>
          ) : (
            <div className="table-scroll" ref={tableScrollRef}>
              <table className="player-table" role="grid">
                <thead>
                  <tr>
                    <th className="col-rank" style={{ cursor: 'default' }}>#</th>
                    <SortHeader label="Player" sortId="name" className="col-player" />
                    <SortHeader label="Pos" sortId="position" className="col-pos" />
                    <SortHeader
                      label={platform === 'yahoo' ? 'Yahoo Rank' : `${activePlatformMeta.label} ADP`}
                      sortId="platformAdp"
                      className="col-adp col-adp--platform"
                      title={platform === 'yahoo'
                        ? 'Yahoo preseason rank — used for value calculation'
                        : `${activePlatformMeta.label} ADP — used for value calculation`}
                    />
                    <SortHeader label="ECR" sortId="ecr" className="col-adp" title="FantasyPros Expert Consensus Ranking — changes with scoring format" />
                    <SortHeader label="Value" sortId="value" className="col-value" title={`Value = ${platform === 'yahoo' ? 'Yahoo Rank' : `${activePlatformMeta.label} ADP`} vs ECR. Positive = steal, Negative = reach`} />
                    <SortHeader label="Avg ADP" sortId="avgAdp" className="col-adp" title="Average ADP across all sources" />
                    <SortHeader label="Proj Pts" sortId="projPts" className="col-pts" title="Projected fantasy points for the season" />
                    <SortHeader label="Bye" sortId="bye" className="col-bye" title="Bye week" />
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.map((player, idx) => {
                    // Row-based draft overlay: row index determines round & pick
                    const overallPick = idx + 1;
                    const round = Math.ceil(overallPick / leagueSize);
                    const isEvenRound = round % 2 === 0;

                    // Check if this row position is one of the user's snake/linear picks
                    const isUserPick = draftPosition !== null && userPickSet.has(overallPick);

                    // Value tier
                    const tier = player.valueScore !== null
                      ? getValueTier(player.valueScore)
                      : null;

                    return (
                      <tr
                        key={player.id}
                        className={[
                          isEvenRound ? 'draft-round-band--even' : 'draft-round-band--odd',
                          isUserPick ? 'draft-pick-row draft-pick-row--user' : '',
                        ].join(' ')}
                      >
                        {/* Rank */}
                        <td className="col-rank" style={{ color: 'var(--text-tertiary)' }}>
                          {idx + 1}
                        </td>

                        {/* Player Name */}
                        <td className="col-player">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {player.imageUrl && (
                              <img
                                src={player.imageUrl}
                                alt=""
                                width={28}
                                height={28}
                                style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                              />
                            )}
                            <div>
                              <span className="player-name">{player.name}</span>
                              {player.team && (
                                <span className="player-team">{player.team}</span>
                              )}
                              {isUserPick && (
                                <span className="pick-badge" style={{ marginLeft: 8 }}>
                                  <span className="pick-badge__icon" />
                                  YOUR PICK
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Position */}
                        <td className="col-pos">
                          <span className={`pos-badge pos-badge--${player.position.toLowerCase()}`}>
                            {player.position}
                          </span>
                        </td>

                        {/* Platform ADP — highlighted */}
                        <td className="col-adp col-adp--platform">
                          <span
                            className="adp-cell"
                            style={{
                              fontWeight: 700,
                              color: player.platformAdp !== null ? activePlatformMeta.color : 'var(--text-muted)',
                            }}
                          >
                            {player.platformAdp !== null
                              ? (typeof player.platformAdp === 'number' && platform !== 'yahoo'
                                  ? player.platformAdp.toFixed(1)
                                  : player.platformAdp)
                              : '—'}
                          </span>
                        </td>

                        {/* ECR (FantasyPros Expert Consensus Ranking) */}
                        <td className="col-adp">
                          <span className="adp-cell" style={{ fontWeight: 600, color: 'var(--accent-hover)' }}>
                            {player.ecr ?? '—'}
                          </span>
                          {player.posRank && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                              {player.posRank}
                            </span>
                          )}
                        </td>

                        {/* Value */}
                        <td className="col-value">
                          {tier ? (
                            <span
                              className="value-cell"
                              style={{
                                color: tier.color,
                                background: tier.bgColor,
                              }}
                            >
                              {formatValueScore(player.valueScore)}
                            </span>
                          ) : (
                            <span className="adp-cell adp-cell--empty">—</span>
                          )}
                        </td>

                        {/* Avg ADP */}
                        <td className="col-adp">
                          <span className="adp-cell" style={{ color: 'var(--text-secondary)' }}>
                            {player.avgAdp?.toFixed(1) ?? '—'}
                          </span>
                        </td>

                        {/* Projected Points */}
                        <td className="col-pts">
                          <span className="adp-cell">
                            {player.projPts?.toFixed(1) ?? '—'}
                          </span>
                        </td>

                        {/* Bye */}
                        <td className="col-bye" style={{ color: 'var(--text-tertiary)' }}>
                          {player.byeWeek ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
