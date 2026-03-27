/**
 * O*NET Work Context to PVQ-TM Trait Mapping
 *
 * Provides explicit mappings from O*NET Work Context element IDs
 * to PVQ-TM 24-trait system values (0-4 scale).
 *
 * O*NET Work Context items use a 1-5 Likert scale for most items.
 * This module converts those to the 0-4 demand scale used by PVQ-TM.
 *
 * CONSERVATIVE APPROACH: All conversions err on the side of lower
 * demand estimates. In litigation contexts, overestimating demands
 * could incorrectly exclude occupations from a viable set, which
 * is more harmful than slight underestimation.
 *
 * Daubert compliance note: These mappings are derived from the
 * structural correspondence between O*NET taxonomy elements and
 * DOL/BLS occupational requirement categories. The Work Context
 * taxonomy (4.C.*) directly measures workplace conditions that
 * correspond to ORS physical demand and environmental condition
 * categories.
 */

import type { TraitKey } from "./traits";

// ─── Types ───────────────────────────────────────────────────────────

export interface ONETContextTraitMapping {
  /** PVQ-TM trait key this context element maps to */
  trait: TraitKey;
  /**
   * Convert O*NET importance (1-5) and level (1-5 or 1-7) to 0-4 trait scale.
   * When only one score is available, the other defaults to the midpoint.
   */
  formula: (importance: number, level?: number) => number;
  /** Human-readable explanation for Daubert transparency */
  notes: string;
}

// ─── Conversion Helpers ──────────────────────────────────────────────

/**
 * Conservative linear mapping from O*NET 1-5 scale to 0-4 trait scale.
 * Applies a 0.8 multiplier to err conservative (lower demand).
 *
 * Maps: 1→0, 2→0.64, 3→1.28, 4→1.92, 5→2.56
 *
 * The conservative factor means that only the highest O*NET ratings
 * approach "Occasionally" (2) on the trait scale. This prevents
 * overestimation of physical demands from survey-based data.
 */
function conservativeMap15(value: number): number {
  const raw = Math.max(0, (value - 1)) * (4 / 4); // 1-5 → 0-4
  const conservative = raw * 0.8; // 20% reduction for conservatism
  return Math.round(Math.min(4, Math.max(0, conservative)) * 100) / 100;
}

/**
 * Direct linear mapping from O*NET 1-5 scale to 0-4 trait scale.
 * Used for traits where the O*NET scale aligns well with ORS categories.
 *
 * Maps: 1→0, 2→1, 3→2, 4→3, 5→4
 */
function directMap15(value: number): number {
  return Math.round(Math.min(4, Math.max(0, value - 1)) * 100) / 100;
}

/**
 * Inverse mapping: high O*NET value → LOW trait demand.
 * Used for traits like "Spend Time Sitting" which inversely
 * indicates strength demand (more sitting = less strength needed).
 *
 * Maps: 1→3.2, 2→2.4, 3→1.6, 4→0.8, 5→0
 */
function inverseMap15(value: number): number {
  const raw = Math.max(0, (5 - value)) * (4 / 4);
  const conservative = raw * 0.8;
  return Math.round(Math.min(4, Math.max(0, conservative)) * 100) / 100;
}

/**
 * Binary-threshold mapping for environmental conditions.
 * O*NET ratings of 3+ (moderate or higher) map to trait level 1 (Seldom).
 * Ratings of 4+ map to 2 (Occasionally). Ratings of 5 map to 3 (Frequently).
 *
 * This is very conservative — environmental conditions are rarely
 * rated "Constantly" from work context data alone.
 */
function environmentalMap(value: number): number {
  if (value >= 5) return 3;
  if (value >= 4) return 2;
  if (value >= 3) return 1;
  return 0;
}

/**
 * Average of importance and level (both 0-100 if pre-normalized),
 * mapped to 0-4. If level is not available, uses importance alone
 * with a penalty.
 */
function importanceLevelAvg(importance: number, level?: number): number {
  if (level !== undefined && level !== null) {
    // Both available: weighted average (level weighted more heavily)
    const avg = importance * 0.3 + level * 0.7;
    return conservativeMap15(avg);
  }
  // Only importance: apply extra conservatism
  return conservativeMap15(importance) * 0.7;
}

