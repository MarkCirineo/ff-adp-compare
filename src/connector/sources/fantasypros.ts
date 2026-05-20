// ============================================
// FantasyPros API Connector
// ============================================
// Fetches Expert Consensus Rankings (ECR) — the gold standard
// for fantasy football rankings across 100+ experts.
//
// Also provides player headshot images, bye weeks, position ranks,
// expert tiers, and ownership percentages.
//
// Endpoint: GET https://api.fantasypros.com/v2/json/nfl/{season}/consensus-rankings
//   ?type=draft&scoring={HALF|PPR|STD}&position=ALL&week=0&experts=available&sport=NFL
//
// Requires x-api-key header (public, embedded in their frontend JS).

import { PrismaClient } from '@prisma/client';
import { PlayerMatcher } from '../normalize/matcher.js';
import { fetchWithRetry } from '../utils/retry.js';
import type { SyncResult } from '../../lib/types.js';

const FP_API_KEY = 'zjxN52G3lP4fORpHRftGI2mTU8cTwxVNvkjByM3j';
const FP_BASE_URL = 'https://api.fantasypros.com/v2/json/nfl';

/** FantasyPros scoring parameter → our scoring key */
const SCORING_MAP: Record<string, string> = {
  HALF: 'half_ppr',
  PPR: 'ppr',
  STD: 'std',
};

interface FPPlayer {
  player_id: number;
  player_name: string;
  player_team_id: string;
  player_position_id: string;
  player_short_name: string;
  player_image_url: string;
  player_square_image_url: string;
  player_yahoo_id: string;
  player_bye_week: string;
  player_owned_avg: number | null;
  player_owned_espn: number | null;
  player_owned_yahoo: number | null;
  rank_ecr: number;
  rank_min: string;
  rank_max: string;
  rank_ave: string;
  rank_std: string;
  pos_rank: string;   // e.g. "RB1", "WR5"
  tier: number;
  player_ecr_delta: number | null;
}

export async function syncFantasyPros(
  prisma: PrismaClient,
  matcher: PlayerMatcher,
  season: number,
  dryRun = false
): Promise<SyncResult> {
  const start = Date.now();
  const errors: string[] = [];
  let rankingRecords = 0;
  let playersUpdated = 0;

  console.log('\n  📡 FantasyPros — Fetching Expert Consensus Rankings...');

  // Fetch all three scoring formats
  const scoringFormats: Array<{ param: string; key: string }> = [
    { param: 'HALF', key: 'half_ppr' },
    { param: 'PPR', key: 'ppr' },
    { param: 'STD', key: 'std' },
  ];

  let totalPlayers = 0;

  for (const { param, key: scoring } of scoringFormats) {
    const url = `${FP_BASE_URL}/${season}/consensus-rankings?type=draft&scoring=${param}&position=ALL&week=0&experts=available&sport=NFL`;

    let players: FPPlayer[];
    try {
      const res = await fetchWithRetry(url, {
        headers: {
          'Accept': '*/*',
          'Content-Type': 'application/json',
          'Origin': 'https://www.fantasypros.com',
          'Referer': 'https://www.fantasypros.com/',
          'x-api-key': FP_API_KEY,
        },
      });
      const data = await res.json();
      players = data.players || [];
    } catch (err) {
      errors.push(`FantasyPros ${param} fetch failed: ${err}`);
      continue;
    }

    console.log(`  → ${param}: ${players.length} players`);
    if (scoring === 'half_ppr') totalPlayers = players.length;

    for (const fp of players) {
      if (!fp.player_name || !fp.rank_ecr) continue;

      const canonical = matcher.match(
        fp.player_name,
        fp.player_team_id,
        fp.player_position_id
      );

      if (!canonical) continue;

      if (dryRun) {
        if (scoring === 'half_ppr') {
          console.log(`    #${fp.rank_ecr} ${fp.player_name} (${fp.pos_rank}) tier ${fp.tier}`);
        }
        continue;
      }

      // ---- Update player with image + FantasyPros ID (only on first scoring pass) ----
      if (scoring === 'half_ppr') {
        try {
          const updateData: Record<string, any> = {
            fantasyProsId: String(fp.player_id),
          };

          // Set image URL if we have one
          if (fp.player_image_url) {
            updateData.imageUrl = fp.player_image_url;
          }

          // Set bye week if we have it and player doesn't already
          if (fp.player_bye_week && fp.player_bye_week !== '0') {
            updateData.byeWeek = parseInt(fp.player_bye_week, 10);
          }

          // Set Yahoo ID if we have it
          if (fp.player_yahoo_id && !canonical.sleeperId) {
            // Only if not already matched via another source
          }

          await prisma.player.update({
            where: { id: canonical.id },
            data: updateData,
          });
          playersUpdated++;
        } catch {
          // Ignore unique constraint errors on fantasyProsId
        }
      }

      // ---- Upsert Ranking (ECR) ----
      try {
        await prisma.ranking.upsert({
          where: {
            playerId_source_format_scoring_season: {
              playerId: canonical.id,
              source: 'fantasypros',
              format: 'redraft',
              scoring,
              season,
            },
          },
          update: {
            rank: fp.rank_ecr,
            posRank: fp.pos_rank || null,
          },
          create: {
            playerId: canonical.id,
            source: 'fantasypros',
            rank: fp.rank_ecr,
            posRank: fp.pos_rank || null,
            format: 'redraft',
            scoring,
            season,
          },
        });
        rankingRecords++;
      } catch (err) {
        errors.push(`FP ranking upsert for ${canonical.name} (${scoring}): ${err}`);
      }
    }

    // Polite delay between scoring format requests
    if (scoring !== 'std') {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  const result: SyncResult = {
    source: 'fantasypros',
    status: errors.length === 0 ? 'success' : errors.length < 10 ? 'partial' : 'error',
    playersFound: totalPlayers,
    adpRecords: 0,
    rankingRecords,
    projectionRecords: 0,
    errors,
    durationMs: Date.now() - start,
  };

  console.log(`  ✅ FantasyPros done: ${rankingRecords} rankings, ${playersUpdated} players updated (${result.durationMs}ms)`);
  if (errors.length > 0) console.warn(`  ⚠ ${errors.length} errors`);

  return result;
}
