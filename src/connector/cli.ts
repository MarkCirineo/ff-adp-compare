// ============================================
// Draft Edge — Sync CLI
// ============================================
// Usage:
//   yarn sync                    # full pipeline (all sources)
//   yarn sync --source=sleeper   # single source
//   yarn sync --source=yahoo
//   yarn sync --source=espn
//   yarn sync --dry-run          # validate without DB writes
//   yarn sync --season=2026      # override season

import { runPipeline } from './pipeline.js';
import type { DataSource } from '../lib/types.js';

const VALID_SOURCES = new Set(['sleeper', 'yahoo', 'espn', 'fantasypros']);

function parseArgs(): {
  sources?: DataSource[];
  dryRun: boolean;
  season?: number;
} {
  const args = process.argv.slice(2);
  let sources: DataSource[] | undefined;
  let dryRun = false;
  let season: number | undefined;

  for (const arg of args) {
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('--source=')) {
      const source = arg.split('=')[1] as DataSource;
      if (!VALID_SOURCES.has(source)) {
        console.error(`❌ Invalid source: ${source}. Valid: sleeper, yahoo, espn`);
        process.exit(1);
      }
      sources = sources ?? [];
      sources.push(source);
    } else if (arg.startsWith('--season=')) {
      season = parseInt(arg.split('=')[1], 10);
      if (isNaN(season)) {
        console.error(`❌ Invalid season: ${arg.split('=')[1]}`);
        process.exit(1);
      }
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
🏈 Draft Edge — Data Sync CLI

Usage:
  yarn sync                    Full pipeline (all sources)
  yarn sync --source=sleeper   Single source
  yarn sync --source=yahoo
  yarn sync --source=espn
  yarn sync --dry-run          Validate without DB writes
  yarn sync --season=2026      Override season detection

Sources can be combined: yarn sync --source=sleeper --source=espn
      `);
      process.exit(0);
    }
  }

  return { sources, dryRun, season };
}

async function main() {
  console.log('\n🏈 Draft Edge — Data Sync\n');

  const { sources, dryRun, season } = parseArgs();

  try {
    await runPipeline({ sources, dryRun, season });
    console.log('✅ Sync complete!\n');
  } catch (err) {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  }
}

main();
