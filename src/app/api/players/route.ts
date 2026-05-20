// ============================================
// Players API Route
// ============================================
// GET /api/players?scoring=half_ppr&format=redraft&season=2026

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const scoring = searchParams.get('scoring') ?? 'half_ppr';
  const format = searchParams.get('format') ?? 'redraft';
  const seasonParam = searchParams.get('season');
  
  // Default to current year
  const season = seasonParam ? parseInt(seasonParam, 10) : new Date().getFullYear();

  try {
    const players = await prisma.player.findMany({
      where: {
        // Only return players that have at least some data
        OR: [
          { adpEntries: { some: { season, scoring } } },
          { rankings: { some: { season } } },
          { projections: { some: { season } } },
        ],
      },
      include: {
        adpEntries: {
          where: { season, format },
          select: {
            source: true,
            adp: true,
            scoring: true,
          },
        },
        rankings: {
          where: { season, format },
          select: {
            source: true,
            rank: true,
            posRank: true,
            scoring: true,
          },
        },
        projections: {
          where: { season },
          select: {
            source: true,
            ptsStd: true,
            ptsHalfPpr: true,
            ptsPpr: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Transform to frontend-friendly shape
    const rows = players.map((player) => {
      // Gather ADP per source for the requested scoring
      const adpBySource: Record<string, number | null> = {
        sleeper: null,
        yahoo: null,
        espn: null,
        fantasypros: null,
      };

      for (const entry of player.adpEntries) {
        if (entry.scoring === scoring) {
          adpBySource[entry.source] = entry.adp;
        }
      }

      // If no ADP for exact scoring match, try any available
      for (const entry of player.adpEntries) {
        if (adpBySource[entry.source] === null) {
          adpBySource[entry.source] = entry.adp;
        }
      }

      // Average ADP across available sources
      const adpValues = Object.values(adpBySource).filter((v): v is number => v !== null);
      const avgAdp = adpValues.length > 0
        ? parseFloat((adpValues.reduce((a, b) => a + b, 0) / adpValues.length).toFixed(1))
        : null;

      // Gather rankings per source
      const rankBySource: Record<string, number | null> = {
        sleeper: null,
        yahoo: null,
        espn: null,
        fantasypros: null,
      };
      let posRank: string | null = null;

      for (const entry of player.rankings) {
        if (entry.scoring === scoring || !rankBySource[entry.source]) {
          rankBySource[entry.source] = entry.rank;
          // Prefer FantasyPros posRank (most authoritative)
          if (entry.posRank && (entry.source === 'fantasypros' || !posRank)) {
            posRank = entry.posRank;
          }
        }
      }

      // ECR = FantasyPros ranking (the gold standard)
      const ecr = rankBySource.fantasypros;

      // Average ranking from non-FP sources for comparison
      const otherRanks = [rankBySource.sleeper, rankBySource.yahoo, rankBySource.espn]
        .filter((v): v is number => v !== null);
      const avgRank = otherRanks.length > 0
        ? parseFloat((otherRanks.reduce((a, b) => a + b, 0) / otherRanks.length).toFixed(1))
        : null;

      // Projection points
      let projPts: number | null = null;
      const proj = player.projections[0];
      if (proj) {
        switch (scoring) {
          case 'std': projPts = proj.ptsStd; break;
          case 'ppr': projPts = proj.ptsPpr; break;
          default: projPts = proj.ptsHalfPpr; break;
        }
      }

      return {
        id: player.id,
        name: player.name,
        team: player.team,
        position: player.position,
        byeWeek: player.byeWeek,
        imageUrl: player.imageUrl ?? null,
        adp: adpBySource,
        avgAdp,
        ecr,
        ranking: rankBySource,
        avgRanking: avgRank,
        posRank,
        projPts: projPts ? parseFloat(projPts.toFixed(1)) : null,
      };
    });

    // Sort by average ADP (nulls last)
    rows.sort((a, b) => {
      if (a.avgAdp === null && b.avgAdp === null) return 0;
      if (a.avgAdp === null) return 1;
      if (b.avgAdp === null) return -1;
      return a.avgAdp - b.avgAdp;
    });

    return NextResponse.json({
      players: rows,
      meta: { season, scoring, format, count: rows.length },
    });
  } catch (error) {
    console.error('Failed to fetch players:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player data' },
      { status: 500 }
    );
  }
}
