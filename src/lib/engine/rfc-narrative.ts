/**
 * RFC Narrative Generator
 *
 * Generates a plain-language Residual Functional Capacity (RFC) narrative
 * from a worker's 24-trait post-injury profile and optional analysis results.
 *
 * The narrative describes the evaluee's physical, cognitive, and environmental
 * tolerances in vocational rehabilitation language, suitable for inclusion
 * in transferable-skills reports and vocational expert testimony.
 */

import {
  type TraitVector,
  type TraitKey,
  TRAIT_KEYS,
  TRAIT_LABELS,
  TRAIT_GROUPS,
  STRENGTH_LABELS,
  FREQUENCY_LABELS,
} from "./traits";

// ─── Interfaces ────────────────────────────────────────────────────────

/** A trait where the worker retains good capacity (level 3-4). */
export interface TraitStrength {
  trait: string;
  label: string;
  level: number;
  /** Human-readable description, e.g. "Strong reasoning ability (level 3/4)" */
  description: string;
}

/** A trait where the worker has reduced capacity (level 0-1). */
export interface TraitLimitation {
  trait: string;
  label: string;
  level: number;
  /** Human-readable description, e.g. "Limited climbing/balance capacity (level 0/4 - not present)" */
  description: string;
  /** Vocational impact, e.g. "Precludes work requiring ladder use or elevated platforms" */
  impactOnWork: string;
}

/** Complete RFC narrative output. */
export interface RFCNarrative {
  /** Functional exertion level derived from the strength trait. */
  functionalLevel: "sedentary" | "light" | "medium" | "heavy" | "very_heavy";
  /** Display label, e.g. "Sedentary Work (up to 10 lbs occasional lifting)" */
  functionalLevelLabel: string;

  /** Traits where the worker has good capacity (level >= 3). */
  strengths: TraitStrength[];
  /** Traits where the worker has reduced capacity (level <= 1). */
  limitations: TraitLimitation[];
  /** Labels for traits at level 2 (moderate/occasional capability). */
  moderateCapabilities: string[];

  /** Narrative paragraph covering physical demand tolerances. */
  physicalSummary: string;
  /** Narrative paragraph covering cognitive/aptitude capabilities. */
  cognitiveSummary: string;
  /** Narrative paragraph covering environmental tolerances. */
  environmentalSummary: string;

  /** Work categories the evaluee is suited for given the profile. */
  suitableWorkTypes: string[];
  /** Work categories the evaluee should avoid. */
  unsuitableWorkTypes: string[];

  /** Complete 2-3 paragraph narrative combining all sections. */
  fullNarrative: string;
}

// ─── Constants ─────────────────────────────────────────────────────────

const FUNCTIONAL_LEVEL_MAP: Record<
  number,
  { key: RFCNarrative["functionalLevel"]; label: string }
> = {
  0: { key: "sedentary", label: "Sedentary Work (up to 10 lbs occasional lifting)" },
  1: { key: "light", label: "Light Work (up to 20 lbs occasional, 10 lbs frequent lifting)" },
  2: { key: "medium", label: "Medium Work (up to 50 lbs occasional, 25 lbs frequent lifting)" },
  3: { key: "heavy", label: "Heavy Work (up to 100 lbs occasional, 50 lbs frequent lifting)" },
  4: { key: "very_heavy", label: "Very Heavy Work (over 100 lbs lifting)" },
};

/**
 * Vocational impact descriptions for each trait when it is limited (level 0-1).
 * Used to populate TraitLimitation.impactOnWork.
 */
