/**
 * PVQ-TM 24-Trait System
 *
 * The 24-trait vector is MVQS-compatible and covers:
 * - 6 Aptitude traits (Reasoning, Math, Language, Spatial, Form, Clerical)
 * - 11 Physical traits (Motor Coord, Finger Dex, Manual Dex, Eye-Hand-Foot,
 *   Color Discrim, Strength, Climb/Balance, Stoop/Kneel, Reach/Handle,
 *   Talk/Hear, See)
 * - 7 Environmental traits (Work Location, Extreme Cold, Extreme Heat,
 *   Wetness/Humidity, Noise/Vibration, Hazards, Dusts/Fumes)
 *
 * All traits are normalized to a 0-4 scale:
 * 0 = Not Present / Sedentary / None
 * 1 = Seldom / Light / Low
 * 2 = Occasionally / Medium / Moderate
 * 3 = Frequently / Heavy / High
 * 4 = Constantly / Very Heavy / Extreme
 */

export const TRAIT_KEYS = [
  "reasoning",
  "math",
  "language",
  "spatialPerception",
  "formPerception",
  "clericalPerception",
  "motorCoordination",
  "fingerDexterity",
  "manualDexterity",
  "eyeHandFoot",
  "colorDiscrimination",
  "strength",
  "climbBalance",
  "stoopKneel",
  "reachHandle",
  "talkHear",
  "see",
  "workLocation",
  "extremeCold",
  "extremeHeat",
  "wetnessHumidity",
  "noiseVibration",
  "hazards",
  "dustsFumes",
] as const;

export type TraitKey = (typeof TRAIT_KEYS)[number];

export type TraitVector = Record<TraitKey, number | null>;

export const TRAIT_GROUPS = {
  aptitudes: [
    "reasoning",
    "math",
    "language",
    "spatialPerception",
    "formPerception",
    "clericalPerception",
  ] as TraitKey[],
  physical: [
    "motorCoordination",
    "fingerDexterity",
    "manualDexterity",
    "eyeHandFoot",
    "colorDiscrimination",
    "strength",
    "climbBalance",
    "stoopKneel",
    "reachHandle",
    "talkHear",
    "see",
  ] as TraitKey[],
  environmental: [
    "workLocation",
    "extremeCold",
    "extremeHeat",
    "wetnessHumidity",
    "noiseVibration",
    "hazards",
    "dustsFumes",
  ] as TraitKey[],
};

export const TRAIT_LABELS: Record<TraitKey, string> = {
  reasoning: "Reasoning",
  math: "Math",
  language: "Language",
  spatialPerception: "Spatial Perception",
  formPerception: "Form Perception",
  clericalPerception: "Clerical Perception",
  motorCoordination: "Motor Coordination",
  fingerDexterity: "Finger Dexterity",
  manualDexterity: "Manual Dexterity",
  eyeHandFoot: "Eye-Hand-Foot Coord.",
  colorDiscrimination: "Color Discrimination",
  strength: "Strength",
  climbBalance: "Climb/Balance",
  stoopKneel: "Stoop/Kneel",
  reachHandle: "Reach/Handle",
  talkHear: "Talk/Hear",
  see: "See",
  workLocation: "Work Location",
  extremeCold: "Extreme Cold",
  extremeHeat: "Extreme Heat",
  wetnessHumidity: "Wetness/Humidity",
  noiseVibration: "Noise/Vibration",
  hazards: "Hazards",
  dustsFumes: "Dusts/Fumes",
};

export const STRENGTH_LABELS: Record<number, string> = {
  0: "Sedentary",
  1: "Light",
  2: "Medium",
  3: "Heavy",
  4: "Very Heavy",
};

export const FREQUENCY_LABELS: Record<number, string> = {
  0: "Not Present",
  1: "Seldom",
  2: "Occasionally",
  3: "Frequently",
  4: "Constantly",
};

// ─── Normalization Functions ───────────────────────────────────────────

/**
 * Normalize DOT aptitude (1-5 scale, where 1=highest) to 0-4 scale.
 * DOT: 1=top10%, 2=top33%, 3=middle33%, 4=lower33%, 5=bottom10%
 * Normalized: 4=highest demand, 0=lowest demand
 */
export function normalizeDOTAptitude(dotValue: number): number {
  return Math.max(0, 5 - dotValue);
}

/**
 * Normalize DOT physical demand frequency code to 0-4 scale.
 * DOT uses: N=Not Present, O=Occasionally, F=Frequently, C=Constantly
 */
export function normalizeDOTPhysical(code: string): number {
  const map: Record<string, number> = {
    N: 0,
    S: 1,
    O: 2,
    F: 3,
    C: 4,
  };
  return map[code.toUpperCase()] ?? 0;
}

