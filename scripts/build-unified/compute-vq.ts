/**
 * VQ (Vocational Quotient) computation for unified occupations.
 *
 * McCroskey's 24-trait linear regression: VQ = 34.56707 + Σ(w_i × native_i)
 * Reference: McCroskey, B.J. (2011). VQS Manual and Quick Start Tutorial.
 */

import type { TraitDemand } from "./types";
import type { TraitKey } from "./compute-traits";

// ─── VQ Regression Coefficients ────────────────────────────────────

const VQ_INTERCEPT = 34.56707;

const VQ_WEIGHTS: Record<TraitKey, number> = {
  reasoning: 5.299567,
  math: 2.213121,
  language: 1.424168,
  spatialPerception: 2.241977,
  formPerception: 1.783972,
  clericalPerception: 1.95779,
  motorCoordination: 1.648707,
  fingerDexterity: 1.631036,
  manualDexterity: 2.126616,
  eyeHandFoot: 1.403101,
  colorDiscrimination: 1.431217,
  strength: 1.84953,
  climbing: 0.774892,
  stooping: -0.165864,
  reaching: 0.776669,
  talking: 4.542681,
  hearing: 0, // hearing is bundled into talking in VQS
  seeing: 0.201044,
  workLocation: 1.470938,
  cold: 0.330026,
  heat: 0.504727,
  wetness: 0.371165,
  noise: 1.217675,
  hazards: -0.200072,
};

// VQS Default Profile (native DOT scale) for null substitution
const VQS_DEFAULT_NATIVE: Record<TraitKey, number> = {
  reasoning: 3, math: 2, language: 2,
  spatialPerception: 2, formPerception: 3, clericalPerception: 2,
  motorCoordination: 3, fingerDexterity: 2, manualDexterity: 3,
  eyeHandFoot: 2, colorDiscrimination: 2,
  strength: 2, climbing: 0, stooping: 0, reaching: 1,
  talking: 0, hearing: 0, seeing: 1,
  workLocation: 2, cold: 0, heat: 0, wetness: 0,
  noise: 1, hazards: 0,
};

// ─── Scale Conversion ──────────────────────────────────────────────

type ScaleGroup = "ged" | "apt" | "pd1" | "pdBinary" | "ec1" | "ecBinary";

const TRAIT_SCALE: Record<TraitKey, ScaleGroup> = {
  reasoning: "ged", math: "ged", language: "ged",
  spatialPerception: "apt", formPerception: "apt", clericalPerception: "apt",
  motorCoordination: "apt", fingerDexterity: "apt", manualDexterity: "apt",
  eyeHandFoot: "apt", colorDiscrimination: "apt",
  strength: "pd1",
  climbing: "pdBinary", stooping: "pdBinary", reaching: "pdBinary",
  talking: "pdBinary", hearing: "pdBinary", seeing: "pdBinary",
  workLocation: "ec1",
  cold: "ecBinary", heat: "ecBinary", wetness: "ecBinary",
  noise: "ecBinary", hazards: "ecBinary",
};

function toNativeScale(key: TraitKey, normalized: number): number {
  switch (TRAIT_SCALE[key]) {
    case "ged":     return Math.round((normalized / 4) * 5) + 1;  // 0-4 → 1-6
    case "apt":
    case "pd1":     return Math.round((normalized / 4) * 4) + 1;  // 0-4 → 1-5
    case "pdBinary":
    case "ecBinary": return normalized >= 2 ? 1 : 0;              // 0-4 → 0-1
    case "ec1":     return Math.round((normalized / 4) * 2) + 1;  // 0-4 → 1-3
  }
}

// ─── VQ Computation ────────────────────────────────────────────────

export interface VQResult {
  vqScore: number;  // 68-158
  vqBand: number;   // 1-4
}

export function computeVQ(traits: Record<TraitKey, TraitDemand>): VQResult {
  let score = VQ_INTERCEPT;

  for (const key of Object.keys(VQ_WEIGHTS) as TraitKey[]) {
    const weight = VQ_WEIGHTS[key];
    if (weight === 0) continue;

    const trait = traits[key];
    let nativeVal: number;

    if (!trait || trait.source === "proxy") {
      nativeVal = VQS_DEFAULT_NATIVE[key];
    } else {
      nativeVal = toNativeScale(key, trait.value);
    }

    score += weight * nativeVal;
  }

  const clamped = Math.round(Math.max(68, Math.min(158, score)) * 100) / 100;
  const band = clamped < 100 ? 1 : clamped < 109 ? 2 : clamped < 144 ? 3 : 4;

  return { vqScore: clamped, vqBand: band };
}