const LIMITATION_IMPACTS: Record<string, string> = {
  reasoning: "Limits access to occupations requiring complex problem-solving or abstract thinking",
  math: "Precludes work involving computation, bookkeeping, or quantitative analysis",
  language: "Limits occupations requiring reading comprehension, written expression, or verbal communication",
  spatialPerception: "Restricts work involving spatial judgment such as drafting, layout, or navigation",
  formPerception: "Precludes inspection, quality control, or pattern-recognition tasks",
  clericalPerception: "Limits data-entry, filing, proofreading, and record-keeping tasks",
  motorCoordination: "Restricts work requiring coordinated limb movements or foot controls",
  fingerDexterity: "Precludes fine assembly, keyboarding, or instrument operation",
  manualDexterity: "Limits work requiring turning, placing, or manipulating objects with hands",
  eyeHandFoot: "Restricts machine operation, driving, or tasks needing coordinated eye-hand-foot response",
  colorDiscrimination: "Precludes color-critical tasks such as wiring, sorting, or quality inspection",
  strength: "Limits exertional demands to sedentary or light work only",
  climbBalance: "Precludes work requiring ladder use, scaffolding, or elevated platforms",
  stoopKneel: "Restricts tasks requiring bending, kneeling, crouching, or crawling",
  reachHandle: "Limits work requiring sustained reaching, handling, or overhead activity",
  talkHear: "Restricts occupations requiring oral communication, telephone use, or auditory monitoring",
  see: "Limits work requiring visual acuity, depth perception, or peripheral vision",
  workLocation: "Precludes predominantly outdoor work assignments",
  extremeCold: "Restricts work in refrigerated environments or outdoor cold-weather settings",
  extremeHeat: "Restricts work near furnaces, ovens, or in hot outdoor environments",
  wetnessHumidity: "Limits work in wet or highly humid conditions",
  noiseVibration: "Restricts work in high-noise environments or with vibrating equipment",
  hazards: "Precludes safety-sensitive positions involving machinery, heights, or electrical hazards",
  dustsFumes: "Restricts exposure to airborne contaminants, dusts, gases, or fumes",
};

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Retrieve the numeric value of a trait, returning null for missing data.
 * Clamps to the 0-4 range.
 */
function traitVal(profile: TraitVector, key: TraitKey): number | null {
  const v = profile[key];
  if (v === null || v === undefined) return null;
  return Math.max(0, Math.min(4, Math.round(v)));
}

/**
 * Return a frequency/strength descriptor for a trait value.
 * Uses STRENGTH_LABELS for the strength trait, FREQUENCY_LABELS otherwise.
 */
function descriptorFor(trait: TraitKey, level: number): string {
  if (trait === "strength") {
    return STRENGTH_LABELS[level] ?? `Level ${level}`;
  }
  return FREQUENCY_LABELS[level] ?? `Level ${level}`;
}

/**
 * Build a human-readable description of a trait's capacity level.
 */
function capacityDescription(trait: TraitKey, level: number): string {
  const label = TRAIT_LABELS[trait];
  const desc = descriptorFor(trait, level);
  return `${label}: ${desc} (level ${level}/4)`;
}

/**
 * Produce a change note when pre- and post-injury values differ.
 */
function changeNote(trait: TraitKey, pre: number, post: number): string | null {
  if (pre === post) return null;
  const label = TRAIT_LABELS[trait];
  const preDesc = descriptorFor(trait, pre);
  const postDesc = descriptorFor(trait, post);
  const direction = post < pre ? "reduced" : "increased";
  return `${label} ${direction} from ${preDesc} (${pre}) to ${postDesc} (${post}) post-injury`;
}

// ─── Summary Builders ──────────────────────────────────────────────────

/**
 * Build the physical demands summary from relevant physical traits.
 * Covers: strength, climbing, stooping, reaching, dexterity, coordination, vision, hearing.
 */
