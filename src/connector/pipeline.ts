// ============================================
// Pipeline Orchestrator
// ============================================
// Coordinates all API connectors, initializes the matcher, and
// logs sync results to the database.

import { PrismaClient } from '@prisma/client';
import { PlayerMatcher } from './normalize/matcher.js';
import { syncSleeper } from './sources/sleeper.js';
import { syncYahoo } from './sources/yahoo.js';
import { syncEspn } from './sources/espn.js';
import { syncFantasyPros } from './sources/fantasypros.js';
import type { DataSource, SyncResult } from '../lib/types.js';

const ALL_SOURCES: DataSource[] = ['sleeper', 'yahoo', 'espn', 'fantasypros'];

interface PipelineOptions {
  sources?: DataSource[];
  dryRun?: boolean;
  season?: number;
}

export async function runPipeline(options: PipelineOptions = {}): Promise<SyncResult[]> {
  const prisma = new PrismaClient();
  const matcher = new PlayerMatcher();
  const results: SyncResult[] = [];

  try {
    // 1. Determine season
    let season = options.season;
    if (!season) {
      console.log('  Detecting current NFL season...');
      const stateRes = await fetch('https://api.sleeper.com/v1/state/nfl');
      const state = await stateRes.json();
      season = parseInt(state.season, 10);
      console.log(`  → Season: ${season}\n`);
    }

    // 2. Initialize player matcher from DB
    console.log('  Loading canonical player database...');
    await matcher.initialize(prisma);
    if (matcher.count === 0) {
      throw new Error(
        'No players in database. Run "yarn db:seed" first to populate from Sleeper.'
      );
    }

    // 3. Run selected sources
    const sources = options.sources ?? ALL_SOURCES;
    const dryRun = options.dryRun ?? false;

    if (dryRun) {
      console.log('\n  🏜️  DRY RUN — no database writes will be made\n');
    }

    console.log(`\n🔄 Running pipeline for: ${sources.join(', ')} (season ${season})`);

    for (const source of sources) {
      const startTime = new Date();
      let result: SyncResult;

      try {
        switch (source) {
          case 'sleeper':
            result = await syncSleeper(prisma, matcher, season, dryRun);
            break;
          case 'yahoo':
            result = await syncYahoo(prisma, matcher, season, dryRun);
            break;
          case 'espn':
            result = await syncEspn(prisma, matcher, season, dryRun);
            break;
          case 'fantasypros':
            result = await syncFantasyPros(prisma, matcher, season, dryRun);
            break;
          default:
            throw new Error(`Unknown source: ${source}`);
        }
      } catch (err) {
        result = {
          source,
          status: 'error',
          playersFound: 0,
          adpRecords: 0,
          rankingRecords: 0,
          projectionRecords: 0,
          errors: [String(err)],
          durationMs: Date.now() - startTime.getTime(),
        };
        console.error(`  ❌ ${source} failed:`, err);
      }

      results.push(result);

      // Log to DB (unless dry run)
      if (!dryRun) {
        try {
          await prisma.syncLog.create({
            data: {
              source,
              status: result.status,
              playersFound: result.playersFound,
              errors: result.errors.length > 0 ? result.errors : undefined,
              startedAt: startTime,
              completedAt: new Date(),
            },
          });
        } catch (err) {
          console.warn(`  ⚠ Failed to write SyncLog for ${source}:`, err);
        }
      }
    }

    // 4. Summary
    console.log('\n' + '='.repeat(60));
    console.log('  SYNC SUMMARY');
    console.log('='.repeat(60));
    for (const r of results) {
      const icon = r.status === 'success' ? '✅' : r.status === 'partial' ? '⚠️' : '❌';
      console.log(
        `  ${icon} ${r.source.padEnd(8)} | ` +
          `${r.playersFound} players | ` +
          `${r.adpRecords} ADP | ` +
          `${r.rankingRecords} rankings | ` +
          `${r.projectionRecords} projections | ` +
          `${r.durationMs}ms`
      );
    }
    console.log('='.repeat(60) + '\n');

    return results;
  } finally {
    await prisma.$disconnect();
  }
}
