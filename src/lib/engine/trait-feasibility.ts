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

/** Source type for trait provenance tracking */
export type TraitSource = "ORS" | "DOT" | "ONET" | "DPT_PROXY" | "SVP_PROXY" | "proxy";

/**
 * Analysis mode controls how strictly trait failures are enforced.
 *
 * "strict" — SSA/Daubert litigation mode. Any single trait failure = exclusion.
 * "clinical" — Rehabilitation/counseling mode. Allows 1 marginal failure
 *   (deficit ≤ 1 categorical level) with a TFQ penalty instead of exclusion.
 *   This is appropriate for vocational counseling, rehabilitation planning,
 *   and non-litigation contexts where near-viable occupations are informative.
 */
export type AnalysisMode = "strict" | "clinical";

export interface TFQResult {
  tfq: number;
  passes: boolean;
  failedTraits: TraitComparison[];
  traitComparisons: TraitComparison[];
  reserveMargin: number;
  /** Analysis mode used for this computation. Defaults to "strict" for backward compatibility. */
  analysisMode?: AnalysisMode;
  /** In clinical mode, marginal failures that were tolerated (not excluded) */
  toleratedFailures?: TraitComparison[];
}

/**
 * Compute the Trait Feasibility Quotient (TFQ).
 *
 * Strict mode (default): any trait failure = automatic exclusion.
 * Clinical mode: allows 1 marginal failure (deficit ≤ 1 category) with
 * a TFQ penalty instead of exclusion. This is useful for rehabilitation
 * planning where near-viable occupations should be surfaced.
 *
 * Among survivors, TFQ = normalized reserve margin (penalized in clinical
 * mode if marginal failures were tolerated).
 */
export function computeTFQ(
  workerPostProfile: TraitVector,
  occupationDemands: TraitVector,
  sources?: Partial<Record<string, TraitSource>>,
  mode: AnalysisMode = "strict"
): TFQResult {
  const comparisons = compareTraits(
    workerPostProfile,
    occupationDemands,
    sources as Parameters<typeof compareTraits>[2]
  );

  const failedTraits = comparisons.filter((c) => !c.passes);

  // ─── Strict mode: any failure = exclusion ──────────────────────
  if (mode === "strict") {
    if (failedTraits.length > 0) {
      return {
        tfq: 0,
        passes: false,
        failedTraits,
        traitComparisons: comparisons,
        reserveMargin: 0,
        analysisMode: "strict",
      };
    }
  }

  // ─── Clinical mode: tolerate up to 1 marginal failure ──────────
  if (mode === "clinical" && failedTraits.length > 0) {
    // Classify failures: marginal (deficit ≤ 1 category) vs severe
    const marginalFailures = failedTraits.filter((f) => {
      if (f.margin === null) return false;
      // margin is negative for failures; deficit = |margin|
      // Marginal = deficit ≤ 1.0 (one categorical level)
      return Math.abs(f.margin) <= 1.0;
    });
    const severeFailures = failedTraits.filter((f) => {
      if (f.margin === null) return true;
      return Math.abs(f.margin) > 1.0;
    });

    // Allow at most 1 marginal failure; any severe failure = exclusion
    if (severeFailures.length > 0 || marginalFailures.length > 1) {
      return {
        tfq: 0,
        passes: false,
        failedTraits,
        traitComparisons: comparisons,
        reserveMargin: 0,
        analysisMode: "clinical",
      };
    }

    // 1 marginal failure tolerated — compute TFQ with penalty
    const reserveMargin = calculateReserveMargin(
      workerPostProfile,
      occupationDemands
    );

    // Apply 15-point penalty per tolerated marginal failure
    const penalty = marginalFailures.length * 15;
    const tfq = Math.min(100, Math.max(0, reserveMargin - penalty));

    return {
      tfq: Math.round(tfq * 100) / 100,
      passes: true,
      failedTraits: [], // not blocking in clinical mode
      traitComparisons: comparisons,
      reserveMargin: Math.round(reserveMargin * 100) / 100,
      analysisMode: "clinical",
      toleratedFailures: marginalFailures,
    };
  }

  // ─── All traits pass (both modes) ─────────────────────────────
  const reserveMargin = calculateReserveMargin(
    workerPostProfile,
    occupationDemands
  );

  const tfq = Math.min(100, Math.max(0, reserveMargin));

  return {
    tfq: Math.round(tfq * 100) / 100,
    passes: true,
    failedTraits: [],
    traitComparisons: comparisons,
    reserveMargin: Math.round(reserveMargin * 100) / 100,
    analysisMode: mode,
  };
}