function buildPhysicalSummary(
  profile: TraitVector,
  preProfile: TraitVector | null | undefined,
  functionalLevelLabel: string
): string {
  const parts: string[] = [];
  const strengthVal = traitVal(profile, "strength") ?? 0;

  parts.push(`Evaluee can perform ${functionalLevelLabel.toLowerCase()}.`);

  // Climbing/Balance
  const climb = traitVal(profile, "climbBalance");
  if (climb !== null) {
    if (climb === 0) parts.push("Climbing and balancing are precluded.");
    else if (climb === 1) parts.push("Climbing and balancing are limited to seldom.");
    else if (climb >= 3) parts.push("Climbing and balancing can be performed frequently.");
  }

  // Stooping/Kneeling
  const stoop = traitVal(profile, "stoopKneel");
  if (stoop !== null) {
    if (stoop === 0) parts.push("Stooping, kneeling, crouching, and crawling are precluded.");
    else if (stoop === 1) parts.push("Stooping and kneeling are limited to seldom.");
    else if (stoop >= 3) parts.push("Stooping and kneeling can be performed frequently.");
  }

  // Reaching/Handling
  const reach = traitVal(profile, "reachHandle");
  if (reach !== null) {
    if (reach <= 1) parts.push("Reaching and handling are significantly limited.");
    else if (reach >= 3) parts.push("Reaching and handling present no significant limitation.");
  }

  // Dexterity
  const finger = traitVal(profile, "fingerDexterity");
  const manual = traitVal(profile, "manualDexterity");
  if (finger !== null && manual !== null) {
    if (finger >= 3 && manual >= 3) {
      parts.push("Fine and gross manipulation abilities are intact.");
    } else if (finger <= 1 || manual <= 1) {
      const limited: string[] = [];
      if (finger <= 1) limited.push("fine manipulation");
      if (manual <= 1) limited.push("gross manipulation");
      parts.push(`Significant limitation in ${limited.join(" and ")}.`);
    }
  }

  // Vision
  const see = traitVal(profile, "see");
  if (see !== null && see <= 1) {
    parts.push("Visual acuity is significantly limited.");
  }

  // Hearing/Speech
  const talkHear = traitVal(profile, "talkHear");
  if (talkHear !== null && talkHear <= 1) {
    parts.push("Oral communication and hearing are significantly limited.");
  }

  // Pre-injury changes for key physical traits
  if (preProfile) {
    const physicalChanges: string[] = [];
    const physTraits: TraitKey[] = [
      "strength", "climbBalance", "stoopKneel", "reachHandle",
      "fingerDexterity", "manualDexterity", "see", "talkHear",
    ];
    for (const t of physTraits) {
      const pre = traitVal(preProfile, t);
      const post = traitVal(profile, t);
      if (pre !== null && post !== null) {
        const note = changeNote(t, pre, post);
        if (note) physicalChanges.push(note);
      }
    }
    if (physicalChanges.length > 0) {
      parts.push(`Post-injury changes: ${physicalChanges.join("; ")}.`);
    }
  }

  return parts.join(" ");
}

/**
 * Build the cognitive/aptitude summary from reasoning, math, language,
 * spatial, form, and clerical perception traits.
 */
function buildCognitiveSummary(
  profile: TraitVector,
  preProfile: TraitVector | null | undefined
): string {
  const parts: string[] = [];

  const aptitudes = TRAIT_GROUPS.aptitudes;
  const levels: { key: TraitKey; val: number }[] = [];
  for (const key of aptitudes) {
    const v = traitVal(profile, key);
    if (v !== null) levels.push({ key, val: v });
  }

  if (levels.length === 0) {
    return "Cognitive and aptitude data were not assessed.";
  }

  const avg = levels.reduce((s, l) => s + l.val, 0) / levels.length;
  const strong = levels.filter((l) => l.val >= 3);
  const limited = levels.filter((l) => l.val <= 1);

  // Overall characterization
  if (avg >= 3) {
    parts.push("Evaluee demonstrates above-average cognitive and aptitude capabilities.");
  } else if (avg >= 2) {
    parts.push("Evaluee demonstrates average cognitive and aptitude capabilities.");
  } else {
    parts.push("Evaluee demonstrates below-average cognitive and aptitude capabilities.");
  }

  // Highlight strengths
  if (strong.length > 0) {
    const labels = strong.map((s) => TRAIT_LABELS[s.key].toLowerCase());
    parts.push(`Strengths include ${joinList(labels)}.`);
  }

  // Highlight limitations
  if (limited.length > 0) {
    const labels = limited.map((l) => TRAIT_LABELS[l.key].toLowerCase());
    parts.push(`Limitations noted in ${joinList(labels)}.`);
  }

  // Pre-injury changes
  if (preProfile) {
    const cogChanges: string[] = [];
    for (const { key } of levels) {
      const pre = traitVal(preProfile, key);
      const post = traitVal(profile, key);
      if (pre !== null && post !== null) {
        const note = changeNote(key, pre, post);
        if (note) cogChanges.push(note);
      }
    }
    if (cogChanges.length > 0) {
      parts.push(`Post-injury changes: ${cogChanges.join("; ")}.`);
    }
  }

  return parts.join(" ");
}

