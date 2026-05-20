// ============================================
// Sleeper API Connector
// ============================================
// Fetches ADP data (all scoring formats) and season projections.
// Single API call — returns all players at once.
//
// Endpoint: GET https://api.sleeper.com/projections/nfl/{season}?
//   season_type=regular&position[]=DEF&position[]=K&position[]=QB&
//   position[]=RB&position[]=TE&position[]=WR&order_by=adp_ppr

import { PrismaClient } from '@prisma/client';
import { PlayerMatcher } from '../normalize/matcher.js';
import { fetchWithRetry } from '../utils/retry.js';
import type { SyncResult } from '../../lib/types.js';

interface SleeperProjection {
  player_id: string;
  player: {
    first_name: string;
    last_name: string;
    position: string;
  };
  team: string | null;
  stats: Record<string, number | null>;
}

/** ADP field → our scoring format key */
const ADP_FIELDS: Record<string, string> = {
  adp_std: 'std',
  adp_half_ppr: 'half_ppr',
  adp_ppr: 'ppr',
  adp_2qb: '2qb',
  adp_superflex: 'superflex',
  adp_dynasty: 'dynasty',
  adp_dynasty_half_ppr: 'dynasty_half_ppr',
  adp_dynasty_ppr: 'dynasty_ppr',
  adp_dynasty_std: 'dynasty_std',
  adp_dynasty_2qb: 'dynasty_2qb',
  adp_dynasty_superflex: 'dynasty_superflex',
};

export async function syncSleeper(
  prisma: PrismaClient,
  matcher: PlayerMatcher,
  season: number,
  dryRun = false
): Promise<SyncResult> {
  const start = Date.now();
  const errors: string[] = [];
  let adpRecords = 0;
  let projectionRecords = 0;

  console.log('\n  📡 Sleeper — Fetching projections & ADP...');

  const positions = ['DEF', 'K', 'QB', 'RB', 'TE', 'WR'];
  const posParams = positions.map((p) => `position[]=${p}`).join('&');
  const url = `https://api.sleeper.com/projections/nfl/${season}?season_type=regular&${posParams}&order_by=adp_ppr`;

  const res = await fetchWithRetry(url);
  const projections: SleeperProjection[] = await res.json();

  console.log(`  → Received ${projections.length} player projections`);

  for (const proj of projections) {
    // Sleeper connector has direct ID access — skip fuzzy match
    const canonical = matcher.findBySleeperIdInMemory(proj.player_id);
    if (!canonical) {
      // Player not in our seeded DB (filtered out during seed)
      continue;
    }

    const stats = proj.stats || {};

    if (dryRun) {
      const name = `${proj.player?.first_name ?? ''} ${proj.player?.last_name ?? ''}`.trim();
      const adpValues = Object.entries(ADP_FIELDS)
        .filter(([key]) => stats[key] != null)
        .map(([key, label]) => `${label}=${stats[key]}`)
        .join(', ');
      if (adpValues) {
        console.log(`    ${name}: ${adpValues}`);
      }
      continue;
    }

    // ---- Upsert ADP entries ----
    for (const [field, scoring] of Object.entries(ADP_FIELDS)) {
      const adpValue = stats[field];
      if (adpValue == null || adpValue <= 0) continue;

      // Determine format from scoring key
      const format = scoring.startsWith('dynasty') ? 'dynasty' : 'redraft';
      const scoringClean = scoring.replace('dynasty_', '');

      try {
        await prisma.adp.upsert({
          where: {
            playerId_source_format_scoring_season: {
              playerId: canonical.id,
              source: 'sleeper',
              format,
              scoring: scoringClean,
              season,
            },
          },
          update: { adp: adpValue },
          create: {
            playerId: canonical.id,
            source: 'sleeper',
            adp: adpValue,
            format,
            scoring: scoringClean,
            season,
          },
        });
        adpRecords++;
      } catch (err) {
        errors.push(`ADP upsert failed for ${canonical.name} (${scoring}): ${err}`);
      }
    }

    // ---- Upsert Projection ----
    const hasProjData = stats.pts_ppr != null || stats.pts_half_ppr != null || stats.pts_std != null;
    if (hasProjData) {
      try {
        await prisma.projection.upsert({
          where: {
            playerId_source_season: {
              playerId: canonical.id,
              source: 'sleeper',
              season,
            },
          },
          update: {
            ptsStd: stats.pts_std ?? null,
            ptsHalfPpr: stats.pts_half_ppr ?? null,
            ptsPpr: stats.pts_ppr ?? null,
            passYd: stats.pass_yd ?? null,
            passTd: stats.pass_td ?? null,
            rushYd: stats.rush_yd ?? null,
            rushTd: stats.rush_td ?? null,
            rec: stats.rec ?? null,
            recYd: stats.rec_yd ?? null,
            recTd: stats.rec_td ?? null,
          },
          create: {
            playerId: canonical.id,
            source: 'sleeper',
            season,
            ptsStd: stats.pts_std ?? null,
            ptsHalfPpr: stats.pts_half_ppr ?? null,
            ptsPpr: stats.pts_ppr ?? null,
            passYd: stats.pass_yd ?? null,
            passTd: stats.pass_td ?? null,
            rushYd: stats.rush_yd ?? null,
            rushTd: stats.rush_td ?? null,
            rec: stats.rec ?? null,
            recYd: stats.rec_yd ?? null,
            recTd: stats.rec_td ?? null,
          },
        });
        projectionRecords++;
      } catch (err) {
        errors.push(`Projection upsert failed for ${canonical.name}: ${err}`);
      }
    }
  }

  const result: SyncResult = {
    source: 'sleeper',
    status: errors.length === 0 ? 'success' : 'partial',
    playersFound: projections.length,
    adpRecords,
    rankingRecords: 0,
    projectionRecords,
    errors,
    durationMs: Date.now() - start,
  };

  console.log(`  ✅ Sleeper done: ${adpRecords} ADP, ${projectionRecords} projections (${result.durationMs}ms)`);
  if (errors.length > 0) console.warn(`  ⚠ ${errors.length} errors`);

  return result;
}
