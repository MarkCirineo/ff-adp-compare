// ============================================
// ESPN Fantasy API Connector
// ============================================
// Fetches player draft ranks (STD + PPR) and ADP from ESPN's
// public kona_player_info endpoint.
//
// Endpoint: GET https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/
//   seasons/{season}/segments/0/leaguedefaults/3?view=kona_player_info
//
// No auth required. Returns ~1000+ players in a single large payload.

import { PrismaClient } from '@prisma/client';
import { PlayerMatcher } from '../normalize/matcher.js';
import { fetchWithRetry } from '../utils/retry.js';
import { ESPN_TEAM_MAP, ESPN_POSITION_MAP } from '../../lib/constants.js';
import type { SyncResult } from '../../lib/types.js';

interface EspnPlayer {
  id: number;
  fullName: string;
  proTeamId: number;
  defaultPositionId: number;
  injuryStatus?: string;
  seasonOutlook?: string;
  ownership?: {
    averageDraftPosition?: number;
    percentOwned?: number;
    percentStarted?: number;
  };
  draftRanksByRankType?: Record<
    string, // "STANDARD" | "PPR"
    {
      rank: number;
      auctionValue: number;
    }
  >;
  rankings?: Record<
    string, // slot id like "0", "2", "4"
    Array<{
      rank: number;
      rankSourceId: number;
      rankType: string;
    }>
  >;
}

export async function syncEspn(
  prisma: PrismaClient,
  matcher: PlayerMatcher,
  season: number,
  dryRun = false
): Promise<SyncResult> {
  const start = Date.now();
  const errors: string[] = [];
  let rankingRecords = 0;
  let adpRecords = 0;

  console.log('\n  📡 ESPN — Fetching draft ranks & ADP...');

  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leaguedefaults/3?view=kona_player_info`;

  // ESPN sometimes needs a filter header to get all players
  const filterHeader = JSON.stringify({
    players: {
      limit: 1500,
      sortPercOwned: { sortPriority: 1, sortAsc: false },
      filterStatsForTopScoringPeriodIds: {
        value: 2,
        additionalValue: [`00${season}`, `10${season}`],
      },
    },
  });

  const res = await fetchWithRetry(url, {
    headers: {
      'x-fantasy-filter': filterHeader,
      Accept: 'application/json',
    },
  });

  const data = await res.json();
  const players: EspnPlayer[] = (data.players || []).map(
    (entry: any) => entry.player
  );

  console.log(`  → Received ${players.length} players`);

  for (const ep of players) {
    if (!ep || !ep.fullName) continue;

    const team = ESPN_TEAM_MAP[ep.proTeamId] ?? null;
    const position = ESPN_POSITION_MAP[ep.defaultPositionId] ?? null;

    // Skip non-fantasy positions
    if (!position) continue;

    const canonical = matcher.match(ep.fullName, team, position);
    if (!canonical) continue;

    // Update ESPN ID
    if (!dryRun) {
      try {
        await prisma.player.update({
          where: { id: canonical.id },
          data: { espnId: String(ep.id) },
        });
      } catch { /* ignore if already set or unique conflict */ }
    }

    if (dryRun) {
      const stdRank = ep.draftRanksByRankType?.STANDARD?.rank ?? '?';
      const pprRank = ep.draftRanksByRankType?.PPR?.rank ?? '?';
      const adp = ep.ownership?.averageDraftPosition ?? '?';
      console.log(`    ${ep.fullName}: std=${stdRank}, ppr=${pprRank}, adp=${adp}`);
      continue;
    }

    // ---- Upsert Rankings ----
    const rankTypes: Array<{ key: string; scoring: string }> = [
      { key: 'STANDARD', scoring: 'std' },
      { key: 'PPR', scoring: 'ppr' },
    ];

    for (const { key, scoring } of rankTypes) {
      const rankData = ep.draftRanksByRankType?.[key];
      if (!rankData || !rankData.rank) continue;

      try {
        await prisma.ranking.upsert({
          where: {
            playerId_source_format_scoring_season: {
              playerId: canonical.id,
              source: 'espn',
              format: 'redraft',
              scoring,
              season,
            },
          },
          update: { rank: rankData.rank },
          create: {
            playerId: canonical.id,
            source: 'espn',
            rank: rankData.rank,
            format: 'redraft',
            scoring,
            season,
          },
        });
        rankingRecords++;
      } catch (err) {
        errors.push(`ESPN ranking upsert for ${canonical.name} (${scoring}): ${err}`);
      }
    }

    // ---- Upsert ADP ----
    const adpValue = ep.ownership?.averageDraftPosition;
    if (adpValue != null && adpValue > 0) {
      try {
        // ESPN ADP — we store as 'std' scoring since we can't determine format
        // from the ownership endpoint. It likely reflects their default (standard).
        await prisma.adp.upsert({
          where: {
            playerId_source_format_scoring_season: {
              playerId: canonical.id,
              source: 'espn',
              format: 'redraft',
              scoring: 'std', // ESPN default
              season,
            },
          },
          update: { adp: adpValue },
          create: {
            playerId: canonical.id,
            source: 'espn',
            adp: adpValue,
            format: 'redraft',
            scoring: 'std',
            season,
          },
        });
        adpRecords++;
      } catch (err) {
        errors.push(`ESPN ADP upsert for ${canonical.name}: ${err}`);
      }
    }
  }

  const result: SyncResult = {
    source: 'espn',
    status: errors.length === 0 ? 'success' : 'partial',
    playersFound: players.length,
    adpRecords,
    rankingRecords,
    projectionRecords: 0,
    errors,
    durationMs: Date.now() - start,
  };

  console.log(`  ✅ ESPN done: ${rankingRecords} rankings, ${adpRecords} ADP (${result.durationMs}ms)`);
  if (errors.length > 0) console.warn(`  ⚠ ${errors.length} errors`);

  return result;
}