/**
 * Build the environmental tolerances summary from temperature, noise,
 * hazards, dusts, wetness, and work location traits.
 */
function buildEnvironmentalSummary(profile: TraitVector): string {
  const parts: string[] = [];
  const avoidances: string[] = [];

  const cold = traitVal(profile, "extremeCold");
  const heat = traitVal(profile, "extremeHeat");
  const wet = traitVal(profile, "wetnessHumidity");
  const noise = traitVal(profile, "noiseVibration");
  const hazards = traitVal(profile, "hazards");
  const dusts = traitVal(profile, "dustsFumes");
  const location = traitVal(profile, "workLocation");

  if (cold !== null && cold <= 1) avoidances.push("extreme cold");
  if (heat !== null && heat <= 1) avoidances.push("extreme heat");
  if (wet !== null && wet <= 1) avoidances.push("wet or humid conditions");
  if (noise !== null && noise <= 1) avoidances.push("high noise and vibration");
  if (hazards !== null && hazards <= 1) avoidances.push("workplace hazards (machinery, heights, electrical)");
  if (dusts !== null && dusts <= 1) avoidances.push("dusts, fumes, and airborne contaminants");

  if (avoidances.length > 0) {
    parts.push(`Evaluee should avoid exposure to ${joinList(avoidances)}.`);
  } else {
    parts.push("No significant environmental restrictions are indicated.");
  }

  if (location !== null) {
    if (location <= 1) {
      parts.push("Work should be primarily indoors.");
    } else if (location >= 3) {
      parts.push("Evaluee can tolerate outdoor work environments.");
    }
  }

  // Note any high environmental tolerances
  const tolerant: string[] = [];
  if (cold !== null && cold >= 3) tolerant.push("cold");
  if (heat !== null && heat >= 3) tolerant.push("heat");
  if (noise !== null && noise >= 3) tolerant.push("noisy environments");
  if (hazards !== null && hazards >= 3) tolerant.push("hazardous conditions");

  if (tolerant.length > 0) {
    parts.push(`Evaluee demonstrates good tolerance for ${joinList(tolerant)}.`);
  }

  return parts.join(" ");
}

// ─── Work Suitability ──────────────────────────────────────────────────

/**
 * Determine suitable and unsuitable work type categories based on the
 * functional level and trait profile.
 */