// ─── O*NET Work Context Element ID Mappings ──────────────────────────

/**
 * Mapping from O*NET Work Context element IDs to PVQ-TM traits.
 *
 * Element ID format: 4.C.X.X.X.X where:
 *   4.C.2.d = Physical work conditions - body positioning
 *   4.C.2.e = Physical work conditions - environmental
 *   4.C.3   = Structural job characteristics
 *
 * Multiple elements can map to the same trait. When this occurs,
 * the proxy system takes the maximum value (conservative for
 * physical demands, since the highest demand dominates).
 */
export const ONET_CONTEXT_TO_TRAIT: Record<string, ONETContextTraitMapping> = {
  // ─── Physical: Body Positioning ──────────────────────────────

  "4.C.2.d.1.a": {
    trait: "strength",
    formula: (imp) => conservativeMap15(imp),
    notes: "Spend Time Standing — standing frequency indicates minimum strength demand. Conservative: standing alone does not require Medium+ strength.",
  },

  "4.C.2.d.1.b": {
    trait: "strength",
    formula: (imp) => conservativeMap15(imp),
    notes: "Spend Time Walking and Running — ambulatory demand contributes to strength assessment. Also informs climbBalance via separate entry.",
  },

  "4.C.2.d.1.c": {
    trait: "strength",
    formula: (imp) => inverseMap15(imp),
    notes: "Spend Time Sitting — inverse indicator of strength. High sitting time suggests Sedentary or Light strength. Inverted and conservative.",
  },

  "4.C.2.d.1.d": {
    trait: "climbBalance",
    formula: (imp) => conservativeMap15(imp),
    notes: "Spend Time Climbing Ladders, Scaffolds, or Poles — direct indicator of climbing demand. Conservative mapping.",
  },

  "4.C.2.d.1.e": {
    trait: "stoopKneel",
    formula: (imp) => conservativeMap15(imp),
    notes: "Spend Time Kneeling, Crouching, Stooping, or Crawling — direct indicator of low posture demand.",
  },

  "4.C.2.d.1.f": {
    trait: "stoopKneel",
    formula: (imp) => conservativeMap15(imp),
    notes: "Spend Time Bending or Twisting the Body — contributes to stoop/kneel assessment. Max of this and 4.C.2.d.1.e used.",
  },

  "4.C.2.d.1.g": {
    trait: "fingerDexterity",
    formula: (imp) => conservativeMap15(imp),
    notes: "Spend Time Making Repetitive Motions — repetitive motion indicates fine manipulation demand. Also contributes to manualDexterity.",
  },

  "4.C.2.d.1.i": {
    trait: "reachHandle",
    formula: (imp) => conservativeMap15(imp),
    notes: "Spend Time Using Your Hands to Handle, Control, or Feel Objects, Tools, or Controls — direct reach/handle indicator.",
  },

  // ─── Physical: Environmental ─────────────────────────────────

  "4.C.2.e.1.a": {
    trait: "workLocation",
    formula: (imp) => conservativeMap15(imp),
    notes: "Outdoors, Exposed to Weather — direct indicator of outdoor work location. Higher values indicate more outdoor exposure.",
  },

  "4.C.2.e.1.b": {
    trait: "workLocation",
    formula: (imp) => conservativeMap15(imp),
    notes: "Outdoors, Under Cover — partial outdoor exposure. Contributes to work location but with less environmental exposure than 4.C.2.e.1.a.",
  },

  "4.C.2.e.1.c": {
    trait: "workLocation",
    formula: (imp) => inverseMap15(imp),
    notes: "Indoors, Environmentally Controlled — inverse indicator. High indoor controlled = low outdoor exposure = low workLocation demand.",
  },

  "4.C.2.e.2.a_heat": {
    trait: "extremeHeat",
    formula: (imp) => environmentalMap(imp),
    notes: "Very Hot or Cold Temperatures — mapped to extremeHeat. O*NET does not distinguish hot from cold, so the same source feeds both traits conservatively.",
  },

  "4.C.2.e.2.a_cold": {
    trait: "extremeCold",
    formula: (imp) => environmentalMap(imp),
    notes: "Very Hot or Cold Temperatures — mapped to extremeCold. Same element as extremeHeat; both get the environmental threshold mapping.",
  },

  "4.C.2.e.2.b": {
    trait: "see",
    formula: (imp) => environmentalMap(imp),
    notes: "Extremely Bright or Inadequate Lighting — lighting conditions indicate visual demand. Conservative: only extreme ratings produce non-zero values.",
  },

  "4.C.2.e.2.c": {
    trait: "dustsFumes",
    formula: (imp) => environmentalMap(imp),
    notes: "Exposed to Contaminants — direct indicator of dust/fume exposure. Environmental threshold mapping.",
  },

  "4.C.2.e.2.d": {
    trait: "noiseVibration",
    formula: (imp) => environmentalMap(imp),
    notes: "Exposed to Whole Body Vibration — direct vibration indicator. Combined with noise (4.C.2.e.3.a) via max.",
  },

  "4.C.2.e.2.e": {
    trait: "hazards",
    formula: (imp) => environmentalMap(imp),
    notes: "Exposed to Hazardous Conditions — direct hazard indicator. Max of this and equipment hazards (4.C.2.e.2.f).",
  },

  "4.C.2.e.2.f": {
    trait: "hazards",
    formula: (imp) => environmentalMap(imp),
    notes: "Exposed to Hazardous Equipment — equipment-specific hazard. Combined with conditions (4.C.2.e.2.e) via max.",
  },

  "4.C.2.e.3.a": {
    trait: "noiseVibration",
    formula: (imp) => environmentalMap(imp),
    notes: "Sounds, Noise Levels Are Distracting or Uncomfortable — noise level indicator. Combined with vibration (4.C.2.e.2.d) via max.",
  },

  // ─── Structural: Equipment ───────────────────────────────────

  "4.C.3.d.4": {
    trait: "motorCoordination",
    formula: (imp) => conservativeMap15(imp),
    notes: "Pace Determined by Speed of Equipment — equipment-paced work indicates motor coordination demand.",
  },
};

