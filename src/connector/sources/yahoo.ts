// ============================================
// Yahoo Fantasy API Connector
// ============================================
// Fetches player rankings (season ranks, position ranks) and draft
// analysis from Yahoo's public read-only fantasy API.
//
// Primary data: player_ranks (expert rankings — available year-round)
// Secondary: draft_analysis.average_pick (ADP — often empty in offseason)
//
// Paginated: 100 players per request.
// Endpoint: GET https://pub-api-ro.fantasysports.yahoo.com/fantasy/v2/
//   league/{gameKey}.l.public;out=settings/players;position=ALL;
//   start={offset};count=100;sort=rank_season;...?format=json_f

import { PrismaClient } from '@prisma/client';
import { PlayerMatcher } from '../normalize/matcher.js';
import { fetchWithRetry } from '../utils/retry.js';
import type { SyncResult } from '../../lib/types.js';

// Yahoo game key for current NFL season. Updated each year.
// 2024 = 449, 2025 = 460 (approx), 2026 = 470 (approx)
// We'll try to auto-detect but fall back to this.
const DEFAULT_GAME_KEY = '470';

interface YahooPlayer {
  player_key: string;
  player_id: string;
  name: { full: string; first: string; last: string };
  editorial_team_abbr?: string;
  display_position?: string;
  bye_weeks?: { week: string };
  player_ranks?: Array<{
    rank_type: string;
    rank_season: string;
    rank_value: string;
    rank_position?: string;
  }>;
  draft_analysis?: {
    average_pick?: string;
    average_round?: string;
    percent_drafted?: string;
  };
}

/**
 * Attempt to get Yahoo's current NFL game key.
 * Falls back to DEFAULT_GAME_KEY if the API is unreachable.
 */
