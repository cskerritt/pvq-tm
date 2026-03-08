/**
 * Candidate Generation Engine
 *
 * Generates candidate target occupations using two parallel searches:
 * 1. Legacy search: DOT Work Field / MPSMS match at same/lower SVP
 * 2. Current search: O*NET related occupations, task overlap, Career Changers
 *
 * Results are merged, deduplicated, and SVP-gated.
 */

import { prisma } from "@/lib/db";
import {
  searchOccupations,
  getRelatedOccupations,
  getCareerChangers,
} from "@/lib/api/onet";

export interface CandidateOccupation {
  onetSocCode: string;
  dotCode?: string;
  title: string;
  svp: number;
  source: "DOT_WF" | "DOT_MPSMS" | "ONET_RELATED" | "ONET_CAREER_CHANGERS" | "ONET_SEARCH";
  similarityScore?: number;
}

/**
 * Generate candidate occupations from DOT Work Field / MPSMS matches.
 * Finds occupations sharing the same work fields or MPSMS codes.
 */
async function legacySearch(
  workFields: string[],
  mpsms: string[],
  maxSvp: number
): Promise<CandidateOccupation[]> {
  const candidates: CandidateOccupation[] = [];

  if (workFields.length > 0) {
    const wfMatches = await prisma.occupationDOT.findMany({
      where: {
        svp: { lte: maxSvp },
        workFields: { hasSome: workFields },
      },
      take: 50,
    });
    for (const match of wfMatches) {
      // Look up O*NET crosswalk
      const crosswalk = await prisma.dOTONETCrosswalk.findFirst({
        where: { dotCode: match.id },
      });
      candidates.push({
        onetSocCode: crosswalk?.onetSocCode ?? "",
        dotCode: match.id,
        title: match.title,
        svp: match.svp,
        source: "DOT_WF",
      });
    }
  }

  if (mpsms.length > 0) {
    const mpsmsMatches = await prisma.occupationDOT.findMany({
      where: {
        svp: { lte: maxSvp },
        mpsms: { hasSome: mpsms },
      },
      take: 50,
    });
    for (const match of mpsmsMatches) {
      const crosswalk = await prisma.dOTONETCrosswalk.findFirst({
        where: { dotCode: match.id },
      });
      candidates.push({
        onetSocCode: crosswalk?.onetSocCode ?? "",
        dotCode: match.id,
        title: match.title,
        svp: match.svp,
        source: "DOT_MPSMS",
      });
    }
  }

  return candidates;
}

/**
 * Generate candidate occupations from O*NET related occupations
 * and Career Changers matrix.
 */
async function currentSearch(
  onetCode: string,
  maxSvp: number
): Promise<CandidateOccupation[]> {
  const candidates: CandidateOccupation[] = [];

  try {
    // Related occupations
    const related = await getRelatedOccupations(onetCode);
    if (related?.occupation) {
      for (const occ of related.occupation) {
        // Look up SVP from cached data
        const cached = await prisma.occupationONET.findUnique({
          where: { id: occ.code },
        });
        const svp = cached?.jobZone
          ? jobZoneToMaxSvp(cached.jobZone)
          : maxSvp;
        if (svp <= maxSvp) {
          candidates.push({
            onetSocCode: occ.code,
            title: occ.title,
            svp,
            source: "ONET_RELATED",
            similarityScore: undefined,
          });
        }
      }
    }
  } catch {
    // O*NET API may not have related occupations for all codes
  }

  try {
    // Career Changers
    const changers = await getCareerChangers(onetCode);
    if (changers?.occupation) {
      for (const occ of changers.occupation) {
        const cached = await prisma.occupationONET.findUnique({
          where: { id: occ.code },
        });
        const svp = cached?.jobZone
          ? jobZoneToMaxSvp(cached.jobZone)
          : maxSvp;
        if (svp <= maxSvp) {
          candidates.push({
            onetSocCode: occ.code,
            title: occ.title,
            svp,
            source: "ONET_CAREER_CHANGERS",
            similarityScore: undefined,
          });
        }
      }
    }
  } catch {
    // Career changers not available for all occupations
  }

  return candidates;
}

/**
 * Convert O*NET Job Zone (1-5) to maximum SVP.
 * Job Zone 1 = SVP 1-2, Zone 2 = SVP 3-4, Zone 3 = SVP 5-6,
 * Zone 4 = SVP 7, Zone 5 = SVP 8-9
 */
function jobZoneToMaxSvp(jobZone: number): number {
  const map: Record<number, number> = {
    1: 2,
    2: 4,
    3: 6,
    4: 7,
    5: 9,
  };
  return map[jobZone] ?? 9;
}

/**
 * Deduplicate candidates by O*NET SOC code.
 * Keeps the entry with the highest similarity score.
 */
function deduplicateCandidates(
  candidates: CandidateOccupation[]
): CandidateOccupation[] {
  const map = new Map<string, CandidateOccupation>();
  for (const c of candidates) {
    if (!c.onetSocCode) continue;
    const existing = map.get(c.onetSocCode);
    if (
      !existing ||
      (c.similarityScore ?? 0) > (existing.similarityScore ?? 0)
    ) {
      map.set(c.onetSocCode, c);
    }
  }
  return Array.from(map.values());
}

/**
 * Generate all candidate occupations for a given PRW set.
 *
 * Runs both legacy (DOT) and current (O*NET) searches in parallel,
 * merges, deduplicates, and applies the SVP gate.
 */
export async function generateCandidates(
  prwData: {
    onetSocCode?: string | null;
    dotCode?: string | null;
    svp?: number | null;
    workFields?: string[];
    mpsms?: string[];
  }[]
): Promise<CandidateOccupation[]> {
  const allCandidates: CandidateOccupation[] = [];

  // Find the maximum SVP across all PRW (for gate)
  const maxSvp = Math.max(...prwData.map((p) => p.svp ?? 2));

  for (const prw of prwData) {
    const promises: Promise<CandidateOccupation[]>[] = [];

    // Legacy search if we have DOT data
    if (
      (prw.workFields && prw.workFields.length > 0) ||
      (prw.mpsms && prw.mpsms.length > 0)
    ) {
      promises.push(
        legacySearch(prw.workFields ?? [], prw.mpsms ?? [], maxSvp)
      );
    }

    // Current search if we have O*NET code
    if (prw.onetSocCode) {
      promises.push(currentSearch(prw.onetSocCode, maxSvp));
    }

    const results = await Promise.all(promises);
    allCandidates.push(...results.flat());
  }

  return deduplicateCandidates(allCandidates);
}