// ─── O*NET Ability → Trait Mapping (extended) ────────────────────────

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
 * O*NET ability IDs for the extended trait mapping.
 * Maps ability IDs to trait keys for aptitudes and motor/sensory traits.
 *
 * For traits with multiple candidate abilities, we average matching values.
 */
const ONET_ABILITY_TRAIT_MAP: Record<TraitKey, string[]> = {
  spatialPerception: ["1.A.2.b.3", "1.A.1.f.1"],      // Spatial Orientation, Visualization
  formPerception: ["1.A.2.b.2"],                        // Perceptual Speed
  clericalPerception: ["1.A.2.b.4"],                    // Selective Attention
  motorCoordination: ["1.A.2.a.1", "1.A.2.a.3"],       // Control Precision, Response Orientation
  fingerDexterity: ["1.A.2.a.4"],                       // Finger Dexterity
  manualDexterity: ["1.A.2.a.5"],                       // Manual Dexterity
  eyeHandFoot: ["1.A.2.a.2"],                           // Arm-Hand Steadiness
  colorDiscrimination: ["1.A.2.c.2"],                   // Color Discrimination

  // These traits are not ability-based; covered by work context mapping below
  reasoning: [],
  math: [],
  language: [],
  strength: [],
  climbBalance: [],
  stoopKneel: [],
  reachHandle: [],
  talkHear: [],
  see: [],
  workLocation: [],
  extremeCold: [],
  extremeHeat: [],
  wetnessHumidity: [],
  noiseVibration: [],
  hazards: [],
  dustsFumes: [],
};

/**
 * O*NET work context names mapped to trait keys.
 * Each entry maps a trait to an array of work context name substrings
 * that should be averaged to derive the trait value.
 */
const ONET_WORK_CONTEXT_TRAIT_MAP: Record<string, string[]> = {
  climbBalance: [
    "Spend Time Climbing Ladders, Scaffolds, or Poles",
    "Spend Time Keeping or Regaining Balance",
  ],
  stoopKneel: [
    "Spend Time Kneeling, Crouching, Stooping, or Crawling",
    "Spend Time Bending or Twisting the Body",
  ],
  reachHandle: [
    "Spend Time Using Your Hands to Handle, Control, or Feel Objects, Tools, or Controls",
    "Spend Time Making Repetitive Motions",
  ],
  talkHear: [
    "Frequency of Decision Making",
    "Face-to-Face Discussions",
  ],
  see: [
    "Importance of Being Exact or Accurate",
  ],
  workLocation: [
    "Outdoors, Exposed to Weather",
  ],
  extremeCold: [
    "Very Hot or Cold Temperatures",
  ],
  extremeHeat: [
    "Very Hot or Cold Temperatures",
  ],
  wetnessHumidity: [
    "Exposed to Contaminants",
  ],
  noiseVibration: [
    "Sounds, Noise Levels Are Distracting or Uncomfortable",
    "Exposed to Whole Body Vibration",
  ],
  hazards: [
    "Exposed to Hazardous Conditions",
    "Exposed to Hazardous Equipment",
  ],
  dustsFumes: [
    "Exposed to Contaminants",
  ],
};

type OnetAbility = { id: string; name: string; value: number; level: number };
type OnetWorkContext = { id?: string; name: string; value?: number; level?: number; score?: number };

/**
 * Convert O*NET ability level (0-7 scale) to 0-4 trait scale.
 */
function normalizeONETLevel(level: number): number {
  return Math.round(Math.min(4, Math.max(0, (level / 7) * 4)) * 100) / 100;
}

/**
 * Normalize O*NET work context value to 0-4 trait scale.
 * Work context values are typically on a 1-5 scale.
 */
function normalizeONETWorkContext(val: number): number {
  // Map 1-5 → 0-4
  return Math.round(Math.min(4, Math.max(0, val - 1)) * 100) / 100;
}

/**
 * Derive a trait value from O*NET abilities data.
 * Averages matching abilities and normalizes to 0-4.
 */
