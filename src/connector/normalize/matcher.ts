// ============================================
// Fuzzy Player Matcher
// ============================================
// Matches platform-specific player names against the canonical Sleeper
// player list stored in the database using fuse.js.

import Fuse from 'fuse.js';
import { PrismaClient } from '@prisma/client';
import { normalizeName } from './names.js';

interface CanonicalPlayer {
  id: string;
  name: string;
  normalizedName: string;
  team: string | null;
  position: string;
  sleeperId: string | null;
}

export class PlayerMatcher {
  private fuse: Fuse<CanonicalPlayer> | null = null;
  private players: CanonicalPlayer[] = [];
  private nameCache = new Map<string, CanonicalPlayer | null>();

  /**
   * Load canonical player list from DB and initialize fuse index.
   * Must be called before any match operations.
   */
  async initialize(prisma: PrismaClient): Promise<void> {
    this.players = await prisma.player.findMany({
      select: {
        id: true,
        name: true,
        normalizedName: true,
        team: true,
        position: true,
        sleeperId: true,
      },
    });

    this.fuse = new Fuse(this.players, {
      keys: [
        { name: 'normalizedName', weight: 0.7 },
        { name: 'team', weight: 0.3 },
      ],
      threshold: 0.3,
      includeScore: true,
    });

    // Pre-populate exact match cache
    for (const p of this.players) {
      this.nameCache.set(p.normalizedName, p);
    }

    console.log(`  PlayerMatcher initialized with ${this.players.length} canonical players`);
  }

  /**
   * Find the canonical player for a given name + optional team.
   * Returns null if no confident match found.
   */
  match(
    name: string,
    team?: string | null,
    position?: string | null
  ): CanonicalPlayer | null {
    const normalized = normalizeName(name);

    // 1. Exact cache hit
    const exact = this.nameCache.get(normalized);
    if (exact) return exact;

    // 2. Fuzzy match with fuse
    if (!this.fuse) {
      throw new Error('PlayerMatcher not initialized. Call initialize() first.');
    }

    const results = this.fuse.search(normalized, { limit: 5 });
    if (results.length === 0) return null;

    // If we have team info, prefer matches with same team
    if (team) {
      const teamUpper = team.toUpperCase();
      const teamMatch = results.find(
        (r) => r.item.team?.toUpperCase() === teamUpper
      );
      if (teamMatch && (teamMatch.score ?? 1) < 0.3) {
        this.nameCache.set(normalized, teamMatch.item);
        return teamMatch.item;
      }
    }

    // If we have position info, prefer matches with same position
    if (position) {
      const posUpper = position.toUpperCase();
      const posMatch = results.find(
        (r) => r.item.position === posUpper
      );
      if (posMatch && (posMatch.score ?? 1) < 0.25) {
        this.nameCache.set(normalized, posMatch.item);
        return posMatch.item;
      }
    }

    // Fall back to best score
    const best = results[0];
    if ((best.score ?? 1) < 0.2) {
      this.nameCache.set(normalized, best.item);
      return best.item;
    }

    // No confident match
    this.nameCache.set(normalized, null);
    return null;
  }

  /**
   * Find a player by Sleeper ID (direct DB key lookup).
   */
  findBySleeperIdInMemory(sleeperId: string): CanonicalPlayer | null {
    return this.players.find((p) => p.sleeperId === sleeperId) ?? null;
  }

  /** Number of loaded canonical players */
  get count(): number {
    return this.players.length;
  }
}
