/**
 * Trait Feasibility Engine (TFQ)
 *
 * Computes the Trait Feasibility Quotient:
 * - Any failed post-profile trait = automatic exclusion
 * - Among survivors: TFQ reflects reserve margin across 24 traits
 *
 * TFQ = (average margin / max possible margin) × 100
 */

import {
  type TraitVector,
  type TraitComparison,
  type TraitKey,
  compareTraits,
  calculateReserveMargin,
  normalizeDOTGED,
  normalizeDOTStrength,
  TRAIT_KEYS,
} from "./traits";

export interface TFQResult {
  tfq: number;
  passes: boolean;
  failedTraits: TraitComparison[];
  traitComparisons: TraitComparison[];
  reserveMargin: number;
}

/**
 * Compute the Trait Feasibility Quotient (TFQ).
 *
 * If any trait fails (demand exceeds capacity), the occupation is excluded.
 * Among survivors, TFQ = normalized reserve margin.
 */
export function computeTFQ(
  workerPostProfile: TraitVector,
  occupationDemands: TraitVector,
  sources?: Partial<Record<string, "ORS" | "DOT" | "ONET" | "proxy">>
): TFQResult {
  const comparisons = compareTraits(
    workerPostProfile,
    occupationDemands,
    sources as Parameters<typeof compareTraits>[2]
  );

  const failedTraits = comparisons.filter((c) => !c.passes);
  const passes = failedTraits.length === 0;

  if (!passes) {
    return {
      tfq: 0,
      passes: false,
      failedTraits,
      traitComparisons: comparisons,
      reserveMargin: 0,
    };
  }

  const reserveMargin = calculateReserveMargin(
    workerPostProfile,
    occupationDemands
  );

  // TFQ = reserve margin (already 0-100 scale from calculateReserveMargin)
  // Clamp between 0-100
  const tfq = Math.min(100, Math.max(0, reserveMargin));

  return {
    tfq: Math.round(tfq * 100) / 100,
    passes: true,
    failedTraits: [],
    traitComparisons: comparisons,
    reserveMargin: Math.round(reserveMargin * 100) / 100,
  };
}

/**
 * Build a trait demand vector from a DOT occupation record.
 *
 * Maps the 4 available DOT fields to the 24-trait system:
 *   reasoning ← normalizeDOTGED(gedR)
 *   math      ← normalizeDOTGED(gedM)
 *   language  ← normalizeDOTGED(gedL)
 *   strength  ← normalizeDOTStrength(strength)
 *
 * If GED values normalize to 0 (gedR/M/L was 0 or 1), falls back to
 * O*NET abilities or SVP-based proxy values to ensure reasoning/math/language
 * are never left at 0 for occupations that clearly require cognitive ability.
 *
 * Remaining 20 traits are set to null (source: "proxy") — we only
 * claim DOT data where we actually have it.
 */
export function buildDOTDemandVector(
  dotOcc: {
    gedR: number;
    gedM: number;
    gedL: number;
    strength: string;
    svp?: number;
  },
  onetData?: Record<string, unknown> | null
): {
  demands: TraitVector;
  sources: Partial<Record<TraitKey, "ORS" | "DOT" | "ONET" | "proxy">>;
  gedSource: "DOT" | "ONET" | "SVP_PROXY" | "mixed";
} {
  const demands: Partial<TraitVector> = {};
  const sources: Partial<Record<TraitKey, "ORS" | "DOT" | "ONET" | "proxy">> = {};

  for (const key of TRAIT_KEYS) {
    demands[key] = null;
    sources[key] = "proxy";
  }

  // Map DOT GED levels → normalized 0-4 scale
  demands.reasoning = normalizeDOTGED(dotOcc.gedR);
  sources.reasoning = "DOT";

  demands.math = normalizeDOTGED(dotOcc.gedM);
  sources.math = "DOT";

  demands.language = normalizeDOTGED(dotOcc.gedL);
  sources.language = "DOT";

  // Map DOT strength code → normalized 0-4 scale
  demands.strength = normalizeDOTStrength(dotOcc.strength);
  sources.strength = "DOT";

  // ─── Ensure reasoning/math/language are never 0 ──────────────
  const gedKeys = ["reasoning", "math", "language"] as const;
  const gedSourcePerTrait: string[] = [];

  for (const gedKey of gedKeys) {
    const currentVal = demands[gedKey];
    if (currentVal != null && currentVal > 0) {
      gedSourcePerTrait.push("DOT");
      continue;
    }

    // Try O*NET abilities
    const onetVal = deriveGEDFromONET(gedKey, onetData);
    if (onetVal !== null && onetVal > 0) {
      demands[gedKey] = onetVal;
      sources[gedKey] = "ONET";
      gedSourcePerTrait.push("ONET");
      continue;
    }

    // Fall back to SVP-based proxy
    const svp = dotOcc.svp ?? (onetData?.svp as number) ?? null;
    const proxy = getSVPProxyGED(svp);
    demands[gedKey] = proxy[gedKey];
    sources[gedKey] = "proxy";
    gedSourcePerTrait.push("SVP_PROXY");
  }

  // Determine overall GED source
  const uniqueSources = [...new Set(gedSourcePerTrait)];
  let gedSource: "DOT" | "ONET" | "SVP_PROXY" | "mixed";
  if (uniqueSources.length === 1) {
    gedSource = uniqueSources[0] === "DOT" ? "DOT" : uniqueSources[0] === "ONET" ? "ONET" : "SVP_PROXY";
  } else {
    gedSource = "mixed";
  }

  return { demands: demands as TraitVector, sources, gedSource };
}

/**
 * O*NET ability IDs that map to reasoning/math/language GED equivalents.
 * We average the relevant abilities and map to 0-4 scale.
 */