function deriveTraitFromONETAbilities(
  traitKey: TraitKey,
  abilities: OnetAbility[] | null | undefined
): number | null {
  if (!abilities || !Array.isArray(abilities)) return null;

  const abilityIds = ONET_ABILITY_TRAIT_MAP[traitKey];
  if (!abilityIds || abilityIds.length === 0) return null;

  const matched: number[] = [];
  for (const abilityId of abilityIds) {
    const ab = abilities.find((a) => a.id === abilityId);
    if (ab && typeof ab.level === "number") {
      matched.push(normalizeONETLevel(ab.level));
    }
  }

  if (matched.length === 0) return null;
  const avg = matched.reduce((a, b) => a + b, 0) / matched.length;
  return Math.round(avg * 100) / 100;
}

/**
 * Derive a trait value from O*NET work context data.
 * Averages matching context items and normalizes to 0-4.
 */
function deriveTraitFromONETWorkContext(
  traitKey: string,
  workContext: OnetWorkContext[] | null | undefined
): number | null {
  if (!workContext || !Array.isArray(workContext)) return null;

  const contextNames = ONET_WORK_CONTEXT_TRAIT_MAP[traitKey];
  if (!contextNames || contextNames.length === 0) return null;

  const matched: number[] = [];
  for (const ctxName of contextNames) {
    const ctx = workContext.find((wc) =>
      wc.name && wc.name.toLowerCase().includes(ctxName.toLowerCase())
    );
    if (ctx) {
      const rawVal = ctx.level ?? ctx.score ?? ctx.value ?? null;
      if (typeof rawVal === "number") {
        matched.push(normalizeONETWorkContext(rawVal));
      }
    }
  }

  if (matched.length === 0) return null;

  // For extremeHeat specifically, we keep the same source but cap differently:
  // "Very Hot or Cold Temperatures" is shared between extremeCold and extremeHeat.
  // Both get the same derived value since the O*NET item doesn't distinguish.
  const avg = matched.reduce((a, b) => a + b, 0) / matched.length;
  return Math.round(avg * 100) / 100;
}

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

  const abilities = onetData.abilities as OnetAbility[] | null | undefined;
  if (!Array.isArray(abilities)) return null;

  const matched: number[] = [];
  for (const abilityId of abilityIds) {
    const ab = abilities.find((a) => a.id === abilityId);
    if (ab && typeof ab.level === "number") {
      matched.push(normalizeONETLevel(ab.level));
    }
  }

  if (matched.length === 0) return null;
  const avg = matched.reduce((a, b) => a + b, 0) / matched.length;
  return Math.round(avg * 100) / 100;
}

/**
 * Derive all possible trait values from O*NET abilities and work context.
 * Returns partial trait vector with only the traits we could derive.
 */
function deriveTraitsFromONET(
  onetData: Record<string, unknown> | null | undefined
): Partial<TraitVector> {
  if (!onetData) return {};

  const traits: Partial<TraitVector> = {};
  const abilities = onetData.abilities as OnetAbility[] | null | undefined;
  const workContext = onetData.workContext as OnetWorkContext[] | null | undefined;

  // Derive from abilities (aptitudes + motor/sensory)
  for (const key of TRAIT_KEYS) {
    const val = deriveTraitFromONETAbilities(key, abilities);
    if (val !== null) {
      traits[key] = val;
    }
  }

  // Derive from work context (physical + environmental)
  for (const key of Object.keys(ONET_WORK_CONTEXT_TRAIT_MAP)) {
    const traitKey = key as TraitKey;
    if (traits[traitKey] !== undefined && traits[traitKey] !== null) continue; // ability already set
    const val = deriveTraitFromONETWorkContext(key, workContext);
    if (val !== null) {
      traits[traitKey] = val;
    }
  }

  return traits;
}

// ─── DOT DPT-Based Fallback ──────────────────────────────────────────

/**
 * DOT Data/People/Things (DPT) worker function codes.
 * Lower values = higher complexity.
 *
 * Data: 0=Synthesizing, 1=Coordinating, 2=Analyzing, 3=Compiling,
 *       4=Computing, 5=Copying, 6=Comparing
 *
 * People: 0=Mentoring, 1=Negotiating, 2=Instructing, 3=Supervising,
 *         4=Diverting, 5=Persuading, 6=Speaking-Signaling, 7=Serving, 8=Taking Instructions
 *
 * Things: 0=Setting Up, 1=Precision Working, 2=Operating-Controlling,
 *         3=Driving-Operating, 4=Manipulating, 5=Tending, 6=Feeding-Offbearing, 7=Handling
 */
