/**
 * MVQS Vocational Quotient (VQ) Computation
 *
 * The Vocational Quotient is a standardized index of overall job difficulty
 * derived from the 24 most vocationally significant worker trait job requirements.
 *
 * VQ distribution: mean = 100, SD = 15, range ≈ 68 – 158
 *
 * Methodology: Linear regression using 24 trait weights + intercept.
 * Coefficients recovered from MVQS 2016 database (Vocationology, Inc.).
 *
 * Reference: McCroskey, B.J. (2011). MVQS Manual and Quick Start Tutorial.
 */

import { type TraitKey, type TraitVector, TRAIT_KEYS } from "./traits";

// ─── MVQS VQ Regression Coefficients ─────────────────────────────────────────
// Source: MVQS codebase server.js lines 175-179
// Intercept + 24 trait weights in MVQS native-scale order
const VQ_INTERCEPT = 34.56707;

// Weights correspond to MVQS trait order:
// GEDR, GEDM, GEDL, APTS, APTP, APTQ, APTK, APTF, APTM, APTE, APTC,
// PD1(Strength), PD2(Climb/Bal), PD3(Stoop/Kneel), PD4(Reach/Handle),
// PD5(Talk/Hear), PD6(See), EC1(Weather), EC2(Cold), EC3(Heat),
// EC4(Damp), EC5(Noise), EC6(Hazards), EC7(Dust)
const VQ_WEIGHTS: readonly number[] = Object.freeze([
  5.299567, 2.213121, 1.424168, 2.241977, 1.783972, 1.95779, 1.648707,
  1.631036, 2.126616, 1.403101, 1.431217, 1.84953, 0.774892, -0.165864,
  0.776669, 4.542681, 0.201044, 1.470938, 0.330026, 0.504727, 0.371165,
  1.217675, -0.200072, 0.298293,
]);

// Maps our TraitKey order → MVQS weight index (same ordering, verified)
const TRAIT_KEY_TO_WEIGHT_INDEX: Record<TraitKey, number> = {
  reasoning: 0,
  math: 1,
  language: 2,
  spatialPerception: 3,
  formPerception: 4,
  clericalPerception: 5,
  motorCoordination: 6,
  fingerDexterity: 7,
  manualDexterity: 8,
  eyeHandFoot: 9,
  colorDiscrimination: 10,
  strength: 11,
  climbBalance: 12,
  stoopKneel: 13,
  reachHandle: 14,
  talkHear: 15,
  see: 16,
  workLocation: 17,
  extremeCold: 18,
  extremeHeat: 19,
  wetnessHumidity: 20,
  noiseVibration: 21,
  hazards: 22,
  dustsFumes: 23,
};

// MVQS Default Profile (native scale) for null substitution
// Source: MVQS traits.js DEFAULT_PROFILE = [3,2,2,2,3,2,3,2,3,2,2,2,0,0,1,0,1,2,0,0,0,1,0,0]
const MVQS_DEFAULT_PROFILE: readonly number[] = Object.freeze([
  3, 2, 2, 2, 3, 2, 3, 2, 3, 2, 2, 2, 0, 0, 1, 0, 1, 2, 0, 0, 0, 1, 0, 0,
]);

// ─── Trait Scale Definitions ─────────────────────────────────────────────────

type TraitScaleGroup = "ged" | "apt" | "pd1" | "pdBinary" | "ec1" | "ecBinary";

const TRAIT_SCALE: Record<TraitKey, TraitScaleGroup> = {
  reasoning: "ged",
  math: "ged",
  language: "ged",
  spatialPerception: "apt",
  formPerception: "apt",
  clericalPerception: "apt",
  motorCoordination: "apt",
  fingerDexterity: "apt",
  manualDexterity: "apt",
  eyeHandFoot: "apt",
  colorDiscrimination: "apt",
  strength: "pd1",
  climbBalance: "pdBinary",
  stoopKneel: "pdBinary",
  reachHandle: "pdBinary",
  talkHear: "pdBinary",
  see: "pdBinary",
  workLocation: "ec1",
  extremeCold: "ecBinary",
  extremeHeat: "ecBinary",
  wetnessHumidity: "ecBinary",
  noiseVibration: "ecBinary",
  hazards: "ecBinary",
  dustsFumes: "ecBinary",
};

