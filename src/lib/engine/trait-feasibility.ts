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
 * Remaining 20 traits are set to null (source: "proxy") — we only
 * claim DOT data where we actually have it.
 */
export function buildDOTDemandVector(dotOcc: {
  gedR: number;
  gedM: number;
  gedL: number;
  strength: string;
}): {
  demands: TraitVector;
  sources: Partial<Record<TraitKey, "ORS" | "DOT" | "ONET" | "proxy">>;
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

  return { demands: demands as TraitVector, sources };
}

/**
 * Build an occupation demand vector from available data sources.
 * Priority: ORS > DOT > O*NET
 *
 * Returns the demand vector and source tracking for each trait.
 */
export function buildOccupationDemands(
  orsData?: Record<string, unknown> | null,
  dotData?: Record<string, unknown> | null,
  onetData?: Record<string, unknown> | null
): {
  demands: TraitVector;
  sources: Partial<Record<string, "ORS" | "DOT" | "ONET" | "proxy">>;
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

  return { demands: demands as TraitVector, sources };
}