export function deriveDPTTraits(
  data: number | null | undefined,
  people: number | null | undefined,
  things: number | null | undefined
): Partial<TraitVector> {
  const traits: Partial<TraitVector> = {};

  // High Data function (low code = high complexity) → clerical/spatial aptitudes
  if (data !== null && data !== undefined) {
    // Data 0-3 = high complexity, 4-6 = low
    const dataLevel = Math.round(Math.min(4, Math.max(0, ((6 - data) / 6) * 4)) * 100) / 100;
    traits.clericalPerception = Math.round(Math.min(4, dataLevel * 0.8) * 100) / 100;
    traits.spatialPerception = Math.round(Math.min(4, dataLevel * 0.5) * 100) / 100;
    traits.formPerception = Math.round(Math.min(4, dataLevel * 0.4) * 100) / 100;
  }

  // High People function (low code = high complexity) → talk/hear
  if (people !== null && people !== undefined) {
    // People 0-3 = high interaction, 7-8 = minimal
    const peopleLevel = Math.round(Math.min(4, Math.max(0, ((8 - people) / 8) * 4)) * 100) / 100;
    traits.talkHear = Math.round(Math.min(4, peopleLevel * 0.9) * 100) / 100;
  }

  // High Things function (low code = high complexity) → motor/dexterity
  if (things !== null && things !== undefined) {
    // Things 0-1 = high precision, 6-7 = minimal
    const thingsLevel = Math.round(Math.min(4, Math.max(0, ((7 - things) / 7) * 4)) * 100) / 100;
    traits.motorCoordination = Math.round(Math.min(4, thingsLevel * 0.8) * 100) / 100;
    traits.fingerDexterity = Math.round(Math.min(4, thingsLevel * 0.7) * 100) / 100;
    traits.manualDexterity = Math.round(Math.min(4, thingsLevel * 0.7) * 100) / 100;
    traits.eyeHandFoot = Math.round(Math.min(4, thingsLevel * 0.5) * 100) / 100;
  }

  return traits;
}

// ─── SVP + Strength Default Profiles ─────────────────────────────────

/**
 * SVP bands for lookup: low (1-2), semi (3-4), skilled (5-6), high (7-9)
 */
function svpBand(svp: number): "low" | "semi" | "skilled" | "high" {
  if (svp <= 2) return "low";
  if (svp <= 4) return "semi";
  if (svp <= 6) return "skilled";
  return "high";
}

/**
 * Returns sensible default values for ALL 24 traits based on
 * the occupation's DOT strength code and SVP level.
 *
 * 5 strength levels x 4 SVP bands = 20 profiles.
 */