function determineWorkSuitability(
  profile: TraitVector,
  functionalLevel: RFCNarrative["functionalLevel"]
): { suitable: string[]; unsuitable: string[] } {
  const suitable: string[] = [];
  const unsuitable: string[] = [];

  // Helper to check if a set of aptitude traits are adequate (>= 2)
  const hasCognition =
    (traitVal(profile, "reasoning") ?? 2) >= 2 &&
    (traitVal(profile, "language") ?? 2) >= 2;

  const hasGoodCognition =
    (traitVal(profile, "reasoning") ?? 0) >= 3 &&
    (traitVal(profile, "language") ?? 0) >= 3;

  const hasDexterity =
    (traitVal(profile, "fingerDexterity") ?? 2) >= 2 &&
    (traitVal(profile, "manualDexterity") ?? 2) >= 2;

  const hasGoodDexterity =
    (traitVal(profile, "fingerDexterity") ?? 0) >= 3 &&
    (traitVal(profile, "manualDexterity") ?? 0) >= 3;

  const hasGoodPhysical =
    (traitVal(profile, "stoopKneel") ?? 0) >= 2 &&
    (traitVal(profile, "reachHandle") ?? 0) >= 2;

  const poorVision = (traitVal(profile, "see") ?? 3) <= 1;
  const poorHearing = (traitVal(profile, "talkHear") ?? 3) <= 1;
  const poorEnvTolerance =
    (traitVal(profile, "extremeCold") ?? 2) <= 1 ||
    (traitVal(profile, "extremeHeat") ?? 2) <= 1 ||
    (traitVal(profile, "hazards") ?? 2) <= 1;

  // Sedentary work types
  if (functionalLevel === "sedentary" || functionalLevel === "light") {
    if (hasGoodCognition) {
      suitable.push("Office/clerical work");
      suitable.push("Customer service");
      if ((traitVal(profile, "math") ?? 0) >= 3) {
        suitable.push("Bookkeeping/accounting support");
      }
    }
    if (hasCognition) {
      suitable.push("Data entry");
      suitable.push("Telephone/call center");
    }
    if (hasGoodDexterity) {
      suitable.push("Light assembly");
      suitable.push("Inspection/quality control");
    }
  }

  // Light work types
  if (functionalLevel === "light" || functionalLevel === "medium") {
    if (hasDexterity) {
      suitable.push("Technical work");
      suitable.push("Machine tending");
    }
    if (hasCognition && hasDexterity) {
      suitable.push("Retail sales");
    }
  }

  // Medium work types
  if (functionalLevel === "medium" || functionalLevel === "heavy") {
    if (hasGoodPhysical) {
      suitable.push("Warehouse/distribution");
      suitable.push("Manufacturing");
      suitable.push("Retail stocking");
    }
  }

  // Heavy/very heavy work types
  if (functionalLevel === "heavy" || functionalLevel === "very_heavy") {
    suitable.push("Construction");
    suitable.push("Trades");
    suitable.push("General labor");
  }

  // Exclusions based on limitations
  if (functionalLevel === "sedentary") {
    unsuitable.push("Heavy or very heavy exertional work");
    unsuitable.push("Construction and trades");
  } else if (functionalLevel === "light") {
    unsuitable.push("Medium, heavy, or very heavy exertional work");
  }

  if (poorVision || poorHearing) {
    unsuitable.push("Safety-sensitive positions");
    unsuitable.push("Commercial driving");
  }

  if (poorEnvTolerance) {
    unsuitable.push("Outdoor work in extreme conditions");
    unsuitable.push("Industrial environments with hazard exposure");
  }

  const climbVal = traitVal(profile, "climbBalance");
  if (climbVal !== null && climbVal <= 1) {
    unsuitable.push("Work at heights or requiring ladder/scaffold use");
  }

  const stoopVal = traitVal(profile, "stoopKneel");
  if (stoopVal !== null && stoopVal === 0) {
    unsuitable.push("Work requiring frequent bending, kneeling, or crawling");
  }

  // Deduplicate
  return {
    suitable: Array.from(new Set(suitable)),
    unsuitable: Array.from(new Set(unsuitable)),
  };
}

// ─── Utility ───────────────────────────────────────────────────────────

/** Join a list with commas and "and" before the last item. */
function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

// ─── Main Generator ────────────────────────────────────────────────────