async function getGameKey(): Promise<string> {
  try {
    // Use the pub-api-ro endpoint which is more reliable
    const res = await fetch(
      'https://pub-api-ro.fantasysports.yahoo.com/fantasy/v2/game/nfl?format=json_f',
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const gameKey = data?.fantasy_content?.game?.game_key;
    if (gameKey) {
      console.log(`  → Yahoo game key detected: ${gameKey}`);
      return String(gameKey);
    }
  } catch (err) {
    console.warn(`  ⚠ Could not auto-detect Yahoo game key: ${err}`);
    console.warn(`  → Using default: ${DEFAULT_GAME_KEY}`);
  }
  return DEFAULT_GAME_KEY;
}

export async function syncYahoo(
  prisma: PrismaClient,
  matcher: PlayerMatcher,
  season: number,
  dryRun = false
): Promise<SyncResult> {
  const start = Date.now();
  const errors: string[] = [];
  let rankingRecords = 0;
  let adpRecords = 0;
  let totalPlayers = 0;

  console.log('\n  📡 Yahoo — Fetching rankings & draft analysis...');

  const gameKey = await getGameKey();
  let offset = 0;
  const pageSize = 100;
  let hasMore = true;

  while (hasMore) {
    const url = `https://pub-api-ro.fantasysports.yahoo.com/fantasy/v2/league/${gameKey}.l.public;out=settings/players;position=ALL;start=${offset};count=${pageSize};sort=rank_season;search=;out=auction_values,ranks;ranks=season;ranks_by_position=season;out=expert_ranks;expert_ranks.rank_type=projected_season_remaining/draft_analysis;cut_types=diamond;slices=last7days?format=json_f`;

    let data: any;
    try {
      const res = await fetchWithRetry(url);
      data = await res.json();
    } catch (err) {
      errors.push(`Yahoo page at offset=${offset} failed: ${err}`);
      break;
    }

    // Navigate Yahoo's nested response structure
    // json_f format returns players as an array of { player: { ... } } objects
    const league = data?.fantasy_content?.league;
    const playersData = league?.players;

    if (!playersData || !Array.isArray(playersData) || playersData.length === 0) {
      console.log(`  → Page offset=${offset}: no players returned`);
      if (offset === 0) {
        // Log response structure for debugging
        const keys = league ? Object.keys(league) : [];
        console.log(`  → League keys: ${keys.join(', ')}`);
        if (playersData) {
          console.log(`  → players type: ${typeof playersData}, isArray: ${Array.isArray(playersData)}`);
          if (typeof playersData === 'object' && !Array.isArray(playersData)) {
            console.log(`  → players keys: ${Object.keys(playersData).join(', ')}`);
          }
        }
      }
      hasMore = false;
      break;
    }

    const playerEntries: YahooPlayer[] = [];
    for (const entry of playersData) {
      const playerObj = entry?.player;
      if (playerObj) {
        const flat = flattenYahooPlayer(playerObj);
        if (flat) playerEntries.push(flat);
      }
    }

    console.log(`  → Page offset=${offset}: ${playerEntries.length} players`);
    totalPlayers += playerEntries.length;

    for (const yp of playerEntries) {
      const canonical = matcher.match(
        yp.name.full,
        yp.editorial_team_abbr,
        yp.display_position
      );

      if (!canonical) {
        continue; // No match in canonical DB
      }

      // Update Yahoo ID on player record
      if (!dryRun && !canonical.sleeperId) {
        // Only update yahooId if not already set
        try {
          await prisma.player.update({
            where: { id: canonical.id },
            data: { yahooId: yp.player_id },
          });
        } catch { /* ignore if already set */ }
      }

      if (dryRun) {
        const rank = yp.player_ranks?.find((r) => r.rank_type === 'S' && r.rank_season === String(season))?.rank_value ?? '?';
        console.log(`    ${yp.name.full}: rank=${rank}`);
        continue;
      }

      // ---- Upsert Rankings ----
      const seasonRank = yp.player_ranks?.find((r) => r.rank_type === 'S' && r.rank_season === String(season));
      if (seasonRank && seasonRank.rank_value && seasonRank.rank_value !== '-') {
        const rankValue = parseInt(seasonRank.rank_value, 10);
        if (!isNaN(rankValue)) {
          // Find position rank
          const posRankEntry = yp.player_ranks?.find(
            (r) => r.rank_position && r.rank_type === 'S'
          );
          const posRank = posRankEntry?.rank_position
            ? `${yp.display_position ?? ''}${posRankEntry.rank_value}`
            : null;

          try {
            await prisma.ranking.upsert({
              where: {
                playerId_source_format_scoring_season: {
                  playerId: canonical.id,
                  source: 'yahoo',
                  format: 'redraft',
                  scoring: 'half_ppr', // Yahoo default
                  season,
                },
              },
              update: { rank: rankValue, posRank },
              create: {
                playerId: canonical.id,
                source: 'yahoo',
                rank: rankValue,
                posRank,
                format: 'redraft',
                scoring: 'half_ppr',
                season,
              },
            });
            rankingRecords++;
          } catch (err) {
            errors.push(`Yahoo ranking upsert for ${canonical.name}: ${err}`);
          }
        }
      }

      // ---- Upsert ADP (if available) ----
      const avgPick = yp.draft_analysis?.average_pick;
      if (avgPick && avgPick !== '-' && avgPick !== '0') {
        const adpValue = parseFloat(avgPick);
        if (!isNaN(adpValue) && adpValue > 0) {
          try {
            await prisma.adp.upsert({
              where: {
                playerId_source_format_scoring_season: {
                  playerId: canonical.id,
                  source: 'yahoo',
                  format: 'redraft',
                  scoring: 'half_ppr',
                  season,
                },
              },
              update: { adp: adpValue },
              create: {
                playerId: canonical.id,
                source: 'yahoo',
                adp: adpValue,
                format: 'redraft',
                scoring: 'half_ppr',
                season,
              },
            });
            adpRecords++;
          } catch (err) {
            errors.push(`Yahoo ADP upsert for ${canonical.name}: ${err}`);
          }
        }
      }
    }

    // Check if there are more pages
    if (playerEntries.length < pageSize) {
      hasMore = false;
    } else {
      offset += pageSize;
      // Polite delay between pages
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const result: SyncResult = {
    source: 'yahoo',
    status: errors.length === 0 ? 'success' : errors.length < 10 ? 'partial' : 'error',
    playersFound: totalPlayers,
    adpRecords,
    rankingRecords,
    projectionRecords: 0,
    errors,
    durationMs: Date.now() - start,
  };

  console.log(`  ✅ Yahoo done: ${rankingRecords} rankings, ${adpRecords} ADP (${result.durationMs}ms)`);
  if (errors.length > 0) console.warn(`  ⚠ ${errors.length} errors`);

  return result;
}

/**
 * Yahoo returns player data as deeply nested arrays of objects.
 * This flattens it into a usable structure.
 */
function flattenYahooPlayer(playerData: any[]): YahooPlayer | null {
  try {
    // playerData is typically an array of objects, each with a single key
    const merged: any = {};

    if (Array.isArray(playerData)) {
      for (const chunk of playerData) {
        if (typeof chunk === 'object' && chunk !== null) {
          // Each chunk might be like { player_key: "..." } or nested
          Object.assign(merged, chunk);
        }
      }
    } else if (typeof playerData === 'object') {
      Object.assign(merged, playerData);
    }

    // Build name
    const nameObj = merged.name ?? {};
    const full = nameObj.full ?? `${nameObj.first ?? ''} ${nameObj.last ?? ''}`.trim();
    if (!full) return null;

    // Extract ranks
    const ranks: YahooPlayer['player_ranks'] = [];
    if (merged.player_ranks) {
      const ranksData = merged.player_ranks;
      if (Array.isArray(ranksData)) {
        for (const r of ranksData) {
          if (r.player_rank) {
            ranks.push(r.player_rank);
          } else if (r.rank_type) {
            ranks.push(r);
          }
        }
      }
    }

    // Extract draft analysis
    let draftAnalysis: YahooPlayer['draft_analysis'] = undefined;
    if (merged.draft_analysis) {
      draftAnalysis = merged.draft_analysis;
    }

    return {
      player_key: merged.player_key ?? '',
      player_id: merged.player_id ?? '',
      name: {
        full,
        first: nameObj.first ?? '',
        last: nameObj.last ?? '',
      },
      editorial_team_abbr: merged.editorial_team_abbr,
      display_position: merged.display_position,
      bye_weeks: merged.bye_weeks,
      player_ranks: ranks.length > 0 ? ranks : undefined,
      draft_analysis: draftAnalysis,
    };
  } catch {
    return null;
  }
}