export function getStrengthSVPDefaults(
  strength: string | number,
  svp: number
): TraitVector {
  // Handle both string codes ("S","L","M","H","V") and numeric values (0-4)
  const numToCode: Record<number, string> = { 0: "S", 1: "L", 2: "M", 3: "H", 4: "V" };
  const raw = strength ?? "S";
  const s = (typeof raw === "number" ? (numToCode[raw] ?? "S") : (String(raw) || "S")).toUpperCase();
  const band = svpBand(svp);

  // Base profiles indexed by strength code
  const profiles: Record<string, Record<string, Record<TraitKey, number>>> = {
    S: { // Sedentary
      low:     { reasoning: 1, math: 0, language: 1, spatialPerception: 1, formPerception: 1, clericalPerception: 1, motorCoordination: 1, fingerDexterity: 2, manualDexterity: 1, eyeHandFoot: 0, colorDiscrimination: 0, strength: 0, climbBalance: 0, stoopKneel: 0, reachHandle: 2, talkHear: 2, see: 2, workLocation: 0, extremeCold: 0, extremeHeat: 0, wetnessHumidity: 0, noiseVibration: 0, hazards: 0, dustsFumes: 0 },
      semi:    { reasoning: 1, math: 1, language: 1, spatialPerception: 1, formPerception: 1, clericalPerception: 2, motorCoordination: 1, fingerDexterity: 2, manualDexterity: 1, eyeHandFoot: 0, colorDiscrimination: 0, strength: 0, climbBalance: 0, stoopKneel: 0, reachHandle: 2, talkHear: 2, see: 2, workLocation: 0, extremeCold: 0, extremeHeat: 0, wetnessHumidity: 0, noiseVibration: 0, hazards: 0, dustsFumes: 0 },
      skilled: { reasoning: 2, math: 1, language: 2, spatialPerception: 1, formPerception: 1, clericalPerception: 2, motorCoordination: 1, fingerDexterity: 2, manualDexterity: 1, eyeHandFoot: 0, colorDiscrimination: 1, strength: 0, climbBalance: 0, stoopKneel: 0, reachHandle: 2, talkHear: 3, see: 2, workLocation: 0, extremeCold: 0, extremeHeat: 0, wetnessHumidity: 0, noiseVibration: 0, hazards: 0, dustsFumes: 0 },
      high:    { reasoning: 3, math: 2, language: 3, spatialPerception: 2, formPerception: 1, clericalPerception: 2, motorCoordination: 1, fingerDexterity: 2, manualDexterity: 1, eyeHandFoot: 0, colorDiscrimination: 1, strength: 0, climbBalance: 0, stoopKneel: 0, reachHandle: 2, talkHear: 3, see: 3, workLocation: 0, extremeCold: 0, extremeHeat: 0, wetnessHumidity: 0, noiseVibration: 0, hazards: 0, dustsFumes: 0 },
    },
    L: { // Light
      low:     { reasoning: 1, math: 0, language: 1, spatialPerception: 1, formPerception: 1, clericalPerception: 1, motorCoordination: 1, fingerDexterity: 1, manualDexterity: 1, eyeHandFoot: 1, colorDiscrimination: 0, strength: 1, climbBalance: 0, stoopKneel: 1, reachHandle: 2, talkHear: 2, see: 2, workLocation: 0, extremeCold: 0, extremeHeat: 0, wetnessHumidity: 0, noiseVibration: 1, hazards: 0, dustsFumes: 0 },
      semi:    { reasoning: 1, math: 1, language: 1, spatialPerception: 1, formPerception: 1, clericalPerception: 1, motorCoordination: 2, fingerDexterity: 1, manualDexterity: 2, eyeHandFoot: 1, colorDiscrimination: 0, strength: 1, climbBalance: 0, stoopKneel: 1, reachHandle: 2, talkHear: 2, see: 2, workLocation: 0, extremeCold: 0, extremeHeat: 0, wetnessHumidity: 0, noiseVibration: 1, hazards: 0, dustsFumes: 0 },
      skilled: { reasoning: 2, math: 1, language: 2, spatialPerception: 1, formPerception: 1, clericalPerception: 1, motorCoordination: 2, fingerDexterity: 2, manualDexterity: 2, eyeHandFoot: 1, colorDiscrimination: 1, strength: 1, climbBalance: 1, stoopKneel: 1, reachHandle: 2, talkHear: 2, see: 2, workLocation: 1, extremeCold: 0, extremeHeat: 0, wetnessHumidity: 0, noiseVibration: 1, hazards: 1, dustsFumes: 0 },
      high:    { reasoning: 3, math: 2, language: 3, spatialPerception: 2, formPerception: 2, clericalPerception: 2, motorCoordination: 2, fingerDexterity: 2, manualDexterity: 2, eyeHandFoot: 1, colorDiscrimination: 1, strength: 1, climbBalance: 1, stoopKneel: 1, reachHandle: 2, talkHear: 3, see: 3, workLocation: 1, extremeCold: 0, extremeHeat: 0, wetnessHumidity: 0, noiseVibration: 1, hazards: 1, dustsFumes: 0 },
    },
    M: { // Medium
      low:     { reasoning: 1, math: 0, language: 1, spatialPerception: 1, formPerception: 1, clericalPerception: 0, motorCoordination: 2, fingerDexterity: 1, manualDexterity: 2, eyeHandFoot: 1, colorDiscrimination: 0, strength: 2, climbBalance: 1, stoopKneel: 2, reachHandle: 3, talkHear: 1, see: 2, workLocation: 1, extremeCold: 1, extremeHeat: 1, wetnessHumidity: 1, noiseVibration: 2, hazards: 1, dustsFumes: 1 },
      semi:    { reasoning: 1, math: 1, language: 1, spatialPerception: 1, formPerception: 1, clericalPerception: 0, motorCoordination: 2, fingerDexterity: 1, manualDexterity: 2, eyeHandFoot: 1, colorDiscrimination: 1, strength: 2, climbBalance: 1, stoopKneel: 2, reachHandle: 3, talkHear: 1, see: 2, workLocation: 1, extremeCold: 1, extremeHeat: 1, wetnessHumidity: 1, noiseVibration: 2, hazards: 2, dustsFumes: 1 },
      skilled: { reasoning: 2, math: 1, language: 2, spatialPerception: 2, formPerception: 1, clericalPerception: 0, motorCoordination: 2, fingerDexterity: 2, manualDexterity: 2, eyeHandFoot: 2, colorDiscrimination: 1, strength: 2, climbBalance: 2, stoopKneel: 2, reachHandle: 3, talkHear: 2, see: 2, workLocation: 2, extremeCold: 1, extremeHeat: 1, wetnessHumidity: 1, noiseVibration: 2, hazards: 2, dustsFumes: 2 },
      high:    { reasoning: 3, math: 2, language: 2, spatialPerception: 2, formPerception: 2, clericalPerception: 1, motorCoordination: 3, fingerDexterity: 2, manualDexterity: 3, eyeHandFoot: 2, colorDiscrimination: 1, strength: 2, climbBalance: 2, stoopKneel: 2, reachHandle: 3, talkHear: 2, see: 3, workLocation: 2, extremeCold: 1, extremeHeat: 1, wetnessHumidity: 1, noiseVibration: 2, hazards: 2, dustsFumes: 2 },
    },
    H: { // Heavy
      low:     { reasoning: 1, math: 0, language: 1, spatialPerception: 1, formPerception: 1, clericalPerception: 0, motorCoordination: 2, fingerDexterity: 1, manualDexterity: 2, eyeHandFoot: 2, colorDiscrimination: 0, strength: 3, climbBalance: 2, stoopKneel: 3, reachHandle: 3, talkHear: 1, see: 2, workLocation: 2, extremeCold: 2, extremeHeat: 2, wetnessHumidity: 2, noiseVibration: 3, hazards: 3, dustsFumes: 3 },
      semi:    { reasoning: 1, math: 1, language: 1, spatialPerception: 2, formPerception: 1, clericalPerception: 0, motorCoordination: 2, fingerDexterity: 1, manualDexterity: 2, eyeHandFoot: 2, colorDiscrimination: 1, strength: 3, climbBalance: 2, stoopKneel: 3, reachHandle: 3, talkHear: 1, see: 2, workLocation: 2, extremeCold: 2, extremeHeat: 2, wetnessHumidity: 2, noiseVibration: 3, hazards: 3, dustsFumes: 3 },
      skilled: { reasoning: 2, math: 1, language: 2, spatialPerception: 2, formPerception: 1, clericalPerception: 0, motorCoordination: 3, fingerDexterity: 1, manualDexterity: 3, eyeHandFoot: 2, colorDiscrimination: 1, strength: 3, climbBalance: 3, stoopKneel: 3, reachHandle: 3, talkHear: 2, see: 2, workLocation: 3, extremeCold: 2, extremeHeat: 2, wetnessHumidity: 2, noiseVibration: 3, hazards: 3, dustsFumes: 3 },
      high:    { reasoning: 3, math: 2, language: 2, spatialPerception: 3, formPerception: 2, clericalPerception: 1, motorCoordination: 3, fingerDexterity: 2, manualDexterity: 3, eyeHandFoot: 3, colorDiscrimination: 1, strength: 3, climbBalance: 3, stoopKneel: 3, reachHandle: 3, talkHear: 2, see: 3, workLocation: 3, extremeCold: 2, extremeHeat: 2, wetnessHumidity: 2, noiseVibration: 3, hazards: 3, dustsFumes: 3 },
    },
    V: { // Very Heavy
      low:     { reasoning: 1, math: 0, language: 1, spatialPerception: 1, formPerception: 1, clericalPerception: 0, motorCoordination: 3, fingerDexterity: 1, manualDexterity: 3, eyeHandFoot: 2, colorDiscrimination: 0, strength: 4, climbBalance: 3, stoopKneel: 3, reachHandle: 4, talkHear: 1, see: 2, workLocation: 3, extremeCold: 2, extremeHeat: 2, wetnessHumidity: 2, noiseVibration: 3, hazards: 3, dustsFumes: 3 },
      semi:    { reasoning: 1, math: 1, language: 1, spatialPerception: 2, formPerception: 1, clericalPerception: 0, motorCoordination: 3, fingerDexterity: 1, manualDexterity: 3, eyeHandFoot: 3, colorDiscrimination: 0, strength: 4, climbBalance: 3, stoopKneel: 3, reachHandle: 4, talkHear: 1, see: 2, workLocation: 3, extremeCold: 2, extremeHeat: 2, wetnessHumidity: 2, noiseVibration: 3, hazards: 3, dustsFumes: 3 },
      skilled: { reasoning: 2, math: 1, language: 2, spatialPerception: 2, formPerception: 1, clericalPerception: 0, motorCoordination: 3, fingerDexterity: 1, manualDexterity: 3, eyeHandFoot: 3, colorDiscrimination: 1, strength: 4, climbBalance: 3, stoopKneel: 4, reachHandle: 4, talkHear: 2, see: 2, workLocation: 3, extremeCold: 3, extremeHeat: 3, wetnessHumidity: 3, noiseVibration: 4, hazards: 4, dustsFumes: 4 },
      high:    { reasoning: 3, math: 2, language: 2, spatialPerception: 3, formPerception: 2, clericalPerception: 1, motorCoordination: 4, fingerDexterity: 2, manualDexterity: 4, eyeHandFoot: 3, colorDiscrimination: 1, strength: 4, climbBalance: 4, stoopKneel: 4, reachHandle: 4, talkHear: 2, see: 3, workLocation: 4, extremeCold: 3, extremeHeat: 3, wetnessHumidity: 3, noiseVibration: 4, hazards: 4, dustsFumes: 4 },
    },
  };

  const profile = profiles[s]?.[band] ?? profiles["S"]![band] ?? profiles["S"]!["low"]!;

  // Return a full TraitVector
  const vector: Partial<TraitVector> = {};
  for (const key of TRAIT_KEYS) {
    vector[key] = profile[key] ?? 1;
  }
  return vector as TraitVector;
}