/**
 * Generate a complete RFC narrative from the worker's post-injury trait profile.
 *
 * @param postProfile  - The worker's 24-trait post-injury capacities (0-4 scale).
 * @param preProfile   - Optional pre-injury profile for documenting changes.
 * @param viableCount  - Optional count of viable occupations from the analysis.
 * @param excludedCount - Optional count of excluded occupations from the analysis.
 * @returns A structured RFC narrative with component summaries and a full paragraph.
 */
export function generateRFCNarrative(
  postProfile: TraitVector,
  preProfile?: TraitVector | null,
  viableCount?: number,
  excludedCount?: number
): RFCNarrative {
  // ── 1. Functional Level ────────────────────────────────────────────
  const strengthVal = traitVal(postProfile, "strength") ?? 0;
  const levelInfo = FUNCTIONAL_LEVEL_MAP[strengthVal] ?? FUNCTIONAL_LEVEL_MAP[0];
  const functionalLevel = levelInfo.key;
  const functionalLevelLabel = levelInfo.label;

  // ── 2. Classify all traits into strengths / limitations / moderate ─
  const strengths: TraitStrength[] = [];
  const limitations: TraitLimitation[] = [];
  const moderateCapabilities: string[] = [];

  for (const key of TRAIT_KEYS) {
    const val = traitVal(postProfile, key);
    if (val === null) continue;

    const label = TRAIT_LABELS[key];

    if (val >= 3) {
      strengths.push({
        trait: key,
        label,
        level: val,
        description: capacityDescription(key, val),
      });
    } else if (val <= 1) {
      limitations.push({
        trait: key,
        label,
        level: val,
        description: capacityDescription(key, val),
        impactOnWork: LIMITATION_IMPACTS[key] ?? "May restrict certain occupational categories",
      });
    } else {
      // val === 2
      moderateCapabilities.push(label);
    }
  }

  // ── 3. Build section summaries ─────────────────────────────────────
  const physicalSummary = buildPhysicalSummary(postProfile, preProfile, functionalLevelLabel);
  const cognitiveSummary = buildCognitiveSummary(postProfile, preProfile);
  const environmentalSummary = buildEnvironmentalSummary(postProfile);

  // ── 4. Work suitability ────────────────────────────────────────────
  const { suitable: suitableWorkTypes, unsuitable: unsuitableWorkTypes } =
    determineWorkSuitability(postProfile, functionalLevel);

  // ── 5. Compose full narrative ──────────────────────────────────────
  const fullNarrativeParts: string[] = [];

  // Paragraph 1: Physical and functional
  fullNarrativeParts.push(physicalSummary);

  // Paragraph 2: Cognitive
  fullNarrativeParts.push(cognitiveSummary);

  // Paragraph 3: Environmental + work suitability + labor market context
  const closingParts: string[] = [environmentalSummary];

  if (suitableWorkTypes.length > 0) {
    closingParts.push(
      `Based on the overall profile, the evaluee is suited for ${joinList(
        suitableWorkTypes.map((s) => s.toLowerCase())
      )}.`
    );
  }
  if (unsuitableWorkTypes.length > 0) {
    closingParts.push(
      `The evaluee should avoid ${joinList(
        unsuitableWorkTypes.map((s) => s.toLowerCase())
      )}.`
    );
  }

  if (viableCount !== undefined && excludedCount !== undefined) {
    const total = viableCount + excludedCount;
    closingParts.push(
      `Of ${total.toLocaleString()} occupations analyzed, ${viableCount.toLocaleString()} remain viable and ${excludedCount.toLocaleString()} are excluded based on the post-injury profile.`
    );
  }

  fullNarrativeParts.push(closingParts.join(" "));

  const fullNarrative = fullNarrativeParts.join("\n\n");

  return {
    functionalLevel,
    functionalLevelLabel,
    strengths,
    limitations,
    moderateCapabilities,
    physicalSummary,
    cognitiveSummary,
    environmentalSummary,
    suitableWorkTypes,
    unsuitableWorkTypes,
    fullNarrative,
  };
}