/**
 * Reverse-map PVQ-TM normalized (0-4) value back to MVQS native DOT scale.
 *
 * PVQ-TM → MVQS native:
 * - GED (Reasoning/Math/Language):  0-4 → 1-6
 * - APT (8 aptitudes):              0-4 → 1-5
 * - PD1 (Strength):                 0-4 → 1-5
 * - PD2-PD6 (binary physical):      0-4 → 0-1
 * - EC1 (Weather):                  0-4 → 1-3
 * - EC2-EC7 (binary environmental): 0-4 → 0-1
 */
function toMvqsNativeScale(key: TraitKey, normalized: number): number {
  const scale = TRAIT_SCALE[key];
  switch (scale) {
    case "ged":
      // 0-4 → 1-6 (6 levels)
      return Math.round((normalized / 4) * 5) + 1;
    case "apt":
    case "pd1":
      // 0-4 → 1-5 (5 levels)
      return Math.round((normalized / 4) * 4) + 1;
    case "pdBinary":
    case "ecBinary":
      // 0-4 → 0-1 (binary)
      return normalized >= 2 ? 1 : 0;
    case "ec1":
      // 0-4 → 1-3 (3 levels)
      return Math.round((normalized / 4) * 2) + 1;
  }
}

// ─── VQ Band Structure ───────────────────────────────────────────────────────

export interface VQBand {
  band: 1 | 2 | 3 | 4;
  min: number;
  max: number;
  label: string;
  percentileRange: string;
  jobPct: number;
}

export const VQ_BANDS: readonly VQBand[] = Object.freeze([
  {
    band: 1,
    min: 68,
    max: 99.99,
    label: "Below Average to Mid-Average",
    percentileRange: "1st–50th",
    jobPct: 50,
  },
  {
    band: 2,
    min: 100,
    max: 108.99,
    label: "Mid-Average to High-Average",
    percentileRange: "50th–67th",
    jobPct: 17,
  },
  {
    band: 3,
    min: 109,
    max: 143.99,
    label: "High-Average to Very-High",
    percentileRange: "67th–99th",
    jobPct: 32,
  },
  {
    band: 4,
    min: 144,
    max: 158,
    label: "Extremely High",
    percentileRange: "99th–100th",
    jobPct: 1,
  },
]);

// ─── VQ Result Interface ─────────────────────────────────────────────────────

export interface VQResult {
  vq: number; // Raw VQ score (clamped 68-158)
  band: 1 | 2 | 3 | 4;
  bandLabel: string;
  traitContributions: Partial<Record<TraitKey, number>>; // Per-trait weighted values
  nullTraitCount: number; // How many traits used default substitution
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Classify a VQ score into one of the 4 MVQS bands.
 */
export function classifyVQBand(vq: number): 1 | 2 | 3 | 4 {
  if (vq < 100) return 1;
  if (vq < 109) return 2;
  if (vq < 144) return 3;
  return 4;
}

/**
 * Compute the MVQS Vocational Quotient for an occupation from its trait demand vector.
 *
 * The VQ regression was built on MVQS native DOT scales, so we reverse-map
 * PVQ-TM's 0-4 normalized values before applying the regression weights.
 */
export function computeVQ(demands: TraitVector): VQResult {
  let score = VQ_INTERCEPT;
  const contributions: Partial<Record<TraitKey, number>> = {};
  let nullCount = 0;

  for (const key of TRAIT_KEYS) {
    const idx = TRAIT_KEY_TO_WEIGHT_INDEX[key];
    const weight = VQ_WEIGHTS[idx];
    const normalizedVal = demands[key];

    let nativeVal: number;
    if (normalizedVal === null || normalizedVal === undefined) {
      // Use MVQS default profile for missing traits
      nativeVal = MVQS_DEFAULT_PROFILE[idx];
      nullCount++;
    } else {
      nativeVal = toMvqsNativeScale(key, normalizedVal);
    }

    const contribution = weight * nativeVal;
    score += contribution;
    contributions[key] = Math.round(contribution * 1000) / 1000;
  }

  // Clamp to valid VQ range
  const clamped = Math.round(Math.max(68, Math.min(158, score)) * 100) / 100;
  const band = classifyVQBand(clamped);
  const bandDef = VQ_BANDS.find((b) => b.band === band)!;

  return {
    vq: clamped,
    band,
    bandLabel: bandDef.label,
    traitContributions: contributions,
    nullTraitCount: nullCount,
  };
}

/**
 * Get band definition for a given VQ score.
 */
export function getVQBandInfo(vq: number): VQBand {
  const band = classifyVQBand(vq);
  return VQ_BANDS.find((b) => b.band === band)!;
}
