// ============================================
// Draft Edge — Database Seed Script
// ============================================
// Seeds the Player table from Sleeper's canonical player list.
// Usage: yarn db:seed   (or: npx prisma db seed)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Fantasy-relevant positions
const VALID_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);

/**
 * Normalize a player name for fuzzy-match keying.
 * - Lowercase
 * - Strip suffixes (Jr., Sr., II, III, IV, V)
 * - Remove punctuation (apostrophes, periods, hyphens)
 * - Collapse whitespace
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\.?\b/gi, '')
    .replace(/[.''\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  team: string | null;
  position: string | null;
  fantasy_positions: string[] | null;
  status: string | null;
  active: boolean;
  search_rank?: number | null;
  // DEF entries have no first/last, they use team
}

interface SleeperState {
  season: string;
  season_type: string;
  week: number;
}

async function main() {
  console.log('🏈 Draft Edge — Seeding database...\n');

  // 1. Get current NFL state (season)
  console.log('  Fetching NFL state from Sleeper...');
  const stateRes = await fetch('https://api.sleeper.com/v1/state/nfl');
  if (!stateRes.ok) throw new Error(`Sleeper state API failed: ${stateRes.status}`);
  const state: SleeperState = await stateRes.json();
  console.log(`  → Season: ${state.season}, Type: ${state.season_type}, Week: ${state.week}\n`);

  // 2. Fetch all players
  console.log('  Fetching player database from Sleeper (this is a large payload ~25MB)...');
  const playersRes = await fetch('https://api.sleeper.com/v1/players/nfl');
  if (!playersRes.ok) throw new Error(`Sleeper players API failed: ${playersRes.status}`);
  const allPlayers: Record<string, SleeperPlayer> = await playersRes.json();
  const totalCount = Object.keys(allPlayers).length;
  console.log(`  → Total players in Sleeper DB: ${totalCount}\n`);

  // 3. Filter to fantasy-relevant, active players
  const relevantPlayers = Object.values(allPlayers).filter((p) => {
    // Must have a valid position
    const pos = p.position || (p.fantasy_positions?.[0] ?? null);
    if (!pos || !VALID_POSITIONS.has(pos)) return false;

    // DEF entries are always relevant
    if (pos === 'DEF') return true;

    // Must be active and on a team (or at least have a search rank)
    if (p.status === 'Inactive' && !p.team) return false;

    // Filter low-relevance players — search_rank > 9999 means irrelevant
    if (p.search_rank && p.search_rank > 9999) return false;

    return true;
  });

  console.log(`  → Fantasy-relevant players after filtering: ${relevantPlayers.length}\n`);

  // 4. Upsert into database
  console.log('  Upserting players into database...');
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const p of relevantPlayers) {
    const position = p.position || p.fantasy_positions?.[0] || 'Unknown';
    const name = position === 'DEF'
      ? `${p.team || p.first_name} ${p.last_name}`.trim()
      : `${p.first_name} ${p.last_name}`.trim();

    if (!name || name === ' ') {
      skipped++;
      continue;
    }

    const normalized = normalizeName(name);
    const sleeperId = p.player_id;

    try {
      const existing = await prisma.player.findUnique({
        where: { sleeperId },
      });

      if (existing) {
        await prisma.player.update({
          where: { sleeperId },
          data: {
            name,
            normalizedName: normalized,
            team: p.team,
            position,
            // Don't overwrite byeWeek here — connectors set that
          },
        });
        updated++;
      } else {
        await prisma.player.create({
          data: {
            name,
            normalizedName: normalized,
            team: p.team,
            position,
            sleeperId,
          },
        });
        created++;
      }
    } catch (err) {
      console.error(`  ⚠ Failed to upsert ${name} (${sleeperId}):`, err);
      skipped++;
    }
  }

  console.log(`\n  ✅ Seed complete!`);
  console.log(`     Created: ${created}`);
  console.log(`     Updated: ${updated}`);
  console.log(`     Skipped: ${skipped}`);
  console.log(`     Total in DB: ${created + updated}\n`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
