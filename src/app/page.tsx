'use client';

// ============================================
// Draft Edge — Main Dashboard
// ============================================

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { APP_CONFIG } from '@/lib/config';
import { computeValueScore, getValueTier, formatValueScore } from '@/lib/scoring';
import { getUserPicks, adpToRound } from '@/lib/draft';

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

type SortKey =
  | 'avgAdp'
  | 'name'
  | 'position'
  | 'sleeperAdp'
  | 'espnAdp'
  | 'yahooAdp'
  | 'ecr'
  | 'value'
  | 'projPts'
  | 'bye';

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const;

export default function DashboardPage() {
  // ---- State ----
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // League settings
  const [leagueSize, setLeagueSize] = useState(12);
  const [draftPosition, setDraftPosition] = useState(1);
  const [scoring, setScoring] = useState<'std' | 'half_ppr' | 'ppr'>('half_ppr');

  // Filters
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState<string>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('avgAdp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const tableScrollRef = useRef<HTMLDivElement>(null);

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

  // ---- Draft Picks ----
  const userPicks = useMemo(
    () => getUserPicks(leagueSize, draftPosition),
    [leagueSize, draftPosition]
  );

  const userPickSet = useMemo(
    () => new Set(userPicks.map((p) => p.pick)),
    [userPicks]
  );

  // ---- Computed Players (with value scores) ----
  const computedPlayers = useMemo(() => {
    return players.map((p, idx) => {
      const adp = p.avgAdp;
      // Use FantasyPros ECR as primary ranking (the whole point of the app)
      const rank = p.ecr;
      const valueScore =
        adp !== null && rank !== null
          ? computeValueScore(adp, rank, leagueSize)
          : null;

      return {
        ...p,
        valueScore,
        displayRank: idx + 1,
      };
    });
  }, [players, leagueSize]);

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

  const SortHeader = ({ label, sortId, className }: { label: string; sortId: SortKey; className?: string }) => (
    <th
      className={`${className ?? ''} ${sortKey === sortId ? 'sorted' : ''}`}
      onClick={() => handleSort(sortId)}
      role="columnheader"
      aria-sort={sortKey === sortId ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {label}
      {sortKey === sortId && (
        <span className="sort-indicator">{sortDir === 'asc' ? '▲' : '▼'}</span>
      )}
    </th>
  );

  // ---- Stats ----
  const stats = useMemo(() => {
    const withAdp = players.filter((p) => p.avgAdp !== null);
    const sources = {
      sleeper: players.filter((p) => p.adp.sleeper !== null).length,
      espn: players.filter((p) => p.adp.espn !== null).length,
      yahoo: players.filter((p) => p.adp.yahoo !== null).length,
    };
    return {
      total: players.length,
      withAdp: withAdp.length,
      sources,
    };
  }, [players]);

  // ---- Render ----
  return (
    <>
      {/* Header */}
      <header className="app-header" role="banner">
        <div className="app-header__logo">
          <div className="app-header__logo-icon">⚡</div>
          {APP_CONFIG.name}
        </div>

        <div className="controls-bar" style={{ marginLeft: 'auto' }}>
          <div className="control-group">
            <label className="control-label" htmlFor="scoring-select">Scoring</label>
            <select
              id="scoring-select"
              className="select"
              value={scoring}
              onChange={(e) => setScoring(e.target.value as 'std' | 'half_ppr' | 'ppr')}
            >
              <option value="std">Standard</option>
              <option value="half_ppr">Half PPR</option>
              <option value="ppr">PPR</option>
            </select>
          </div>

          <div className="control-group">
            <label className="control-label" htmlFor="league-size">Teams</label>
            <select
              id="league-size"
              className="select"
              value={leagueSize}
              onChange={(e) => setLeagueSize(Number(e.target.value))}
            >
              {[8, 10, 12, 14, 16].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label className="control-label" htmlFor="draft-pos">Pick</label>
            <select
              id="draft-pos"
              className="select"
              value={draftPosition}
              onChange={(e) => setDraftPosition(Number(e.target.value))}
            >
              {Array.from({ length: leagueSize }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>#{n}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="app-main" role="main">
        {/* Stats Bar */}
        <div className="stats-bar">
          <div className="stat-card">
            <span className="stat-card__label">Players</span>
            <span className="stat-card__value">{stats.total}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Sleeper</span>
            <span className="stat-card__value">{stats.sources.sleeper}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">ESPN</span>
            <span className="stat-card__value">{stats.sources.espn}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Yahoo</span>
            <span className="stat-card__value">{stats.sources.yahoo}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Your Next Pick</span>
            <span className="stat-card__value" style={{ color: 'var(--accent-hover)' }}>
              {userPicks[0] ? `#${userPicks[0].pick}` : '—'}
            </span>
          </div>
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

          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
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
                    <SortHeader label="Avg ADP" sortId="avgAdp" className="col-adp" />
                    <SortHeader label="ECR" sortId="ecr" className="col-adp" />
                    <SortHeader label="Sleeper" sortId="sleeperAdp" className="col-adp" />
                    <SortHeader label="ESPN" sortId="espnAdp" className="col-adp" />
                    <SortHeader label="Yahoo" sortId="yahooAdp" className="col-adp" />
                    <SortHeader label="Value" sortId="value" className="col-value" />
                    <SortHeader label="Proj Pts" sortId="projPts" className="col-pts" />
                    <SortHeader label="Bye" sortId="bye" className="col-bye" />
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.map((player, idx) => {
                    // Draft overlay: determine round + user pick
                    const adp = player.avgAdp;
                    const round = adp !== null ? adpToRound(adp, leagueSize) : null;
                    const isEvenRound = round !== null && round % 2 === 0;
                    const pickNum = adp !== null ? Math.round(adp) : null;
                    const isNearUserPick = pickNum !== null && userPickSet.has(pickNum);

                    // Value tier
                    const tier = player.valueScore !== null
                      ? getValueTier(player.valueScore)
                      : null;

                    return (
                      <tr
                        key={player.id}
                        className={[
                          isEvenRound ? 'draft-round-band--even' : 'draft-round-band--odd',
                          isNearUserPick ? 'draft-pick-row draft-pick-row--user' : '',
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
                              {isNearUserPick && (
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

                        {/* Avg ADP */}
                        <td className="col-adp">
                          <span className="adp-cell" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {player.avgAdp?.toFixed(1) ?? '—'}
                          </span>
                        </td>

                        {/* Sleeper ADP */}
                        <td className="col-adp">
                          <span className={`adp-cell ${player.adp.sleeper === null ? 'adp-cell--empty' : ''}`}>
                            {player.adp.sleeper?.toFixed(1) ?? '—'}
                          </span>
                        </td>

                        {/* ESPN ADP */}
                        <td className="col-adp">
                          <span className={`adp-cell ${player.adp.espn === null ? 'adp-cell--empty' : ''}`}>
                            {player.adp.espn?.toFixed(1) ?? '—'}
                          </span>
                        </td>

                        {/* Yahoo ADP */}
                        <td className="col-adp">
                          <span className={`adp-cell ${player.adp.yahoo === null ? 'adp-cell--empty' : ''}`}>
                            {player.adp.yahoo?.toFixed(1) ?? '—'}
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