// ─── SVP Proxy for GED traits ────────────────────────────────────────

/**
 * Get SVP-based floor values for reasoning, math, and language.
 * Used as a last resort when neither DOT GED nor O*NET data is available.
 *
 * Values are calibrated to match the DOT GED normalization formula:
 *   Normalized = (GED_Level - 1) × 0.8
 *
 * SVP-to-GED correspondence (DOT convention):
 *   SVP 1-2 → GED R=1-2, M=1,   L=1-2  → Normalized: R=0-0.8,  M=0,    L=0-0.8
 *   SVP 3-4 → GED R=3,   M=2-3, L=3    → Normalized: R=1.6,    M=0.8-1.6, L=1.6
 *   SVP 5-6 → GED R=4,   M=3-4, L=4    → Normalized: R=2.4,    M=1.6-2.4, L=2.4
 *   SVP 7+  → GED R=5-6, M=4-5, L=5-6  → Normalized: R=3.2-4.0, M=2.4-3.2, L=3.2-4.0
 */
function getSVPProxyGED(
  svp: number | null | undefined
): { reasoning: number; math: number; language: number } {
  const s = svp ?? 2; // default to SVP 2 (unskilled) if unknown
  if (s <= 2) return { reasoning: 0.8, math: 0.0, language: 0.8 };
  if (s <= 4) return { reasoning: 1.6, math: 1.2, language: 1.6 };
  if (s <= 6) return { reasoning: 2.4, math: 1.6, language: 2.4 };
  return { reasoning: 3.2, math: 2.4, language: 3.2 };
}