/**
 * Normalize DOT strength code to 0-4 scale.
 * DOT: S=Sedentary, L=Light, M=Medium, H=Heavy, V=Very Heavy
 */
export function normalizeDOTStrength(code: string): number {
  const map: Record<string, number> = {
    S: 0,
    L: 1,
    M: 2,
    H: 3,
    V: 4,
  };
  return map[code.toUpperCase()] ?? 0;
}

/**
 * Normalize DOT GED level (1-6) to 0-4 scale.
 * Maps: 1→0, 2→1, 3→2, 4→2, 5→3, 6→4
 */
export function normalizeDOTGED(gedLevel: number): number {
  const map: Record<number, number> = {
    1: 0,
    2: 1,
    3: 2,
    4: 2,
    5: 3,
    6: 4,
  };
  return map[gedLevel] ?? 0;
}

/**
 * Normalize O*NET importance/level score (0-100 or 1-7 scale) to 0-4.
 * O*NET typically uses 0-100 importance scores.
 */
export function normalizeONETScore(score: number, maxScale = 100): number {
  const normalized = (score / maxScale) * 4;
  return Math.round(Math.min(4, Math.max(0, normalized)));
}

/**
 * Normalize ORS frequency estimate to 0-4 scale.
 * ORS reports percentages for frequency categories.
 * We use the most common frequency category.
 */
export function normalizeORSFrequency(orsEstimate: {
  notPresent?: number;
  seldom?: number;
  occasionally?: number;
  frequently?: number;
  constantly?: number;
}): number {
  const categories = [
    { level: 0, pct: orsEstimate.notPresent ?? 0 },
    { level: 1, pct: orsEstimate.seldom ?? 0 },
    { level: 2, pct: orsEstimate.occasionally ?? 0 },
    { level: 3, pct: orsEstimate.frequently ?? 0 },
    { level: 4, pct: orsEstimate.constantly ?? 0 },
  ];
  // Return the most common frequency level
  return categories.reduce((max, c) => (c.pct > max.pct ? c : max)).level;
}

// ─── Trait Comparison ──────────────────────────────────────────────────

export interface TraitComparison {
  trait: TraitKey;
  label: string;
  workerCapacity: number | null;
  occupationDemand: number | null;
  margin: number | null; // positive = surplus, negative = deficit
  passes: boolean;
  source: "ORS" | "DOT" | "ONET" | "proxy";
}

/**
 * Compare a worker's post-profile against an occupation's demands.
 * Returns comparison for each of the 24 traits.
 */
export function compareTraits(
  workerProfile: TraitVector,
  occupationDemands: TraitVector,
  sources?: Partial<Record<TraitKey, "ORS" | "DOT" | "ONET" | "proxy">>
): TraitComparison[] {
  return TRAIT_KEYS.map((trait) => {
    const capacity = workerProfile[trait];
    const demand = occupationDemands[trait];

    let margin: number | null = null;
    let passes = true;

    if (capacity !== null && demand !== null) {
      // For aptitudes: worker must meet or exceed demand level
      // For physical: worker capacity must meet or exceed demand
      // For environmental: worker tolerance must meet or exceed exposure
      margin = capacity - demand;
      passes = margin >= 0;
    }

    return {
      trait,
      label: TRAIT_LABELS[trait],
      workerCapacity: capacity,
      occupationDemand: demand,
      margin,
      passes,
      source: sources?.[trait] ?? "DOT",
    };
  });
}

/**
 * Check if a worker passes all 24 traits for an occupation.
 * Any single failed trait means the occupation is excluded.
 */
export function passesAllTraits(
  workerProfile: TraitVector,
  occupationDemands: TraitVector
): boolean {
  return compareTraits(workerProfile, occupationDemands).every((c) => c.passes);
}

/**
 * Calculate the reserve margin across all 24 traits.
 * This becomes the basis for TFQ scoring among surviving occupations.
 * Returns average margin as a percentage of the 0-4 scale.
 */
export function calculateReserveMargin(
  workerProfile: TraitVector,
  occupationDemands: TraitVector
): number {
  const comparisons = compareTraits(workerProfile, occupationDemands);
  const ratedTraits = comparisons.filter(
    (c) => c.margin !== null
  );

  if (ratedTraits.length === 0) return 0;

  const totalMargin = ratedTraits.reduce(
    (sum, c) => sum + (c.margin ?? 0),
    0
  );

  // Normalize: max possible margin is 4 per trait
  return (totalMargin / (ratedTraits.length * 4)) * 100;
}

/**
 * Extract a TraitVector from a WorkerProfile database record.
 */
export function profileToTraitVector(profile: Record<string, unknown>): TraitVector {
  const vector: Partial<TraitVector> = {};
  for (const key of TRAIT_KEYS) {
    const val = profile[key];
    vector[key] = typeof val === "number" ? val : null;
  }
  return vector as TraitVector;
}
