/**
 * Coverage Summary Utility
 *
 * Generates a comprehensive coverage report for the PVQ-TM data system.
 * Used for auditing data completeness and identifying gaps.
 *
 * Now includes fallback coverage metrics from:
 * - crosswalk-fallback.ts (DOT→O*NET fallback mapping)
 * - oews-fallback.ts (OEWS wage data fallback)
 * - residual-category-handler.ts (trait data for residual categories)
 */

import {
  loadDOTData,
  loadOEWSData,
  loadORSData,
  loadONETFullData,
} from "@/lib/data-loaders";
import {
  normalizeDOTGED,
  normalizeDOTStrength,
  TRAIT_KEYS,
  type TraitVector,
} from "@/lib/engine/traits";
import { computeVQ } from "@/lib/engine/vocational-quotient";
import { getCrosswalkCoverage } from "@/lib/engine/crosswalk-fallback";
import { getOEWSCoverage } from "@/lib/engine/oews-fallback";
import { getResidualCoverage } from "@/lib/engine/residual-category-handler";

export interface FallbackCoverageDetail {
  direct: number;
  fallback: number;
  uncovered: number;
  totalPct: number;
  fallbackByMethod: Record<string, number>;
}

export interface CoverageSummary {
  dot: {
    total: number;
    byStrength: Record<string, number>;
    bySVP: Record<number, number>;
  };
  onet: {
    total: number;
    byJobZone: Record<number, number>;
    withTasks: number;
    withWorkContext: number;
    withAbilities: number;
  };
  oews: {
    total: number;
    onetCoverage: number; // percentage of O*NET codes with OEWS data
    missingCodes: string[];
  };
  ors: {
    total: number;
    onetCoverage: number; // percentage of O*NET codes with ORS data
    byMajorGroup: Record<
      string,
      { total: number; covered: number; pct: number }
    >;
    missingCodes: string[];
  };
  crosswalk: {
    dotToOnet: number; // DOT codes that have an xw crosswalk value
    unmappedDot: number;
  };
  vq: {
    byBand: Record<number, number>;
    meanVQ: number;
    medianVQ: number;
  };
  /** Coverage WITH fallback data (100% targets) */
  withFallbacks?: {
    crosswalk: FallbackCoverageDetail;
    oews: FallbackCoverageDetail;
    traits: FallbackCoverageDetail;
  };
}