// ─── Additional mappings for elements that map to secondary traits ──

/**
 * Some O*NET elements contribute to multiple traits.
 * This table lists secondary mappings that are applied after
 * the primary mapping, using the same element value.
 */
export const ONET_CONTEXT_SECONDARY_TRAITS: Record<string, {
  trait: TraitKey;
  formula: (importance: number, level?: number) => number;
}> = {
  // Walking/Running also indicates climb/balance needs
  "4.C.2.d.1.b": {
    trait: "climbBalance",
    formula: (imp) => conservativeMap15(imp) * 0.5, // half weight
  },
  // Repetitive motions also indicate manual dexterity
  "4.C.2.d.1.g": {
    trait: "manualDexterity",
    formula: (imp) => conservativeMap15(imp),
  },
};

// ─── Name-Based Lookup ──────────────────────────────────────────────

/**
 * Maps O*NET Work Context element names (as they appear in the data)
 * to element IDs. This is used when the data provides names but not IDs.
 */
export const ONET_CONTEXT_NAME_TO_ID: Record<string, string> = {
  "Spend Time Standing": "4.C.2.d.1.a",
  "Spend Time Walking and Running": "4.C.2.d.1.b",
  "Spend Time Sitting": "4.C.2.d.1.c",
  "Spend Time Climbing Ladders, Scaffolds, or Poles": "4.C.2.d.1.d",
  "Spend Time Kneeling, Crouching, Stooping, or Crawling": "4.C.2.d.1.e",
  "Spend Time Bending or Twisting the Body": "4.C.2.d.1.f",
  "Spend Time Making Repetitive Motions": "4.C.2.d.1.g",
  "Spend Time Using Your Hands to Handle, Control, or Feel Objects, Tools, or Controls": "4.C.2.d.1.i",
  "Outdoors, Exposed to Weather": "4.C.2.e.1.a",
  "Outdoors, Under Cover": "4.C.2.e.1.b",
  "Indoors, Environmentally Controlled": "4.C.2.e.1.c",
  "Very Hot or Cold Temperatures": "4.C.2.e.2.a_heat", // special: feeds both heat and cold
  "Extremely Bright or Inadequate Lighting": "4.C.2.e.2.b",
  "Exposed to Contaminants": "4.C.2.e.2.c",
  "Exposed to Whole Body Vibration": "4.C.2.e.2.d",
  "Exposed to Hazardous Conditions": "4.C.2.e.2.e",
  "Exposed to Hazardous Equipment": "4.C.2.e.2.f",
  "Sounds, Noise Levels Are Distracting or Uncomfortable": "4.C.2.e.3.a",
  "Pace Determined by Speed of Equipment": "4.C.3.d.4",
};