// ─── Fallback Chain Helper ───────────────────────────────────────────

/**
 * Apply the full fallback chain to fill null traits:
 *   1. O*NET abilities/work context derivation
 *   2. DOT DPT inference
 *   3. Strength x SVP defaults
 *   4. Conservative default (1) as absolute last resort
 *
 * Mutates demands and sources in place.
 */
function applyFallbackChain(
  demands: Partial<TraitVector>,
  sources: Partial<Record<string, TraitSource>>,
  onetData?: Record<string, unknown> | null,
  dotData?: Record<string, unknown> | null
): void {
  // Step 1: O*NET ability/work context derivation
  const onetDerived = deriveTraitsFromONET(onetData);
  for (const key of TRAIT_KEYS) {
    if (demands[key] === null || demands[key] === undefined) {
      const derived = onetDerived[key];
      if (derived !== null && derived !== undefined) {
        demands[key] = derived;
        sources[key] = "ONET";
      }
    }
  }

  // Step 2: DOT DPT inference
  const dptData = dotData?.data as number | null | undefined;
  const dptPeople = dotData?.people as number | null | undefined;
  const dptThings = dotData?.things as number | null | undefined;
  if (dptData !== null || dptPeople !== null || dptThings !== null) {
    const dptDerived = deriveDPTTraits(dptData ?? null, dptPeople ?? null, dptThings ?? null);
    for (const key of TRAIT_KEYS) {
      if (demands[key] === null || demands[key] === undefined) {
        const derived = dptDerived[key];
        if (derived !== null && derived !== undefined) {
          demands[key] = derived;
          sources[key] = "DPT_PROXY";
        }
      }
    }
  }

  // Step 3: Strength x SVP defaults
  const strengthCode = (dotData?.strength as string | number) ?? "S";
  const svpVal = (dotData?.svp as number) ?? (onetData?.svp as number) ?? 2;
  const svpDefaults = getStrengthSVPDefaults(strengthCode, svpVal);
  for (const key of TRAIT_KEYS) {
    if (demands[key] === null || demands[key] === undefined) {
      demands[key] = svpDefaults[key];
      sources[key] = "SVP_PROXY";
    }
  }

  // Step 4: Final guarantee — no trait should be null
  for (const key of TRAIT_KEYS) {
    if (demands[key] === null || demands[key] === undefined) {
      demands[key] = 1; // Conservative default: minimal demand
      sources[key] = "proxy";
    }
  }
}