export async function generateCoverageSummary(): Promise<CoverageSummary> {
  const [dotData, oewsData, orsData, onetData] = await Promise.all([
    loadDOTData(),
    loadOEWSData(),
    loadORSData(),
    loadONETFullData(),
  ]);

  // ── DOT ──
  const dotCodes = Object.keys(dotData);
  const byStrength: Record<string, number> = {};
  const bySVP: Record<number, number> = {};

  for (const code of dotCodes) {
    const entry = dotData[code];
    byStrength[entry.str] = (byStrength[entry.str] || 0) + 1;
    bySVP[entry.s] = (bySVP[entry.s] || 0) + 1;
  }

  // ── O*NET ──
  const onetCodes = Object.keys(onetData);
  const byJobZone: Record<number, number> = {};
  let withTasks = 0;
  let withWorkContext = 0;
  let withAbilities = 0;

  for (const code of onetCodes) {
    const entry = onetData[code];
    if (entry.jz !== null && entry.jz !== undefined) {
      byJobZone[entry.jz] = (byJobZone[entry.jz] || 0) + 1;
    }
    if (entry.ta && entry.ta.length > 0) withTasks++;
    if (entry.wc && entry.wc.length > 0) withWorkContext++;
    if (entry.ab && entry.ab.length > 0) withAbilities++;
  }

  // ── OEWS ──
  const oewsCodes = Object.keys(oewsData);
  const oewsSocSet = new Set(oewsCodes);
  const oewsMissing: string[] = [];

  for (const onetCode of onetCodes) {
    const socPrefix = onetCode.replace(/\.\d+$/, "");
    if (!oewsSocSet.has(socPrefix)) {
      oewsMissing.push(onetCode);
    }
  }

  const oewsCoverageCount = onetCodes.length - oewsMissing.length;
  const oewsCoveragePct = (oewsCoverageCount / onetCodes.length) * 100;

  // ── ORS ──
  const orsCodes = Object.keys(orsData);
  // ORS codes are 6-digit (no dash); O*NET codes are XX-XXXX.XX
  const orsSocSet = new Set(orsCodes.map((c) => c.slice(0, 2) + "-" + c.slice(2)));
  const orsMissing: string[] = [];

  for (const onetCode of onetCodes) {
    const socPrefix = onetCode.replace(/\.\d+$/, "");
    if (!orsSocSet.has(socPrefix)) {
      orsMissing.push(onetCode);
    }
  }

  const orsCoverageCount = onetCodes.length - orsMissing.length;
  const orsCoveragePct = (orsCoverageCount / onetCodes.length) * 100;

  // ORS by major group
  const onetByMajor: Record<string, number> = {};
  for (const code of onetCodes) {
    const major = code.slice(0, 2);
    onetByMajor[major] = (onetByMajor[major] || 0) + 1;
  }

  const orsByMajor: Record<string, number> = {};
  for (const code of orsCodes) {
    const major = code.slice(0, 2);
    orsByMajor[major] = (orsByMajor[major] || 0) + 1;
  }

  const byMajorGroup: Record<
    string,
    { total: number; covered: number; pct: number }
  > = {};

  const allMajors = new Set([
    ...Object.keys(onetByMajor),
    ...Object.keys(orsByMajor),
  ]);
  for (const major of allMajors) {
    const total = onetByMajor[major] || 0;
    const covered = orsByMajor[major] || 0;
    byMajorGroup[major] = {
      total,
      covered,
      pct: total > 0 ? (covered / total) * 100 : 0,
    };
  }

  // ── Crosswalk ──
  let dotToOnet = 0;
  let unmappedDot = 0;

  for (const code of dotCodes) {
    const xw = dotData[code].xw;
    if (xw && xw.trim().length > 0) {
      dotToOnet++;
    } else {
      unmappedDot++;
    }
  }

  // ── VQ ──
  const vqScores: number[] = [];
  const vqBands: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

  for (const code of dotCodes) {
    const entry = dotData[code];
    const vec: Record<string, number | null> = {};
    for (const k of TRAIT_KEYS) {
      vec[k] = null;
    }
    vec.reasoning = normalizeDOTGED(entry.r);
    vec.math = normalizeDOTGED(entry.m);
    vec.language = normalizeDOTGED(entry.l);
    vec.strength = normalizeDOTStrength(entry.str);

    const result = computeVQ(vec as TraitVector);
    vqScores.push(result.vq);
    vqBands[result.band]++;
  }

  vqScores.sort((a, b) => a - b);
  const meanVQ =
    vqScores.length > 0
      ? vqScores.reduce((a, b) => a + b, 0) / vqScores.length
      : 0;
  const medianVQ =
    vqScores.length > 0 ? vqScores[Math.floor(vqScores.length / 2)] : 0;

  // ── Fallback Coverage ──
  const [crosswalkCov, oewsCov, residualCov] = await Promise.all([
    getCrosswalkCoverage(),
    getOEWSCoverage(onetCodes),
    getResidualCoverage(),
  ]);

  return {
    dot: {
      total: dotCodes.length,
      byStrength,
      bySVP,
    },
    onet: {
      total: onetCodes.length,
      byJobZone,
      withTasks,
      withWorkContext,
      withAbilities,
    },
    oews: {
      total: oewsCodes.length,
      onetCoverage: Math.round(oewsCoveragePct * 10) / 10,
      missingCodes: oewsMissing,
    },
    ors: {
      total: orsCodes.length,
      onetCoverage: Math.round(orsCoveragePct * 10) / 10,
      byMajorGroup,
      missingCodes: orsMissing,
    },
    crosswalk: {
      dotToOnet,
      unmappedDot,
    },
    vq: {
      byBand: vqBands,
      meanVQ: Math.round(meanVQ * 100) / 100,
      medianVQ: Math.round(medianVQ * 100) / 100,
    },
    withFallbacks: {
      crosswalk: {
        direct: crosswalkCov.directMapped,
        fallback: crosswalkCov.fallbackMapped,
        uncovered: crosswalkCov.unmapped,
        totalPct: Math.round(crosswalkCov.coveragePct * 10) / 10,
        fallbackByMethod: crosswalkCov.fallbackByMethod,
      },
      oews: {
        direct: oewsCov.directCoverage,
        fallback: oewsCov.fallbackCoverage,
        uncovered: oewsCov.noCoverage,
        totalPct: Math.round(oewsCov.coveragePct * 10) / 10,
        fallbackByMethod: oewsCov.fallbackByMethod,
      },
      traits: {
        direct: residualCov.withDirectData,
        fallback: residualCov.withProxyData,
        uncovered: residualCov.withNoData,
        totalPct: Math.round(residualCov.coveragePct * 10) / 10,
        fallbackByMethod: residualCov.proxyBySource,
      },
    },
  };
}