const ONET_GED_ABILITY_MAP: Record<string, string[]> = {
  // Reasoning ← average of Deductive Reasoning + Inductive Reasoning + Problem Sensitivity
  reasoning: ["1.A.1.b.4", "1.A.1.b.5", "1.A.1.b.3"],
  // Math ← average of Mathematical Reasoning + Number Facility
  math: ["1.A.1.c.1", "1.A.1.c.2"],
  // Language ← average of Written Comprehension + Oral Comprehension + Written Expression
  language: ["1.A.1.a.2", "1.A.1.a.1", "1.A.1.a.4"],
};

/**
 * Try to derive a GED trait value from O*NET abilities data.
 * Returns the normalized 0-4 value or null if no matching abilities found.
 */
function deriveGEDFromONET(
  traitKey: string,
  onetData: Record<string, unknown> | null | undefined
): number | null {
  if (!onetData) return null;

  const abilityIds = ONET_GED_ABILITY_MAP[traitKey];
  if (!abilityIds) return null;

  // O*NET abilities may be stored as an array of {id, name, value, level}
  const abilities = onetData.abilities as
    | { id: string; name: string; value: number; level: number }[]
    | null
    | undefined;
  if (!Array.isArray(abilities)) return null;

  const matched: number[] = [];
  for (const abilityId of abilityIds) {
    const ab = abilities.find((a) => a.id === abilityId);
    if (ab && typeof ab.level === "number") {
      // O*NET level is 0-7, normalize to 0-4
      matched.push(Math.round(Math.min(4, Math.max(0, (ab.level / 7) * 4)) * 100) / 100);
    }
  }

  if (matched.length === 0) return null;
  const avg = matched.reduce((a, b) => a + b, 0) / matched.length;
  return Math.round(avg * 100) / 100;
}

/**
 * Get SVP-based floor values for reasoning, math, and language.
 * Used as a last resort when neither DOT GED nor O*NET data is available.
 */
function getSVPProxyGED(
  svp: number | null | undefined
): { reasoning: number; math: number; language: number } {
  const s = svp ?? 2; // default to SVP 2 (unskilled) if unknown
  if (s <= 2) return { reasoning: 0.8, math: 0.4, language: 0.8 };
  if (s <= 4) return { reasoning: 1.2, math: 0.8, language: 1.2 };
  if (s <= 6) return { reasoning: 1.6, math: 1.2, language: 1.6 };
  return { reasoning: 2.4, math: 1.6, language: 2.4 };
}

/**
 * Build an occupation demand vector from available data sources.
 * Priority: ORS > DOT > O*NET
 *
 * Returns the demand vector, source tracking for each trait,
 * and gedSource indicating where GED values came from.
 */
export function buildOccupationDemands(
  orsData?: Record<string, unknown> | null,
  dotData?: Record<string, unknown> | null,
  onetData?: Record<string, unknown> | null
): {
  demands: TraitVector;
  sources: Partial<Record<string, "ORS" | "DOT" | "ONET" | "proxy">>;
  gedSource: "DOT" | "ONET" | "SVP_PROXY" | "mixed";
} {
  const demands: Partial<TraitVector> = {};
  const sources: Partial<Record<string, "ORS" | "DOT" | "ONET" | "proxy">> = {};

  for (const key of TRAIT_KEYS) {
    // Try ORS first
    if (orsData && key in orsData && orsData[key] !== null && orsData[key] !== undefined) {
      demands[key] = orsData[key] as number;
      sources[key] = "ORS";
    }
    // Then DOT
    else if (dotData && key in dotData && dotData[key] !== null && dotData[key] !== undefined) {
      demands[key] = dotData[key] as number;
      sources[key] = "DOT";
    }
    // Then O*NET
    else if (onetData && key in onetData && onetData[key] !== null && onetData[key] !== undefined) {
      demands[key] = onetData[key] as number;
      sources[key] = "ONET";
    }
    // Not available
    else {
      demands[key] = null;
      sources[key] = "proxy";
    }
  }

  // ─── Ensure reasoning/math/language are always filled ─────────
  // If DOT GED values normalized to 0 or are null, they mean "no data"
  // rather than "no demand". Every occupation requires some cognitive ability.
  const gedKeys = ["reasoning", "math", "language"] as const;
  const gedSourcePerTrait: string[] = [];

  for (const gedKey of gedKeys) {
    const currentVal = demands[gedKey];
    const currentSource = sources[gedKey];

    if (currentVal != null && currentVal > 0) {
      // Already has a valid value from DOT/ORS/ONET
      gedSourcePerTrait.push(currentSource ?? "DOT");
      continue;
    }

    // Try O*NET abilities first
    const onetVal = deriveGEDFromONET(gedKey, onetData);
    if (onetVal !== null && onetVal > 0) {
      demands[gedKey] = onetVal;
      sources[gedKey] = "ONET";
      gedSourcePerTrait.push("ONET");
      continue;
    }

    // Fall back to SVP-based proxy
    const svp = (dotData?.svp as number) ?? (onetData?.svp as number) ?? null;
    const proxy = getSVPProxyGED(svp);
    demands[gedKey] = proxy[gedKey];
    sources[gedKey] = "proxy";
    gedSourcePerTrait.push("SVP_PROXY");
  }

  // Determine overall GED source
  const uniqueSources = [...new Set(gedSourcePerTrait)];
  let gedSource: "DOT" | "ONET" | "SVP_PROXY" | "mixed";
  if (uniqueSources.length === 1) {
    const s = uniqueSources[0];
    gedSource = s === "DOT" || s === "ORS" ? "DOT" : s === "ONET" ? "ONET" : "SVP_PROXY";
  } else {
    gedSource = "mixed";
  }

  return { demands: demands as TraitVector, sources, gedSource };
}