// ─── Main Conversion Function ────────────────────────────────────────

/**
 * Convert O*NET Work Context data to partial trait values.
 *
 * Accepts work context as either:
 *   - Array of { id, name, value, level, score } objects (O*NET API format)
 *   - Record<string, number> keyed by element name (simplified format)
 *
 * Returns a map of trait keys to estimated 0-4 demand values.
 * Only traits that can be derived from the provided data are included.
 */
export function convertONETContextToTraits(
  workContext: Array<{ id?: string; name?: string; value?: number; level?: number; score?: number }> | Record<string, number>
): Record<string, number> {
  const traits: Record<string, number> = {};

  // Normalize input to name → value map
  const contextValues = new Map<string, number>();

  if (Array.isArray(workContext)) {
    for (const item of workContext) {
      const name = item.name;
      const value = item.level ?? item.score ?? item.value ?? null;
      if (name && typeof value === "number") {
        contextValues.set(name, value);
      }
    }
  } else {
    for (const [name, value] of Object.entries(workContext)) {
      if (typeof value === "number") {
        contextValues.set(name, value);
      }
    }
  }

  // Apply primary mappings
  for (const [name, value] of contextValues) {
    // Handle "Very Hot or Cold Temperatures" which maps to both heat and cold
    if (name === "Very Hot or Cold Temperatures") {
      const heatMapping = ONET_CONTEXT_TO_TRAIT["4.C.2.e.2.a_heat"];
      const coldMapping = ONET_CONTEXT_TO_TRAIT["4.C.2.e.2.a_cold"];
      if (heatMapping) {
        const heatVal = heatMapping.formula(value);
        traits[heatMapping.trait] = Math.max(traits[heatMapping.trait] ?? 0, heatVal);
      }
      if (coldMapping) {
        const coldVal = coldMapping.formula(value);
        traits[coldMapping.trait] = Math.max(traits[coldMapping.trait] ?? 0, coldVal);
      }
      continue;
    }

    const elementId = ONET_CONTEXT_NAME_TO_ID[name];
    if (!elementId) continue;

    const mapping = ONET_CONTEXT_TO_TRAIT[elementId];
    if (!mapping) continue;

    const traitValue = mapping.formula(value);

    // Use max when multiple elements map to same trait
    traits[mapping.trait] = Math.max(traits[mapping.trait] ?? 0, traitValue);

    // Apply secondary mappings
    const secondary = ONET_CONTEXT_SECONDARY_TRAITS[elementId];
    if (secondary) {
      const secValue = secondary.formula(value);
      traits[secondary.trait] = Math.max(traits[secondary.trait] ?? 0, secValue);
    }
  }

  return traits;
}

/**
 * Get the confidence level for a trait derived from O*NET Work Context.
 * Work Context data is less precise than ORS but more structured than DOT.
 *
 * Returns 0-1 confidence score.
 */
export function getONETContextConfidence(trait: TraitKey): number {
  // Environmental traits map well from O*NET context
  const highConfidence: TraitKey[] = [
    "workLocation", "noiseVibration", "hazards", "dustsFumes",
    "extremeCold", "extremeHeat",
  ];

  // Physical traits have moderate correspondence
  const medConfidence: TraitKey[] = [
    "stoopKneel", "climbBalance", "reachHandle",
    "fingerDexterity", "manualDexterity", "motorCoordination",
  ];

  // Strength from context is least reliable
  const lowConfidence: TraitKey[] = ["strength"];

  if (highConfidence.includes(trait)) return 0.65;
  if (medConfidence.includes(trait)) return 0.50;
  if (lowConfidence.includes(trait)) return 0.35;

  return 0.30; // Default for traits not well-represented in work context
}