// ─── Main Build Functions ────────────────────────────────────────────

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
 * Remaining traits are filled via the fallback chain:
 *   O*NET abilities/work context → DOT DPT inference → Strength×SVP defaults
 *
 * No trait will ever be null in the returned vector.
 */
export function buildDOTDemandVector(
  dotOcc: {
    gedR: number;
    gedM: number;
    gedL: number;
    strength: string;
    svp?: number;
    data?: number;
    people?: number;
    things?: number;
  },
  onetData?: Record<string, unknown> | null
): {
  demands: TraitVector;
  sources: Partial<Record<TraitKey, TraitSource>>;
  gedSource: "DOT" | "ONET" | "SVP_PROXY" | "mixed";
} {
  const demands: Partial<TraitVector> = {};
  const sources: Partial<Record<TraitKey, TraitSource>> = {};

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

  // ─── Apply fallback chain for remaining null traits ──────────
  const dotDataForFallback: Record<string, unknown> = {
    strength: dotOcc.strength,
    svp: dotOcc.svp,
    data: dotOcc.data,
    people: dotOcc.people,
    things: dotOcc.things,
  };

  applyFallbackChain(demands, sources, onetData, dotDataForFallback);

  return { demands: demands as TraitVector, sources, gedSource };
}

/**
 * Build an occupation demand vector from available data sources.
 * Priority: ORS > DOT > O*NET
 *
 * After the primary source chain, applies fallback derivation:
 *   O*NET abilities/work context → DOT DPT inference → Strength×SVP defaults
 *
 * No trait will ever be null in the returned vector.
 */
export function buildOccupationDemands(
  orsData?: Record<string, unknown> | null,
  dotData?: Record<string, unknown> | null,
  onetData?: Record<string, unknown> | null
): {
  demands: TraitVector;
  sources: Partial<Record<string, TraitSource>>;
  gedSource: "DOT" | "ONET" | "SVP_PROXY" | "mixed";
} {
  const demands: Partial<TraitVector> = {};
  const sources: Partial<Record<string, TraitSource>> = {};

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
    // Not available yet
    else {
      demands[key] = null;
      sources[key] = "proxy";
    }
  }

  // ─── Ensure reasoning/math/language are always filled ─────────
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

  // ─── Apply fallback chain for remaining null traits ──────────
  applyFallbackChain(demands, sources, onetData, dotData);

  return { demands: demands as TraitVector, sources, gedSource };
}
