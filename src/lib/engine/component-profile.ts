/**
 * Component Profile Code (CPC) System
 *
 * Decomposes O*NET occupations into 237-dimensional fingerprint vectors
 * based on their underlying components (knowledge, skills, abilities,
 * work activities, work context, work styles).
 *
 * Incorporates ORS physical/environmental trait data and OEWS wage/employment
 * data to produce enriched occupation fingerprints for component-based
 * candidate matching.
 *
 * Follows VDARE methodology (Field & Sink, 1981) by enabling comparison of
 * the worker's Residual Employability Profile (REP) against ALL occupations
 * based on underlying component similarity, not just DOT/O*NET relationships.
 */

import type {
  ONETFullOccupationData,
  ONETElement,
  ORSOccupationData,
  OEWSOccupationData,
  DOTOccupationData,
} from "@/lib/data-loaders";
import {
  loadONETFullData,
  loadORSData,
  loadOEWSData,
  loadDOTData,
} from "@/lib/data-loaders";

// ─── Types ───────────────────────────────────────────────────────────

export interface ComponentProfileCode {
  /** Human-readable code: K[X+Y]-S[X+Y]-A[X+Y]-Z{n}-STR:{s} */
  code: string;
  topKnowledge: string[];
  topSkills: string[];
  topAbilities: string[];
  jobZone: number;
  strength: string;
}

export interface OccupationFingerprint {
  onetCode: string;
  title: string;
  /** 237-element L2-normalized vector */
  vector: Float64Array;
  jobZone: number;
  cpc: ComponentProfileCode;
  /** ORS-derived 24-trait demand data (if available) */
  orsTraits: Partial<Record<string, number>> | null;
  /** OEWS employment/wage data (if available) */
  oewsData: {
    employment: number | null;
    medianWage: number | null;
    meanWage: number | null;
  } | null;
}

export interface CPCSimilarityResult {
  onetCode: string;
  title: string;
  /** Cosine similarity (0-1) */
  cosineSimilarity: number;
  /** Top shared high-scoring dimensions */
  topMatchingComponents: ComponentDetail[];
  /** Dimensions where occupation exceeds worker */
  topGapComponents: ComponentDetail[];
  cpc: ComponentProfileCode;
  jobZone: number;
  strength: string;
  /** Employment from OEWS (national) */
  employment: number | null;
  /** Median wage from OEWS */
  medianWage: number | null;
}

export interface ComponentDetail {
  id: string;
  name: string;
  taxonomy: string;
  score: number;
}

// ─── Canonical Dimension Ordering ────────────────────────────────────

/**
 * Taxonomy ranges within the 237-dimensional fingerprint vector.
 * Order: knowledge (33), skills (35), abilities (52),
 *        work activities (41), work context (55), work styles (21)
 */
export const TAXONOMY_RANGES = {
  knowledge: { start: 0, count: 33 },
  skills: { start: 33, count: 35 },
  abilities: { start: 68, count: 52 },
  workActivities: { start: 120, count: 41 },
  workContext: { start: 161, count: 55 },
  workStyles: { start: 216, count: 21 },
} as const;

export const FINGERPRINT_DIMENSIONS = 237;

/** Lazily built canonical ordering of element IDs */
let _canonicalOrder: string[] | null = null;
let _canonicalIdToIndex: Map<string, number> | null = null;
let _canonicalIdToName: Map<string, string> | null = null;
let _canonicalIdToTaxonomy: Map<string, string> | null = null;

/**
 * Build the canonical element ID ordering from a reference occupation.
 * Must be called with any occupation that has all taxonomy arrays populated.
 */
function buildCanonicalOrder(occ: ONETFullOccupationData): void {
  const order: string[] = [];
  const idToName = new Map<string, string>();
  const idToTaxonomy = new Map<string, string>();

  const taxonomies: [string, ONETElement[] | undefined][] = [
    ["knowledge", occ.kn],
    ["skills", occ.sk],
    ["abilities", occ.ab],
    ["workActivities", occ.wa],
    ["workContext", occ.wc],
    ["workStyles", occ.ws],
  ];

  for (const [taxonomy, elements] of taxonomies) {
    if (!elements) continue;
    // Sort by element ID for deterministic ordering
    const sorted = [...elements].sort((a, b) => a.id.localeCompare(b.id));
    for (const el of sorted) {
      order.push(el.id);
      idToName.set(el.id, el.n);
      idToTaxonomy.set(el.id, taxonomy);
    }
  }

  _canonicalOrder = order;
  _canonicalIdToIndex = new Map(order.map((id, i) => [id, i]));
  _canonicalIdToName = idToName;
  _canonicalIdToTaxonomy = idToTaxonomy;
}

export function getCanonicalOrder(): string[] {
  if (!_canonicalOrder) {
    throw new Error("Canonical order not initialized. Call buildFingerprintIndex() first.");
  }
  return _canonicalOrder;
}

export function getCanonicalIdToIndex(): Map<string, number> {
  if (!_canonicalIdToIndex) {
    throw new Error("Canonical order not initialized. Call buildFingerprintIndex() first.");
  }
  return _canonicalIdToIndex;
}

// ─── Fingerprint Computation ─────────────────────────────────────────

/**
 * Compute raw element score: importance × level for taxonomies that have both,
 * or just importance for work context and work styles.
 */
function elementScore(el: ONETElement, taxonomy: string): number {
  const importance = el.v ?? 0;
  const level = el.l ?? 0;

  // Work context and work styles only have importance (v), no level (l)
  if (taxonomy === "workContext" || taxonomy === "workStyles") {
    return importance;
  }
  return importance * level;
}

/**
 * Compute the 237-dimensional fingerprint vector for an occupation.
 * Values are importance × level products (or just importance for wc/ws).
 * The vector is NOT L2-normalized here — normalization happens after.
 */
function computeRawFingerprint(occ: ONETFullOccupationData): Float64Array {
  const vector = new Float64Array(FINGERPRINT_DIMENSIONS);
  const idToIndex = getCanonicalIdToIndex();

  const taxonomies: [string, ONETElement[] | undefined][] = [
    ["knowledge", occ.kn],
    ["skills", occ.sk],
    ["abilities", occ.ab],
    ["workActivities", occ.wa],
    ["workContext", occ.wc],
    ["workStyles", occ.ws],
  ];

  for (const [taxonomy, elements] of taxonomies) {
    if (!elements) continue;
    for (const el of elements) {
      const idx = idToIndex.get(el.id);
      if (idx !== undefined) {
        vector[idx] = elementScore(el, taxonomy);
      }
    }
  }

  return vector;
}

/**
 * L2-normalize a vector in-place. Returns the same array.
 * If the vector is all zeros, returns it unchanged.
 */
export function l2Normalize(vector: Float64Array): Float64Array {
  let sumSq = 0;
  for (let i = 0; i < vector.length; i++) {
    sumSq += vector[i] * vector[i];
  }
  if (sumSq === 0) return vector;
  const norm = Math.sqrt(sumSq);
  for (let i = 0; i < vector.length; i++) {
    vector[i] /= norm;
  }
  return vector;
}

/**
 * Compute cosine similarity between two L2-normalized vectors.
 * Since both are unit vectors, this is just the dot product.
 */
export function cosineSimilarity(a: Float64Array, b: Float64Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  // Clamp to [0, 1] — negative similarity means opposite profiles
  return Math.max(0, Math.min(1, dot));
}

// ─── CPC Code Generation ─────────────────────────────────────────────

/**
 * Abbreviation map for human-readable CPC codes.
 * Covers all 120 unique element names across knowledge, skills, and abilities.
 */
const CPC_ABBREVIATIONS: Record<string, string> = {
  // Knowledge (33)
  "Administration and Management": "Admin",
  "Administrative": "AdminSvc",
  "Biology": "Bio",
  "Building and Construction": "Build",
  "Chemistry": "Chem",
  "Communications and Media": "CommMedia",
  "Computers and Electronics": "CompElec",
  "Customer and Personal Service": "CustSvc",
  "Design": "Design",
  "Economics and Accounting": "Econ",
  "Education and Training": "EduTrain",
  "Engineering and Technology": "EngTech",
  "English Language": "English",
  "Fine Arts": "FineArts",
  "Food Production": "FoodProd",
  "Foreign Language": "ForeignLg",
  "Geography": "Geo",
  "History and Archeology": "History",
  "Law and Government": "LawGov",
  "Mathematics": "Math",
  "Mechanical": "Mech",
  "Medicine and Dentistry": "MedDent",
  "Personnel and Human Resources": "HR",
  "Philosophy and Theology": "PhilTheo",
  "Physics": "Physics",
  "Production and Processing": "ProdProc",
  "Psychology": "Psych",
  "Public Safety and Security": "PubSafe",
  "Sales and Marketing": "SalesMkt",
  "Sociology and Anthropology": "SocAnth",
  "Telecommunications": "Telecom",
  "Therapy and Counseling": "Therapy",
  "Transportation": "Transport",

  // Skills (35)
  "Active Learning": "ActLearn",
  "Active Listening": "ActListen",
  "Complex Problem Solving": "CmplxProb",
  "Coordination": "Coord",
  "Critical Thinking": "CritThink",
  "Equipment Maintenance": "EquipMaint",
  "Equipment Selection": "EquipSel",
  "Installation": "Install",
  "Instructing": "Instruct",
  "Judgment and Decision Making": "JudgDecis",
  "Learning Strategies": "LearnStrat",
  "Management of Financial Resources": "MgmtFin",
  "Management of Material Resources": "MgmtMat",
  "Management of Personnel Resources": "MgmtPers",
  // "Mathematics" already mapped above (knowledge); skill shares same abbrev
  "Monitoring": "Monitor",
  "Negotiation": "Negot",
  "Operation and Control": "OpCtrl",
  "Operations Analysis": "OpsAnalys",
  "Operations Monitoring": "OpsMonit",
  "Persuasion": "Persuade",
  "Programming": "Program",
  "Quality Control Analysis": "QualCtrl",
  "Reading Comprehension": "ReadComp",
  "Repairing": "Repair",
  "Science": "Science",
  "Service Orientation": "SvcOrient",
  "Social Perceptiveness": "SocPercep",
  "Speaking": "Speaking",
  "Systems Analysis": "SysAnalys",
  "Systems Evaluation": "SysEval",
  "Technology Design": "TechDesign",
  "Time Management": "TimeMgmt",
  "Troubleshooting": "Troublesh",
  "Writing": "Writing",

  // Abilities (52)
  "Arm-Hand Steadiness": "ArmHandSt",
  "Auditory Attention": "AudAttent",
  "Category Flexibility": "CatFlex",
  "Control Precision": "CtrlPrec",
  "Deductive Reasoning": "DeductRsn",
  "Depth Perception": "DepthPerc",
  "Dynamic Flexibility": "DynFlex",
  "Dynamic Strength": "DynStr",
  "Explosive Strength": "ExplStr",
  "Extent Flexibility": "ExtFlex",
  "Far Vision": "FarVis",
  "Finger Dexterity": "FingerDex",
  "Flexibility of Closure": "FlexClose",
  "Fluency of Ideas": "FluIdeas",
  "Glare Sensitivity": "GlareSens",
  "Gross Body Coordination": "GrossCoord",
  "Gross Body Equilibrium": "GrossEquil",
  "Hearing Sensitivity": "HearSens",
  "Inductive Reasoning": "InductRsn",
  "Information Ordering": "InfoOrder",
  "Manual Dexterity": "ManualDex",
  "Mathematical Reasoning": "MathRsn",
  "Memorization": "Memorize",
  "Multilimb Coordination": "MultiCoord",
  "Near Vision": "NearVis",
  "Night Vision": "NightVis",
  "Number Facility": "NumFacil",
  "Oral Comprehension": "OralComp",
  "Oral Expression": "OralExpr",
  "Originality": "Original",
  "Perceptual Speed": "PercSpeed",
  "Peripheral Vision": "PeriphVis",
  "Problem Sensitivity": "ProbSens",
  "Rate Control": "RateCtrl",
  "Reaction Time": "ReactTime",
  "Response Orientation": "RespOrient",
  "Selective Attention": "SelAttent",
  "Sound Localization": "SoundLoc",
  "Spatial Orientation": "SpatOrient",
  "Speech Clarity": "SpchClar",
  "Speech Recognition": "SpchRecog",
  "Speed of Closure": "SpdClose",
  "Speed of Limb Movement": "SpdLimb",
  "Stamina": "Stamina",
  "Static Strength": "StaticStr",
  "Time Sharing": "TimeShare",
  "Trunk Strength": "TrunkStr",
  "Visual Color Discrimination": "ColorDisc",
  "Visualization": "Visualize",
  "Wrist-Finger Speed": "WristSpd",
  "Written Comprehension": "WritComp",
  "Written Expression": "WritExpr",
};

function abbreviate(name: string): string {
  return CPC_ABBREVIATIONS[name] ?? name.substring(0, 8);
}

/**
 * Get the top N elements from an O*NET array sorted by importance × level descending.
 */
function topElements(elements: ONETElement[] | undefined, n: number): ONETElement[] {
  if (!elements || elements.length === 0) return [];
  return [...elements]
    .sort((a, b) => {
      const scoreA = (a.v ?? 0) * (a.l ?? 1);
      const scoreB = (b.v ?? 0) * (b.l ?? 1);
      return scoreB - scoreA;
    })
    .slice(0, n);
}

/**
 * Generate the Component Profile Code for an occupation.
 */
export function generateCPC(
  occ: ONETFullOccupationData,
  jobZone: number,
  strength: string = "?"
): ComponentProfileCode {
  const topKn = topElements(occ.kn, 2).map((e) => e.n);
  const topSk = topElements(occ.sk, 2).map((e) => e.n);
  const topAb = topElements(occ.ab, 2).map((e) => e.n);

  const knStr = topKn.map(abbreviate).join("+");
  const skStr = topSk.map(abbreviate).join("+");
  const abStr = topAb.map(abbreviate).join("+");

  const code = `K[${knStr}]-S[${skStr}]-A[${abStr}]-Z${jobZone}-STR:${strength}`;

  return {
    code,
    topKnowledge: topKn,
    topSkills: topSk,
    topAbilities: topAb,
    jobZone,
    strength,
  };
}

/**
 * Generate CPC from a raw fingerprint vector (used for worker composite profiles).
 */
export function generateCPCFromVector(
  vector: Float64Array,
  jobZone: number,
  strength: string
): ComponentProfileCode {
  const order = getCanonicalOrder();

  // Extract top 2 from each of the first 3 taxonomies (knowledge, skills, abilities)
  const ranges = [
    { name: "knowledge", ...TAXONOMY_RANGES.knowledge },
    { name: "skills", ...TAXONOMY_RANGES.skills },
    { name: "abilities", ...TAXONOMY_RANGES.abilities },
  ];

  const tops: string[][] = [];

  for (const range of ranges) {
    const entries: { name: string; score: number }[] = [];
    for (let i = range.start; i < range.start + range.count; i++) {
      entries.push({
        name: _canonicalIdToName?.get(order[i]) ?? order[i],
        score: vector[i],
      });
    }
    entries.sort((a, b) => b.score - a.score);
    tops.push(entries.slice(0, 2).map((e) => e.name));
  }

  const [topKn, topSk, topAb] = tops;

  const knStr = topKn.map(abbreviate).join("+");
  const skStr = topSk.map(abbreviate).join("+");
  const abStr = topAb.map(abbreviate).join("+");

  return {
    code: `K[${knStr}]-S[${skStr}]-A[${abStr}]-Z${jobZone}-STR:${strength}`,
    topKnowledge: topKn,
    topSkills: topSk,
    topAbilities: topAb,
    jobZone,
    strength,
  };
}

// ─── ORS Trait Extraction for Fingerprint Enrichment ─────────────────

/**
 * Extract normalized ORS physical/environmental traits for an occupation.
 * Uses the same mapping logic as traits.ts mapORSToTraits but returns
 * a flat record for fingerprint enrichment.
 *
 * ORS data provides authoritative physical demand information per VDARE
 * methodology — it takes priority over DOT/O*NET for physical traits.
 */
function extractORSTraitSummary(
  ors: ORSOccupationData
): Partial<Record<string, number>> {
  const traits: Partial<Record<string, number>> = {};

  if (ors.p) {
    for (const [category, items] of Object.entries(ors.p)) {
      if (!Array.isArray(items)) continue;
      const cat = category.toLowerCase();

      if (cat === "strength") {
        traits["ors_strength"] = parseORSDominantLevel(items, [
          "sedentary", "light", "medium", "heavy", "very heavy"
        ]);
      } else if (cat.includes("fine manipulation")) {
        traits["ors_fingerDexterity"] = parseORSFrequencyLevel(items);
      } else if (cat.includes("gross manipulation")) {
        traits["ors_manualDexterity"] = parseORSFrequencyLevel(items);
      } else if (cat.includes("climbing")) {
        traits["ors_climbBalance"] = parseORSFrequencyLevel(items);
      } else if (cat.includes("low postures")) {
        traits["ors_stoopKneel"] = parseORSFrequencyLevel(items);
      } else if (cat.includes("reaching")) {
        traits["ors_reachHandle"] = parseORSFrequencyLevel(items);
      }
    }
  }

  if (ors.e) {
    for (const [category, items] of Object.entries(ors.e)) {
      if (!Array.isArray(items)) continue;
      const cat = category.toLowerCase();

      if (cat.includes("extreme cold")) {
        traits["ors_extremeCold"] = parseORSFrequencyLevel(items);
      } else if (cat.includes("extreme heat")) {
        traits["ors_extremeHeat"] = parseORSFrequencyLevel(items);
      } else if (cat.includes("noise")) {
        traits["ors_noise"] = parseORSFrequencyLevel(items);
      } else if (cat.includes("hazardous")) {
        traits["ors_hazards"] = parseORSFrequencyLevel(items);
      }
    }
  }

  return traits;
}

function parseORSPercent(val: string | number): number {
  if (typeof val === "number") return val;
  const s = String(val).trim();
  if (s.startsWith(">")) return parseFloat(s.slice(1)) || 0;
  if (s.startsWith("<")) return (parseFloat(s.slice(1)) || 0) * 0.5;
  return parseFloat(s) || 0;
}

function parseORSFrequencyLevel(items: { t: string; v: string | number }[]): number {
  const freq: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const item of items) {
    if (!item?.t) continue;
    const t = String(item.t).toLowerCase();
    const pct = parseORSPercent(item.v);
    if (t.includes("were not") || t.includes("did not")) freq[0] = Math.max(freq[0], pct);
    else if (t.includes("constantly")) freq[4] = Math.max(freq[4], pct);
    else if (t.includes("frequently")) freq[3] = Math.max(freq[3], pct);
    else if (t.includes("occasionally")) freq[2] = Math.max(freq[2], pct);
    else if (t.includes("seldom")) freq[1] = Math.max(freq[1], pct);
  }
  let maxPct = 0, maxLevel = 0;
  for (const [level, pct] of Object.entries(freq)) {
    if (pct > maxPct) { maxPct = pct; maxLevel = Number(level); }
  }
  return maxLevel;
}

function parseORSDominantLevel(
  items: { t: string; v: string | number }[],
  levelNames: string[]
): number {
  let maxPct = 0, maxLevel = 0;
  for (const item of items) {
    if (!item?.t) continue;
    const t = String(item.t).toLowerCase();
    const pct = parseORSPercent(item.v);
    for (let i = levelNames.length - 1; i >= 0; i--) {
      if (t.includes(levelNames[i]) && pct > maxPct) {
        maxPct = pct;
        maxLevel = i;
        break;
      }
    }
  }
  return maxLevel;
}

// ─── Fingerprint Index (Lazy Singleton) ──────────────────────────────

let _fingerprintIndex: Map<string, OccupationFingerprint> | null = null;

/**
 * Estimate strength level from O*NET work context and abilities data.
 * Used as tertiary fallback when neither ORS nor DOT strength is available.
 *
 * Uses Static Strength ability level and physical work context scores
 * (time sitting, standing, handling) to approximate DOL strength categories.
 */
function estimateStrengthFromONET(occ: ONETFullOccupationData): string {
  // Check abilities for Static Strength (1.A.3.a.1)
  const staticStrength = occ.ab?.find((a) => a.id === "1.A.3.a.1");
  const staticLevel = staticStrength?.l ?? 0;

  // Check work context for physical posture indicators
  const wcMap: Record<string, number> = {};
  if (occ.wc) {
    for (const el of occ.wc) {
      wcMap[el.n] = el.v ?? 0;
    }
  }

  const sitting = wcMap["Spend Time Sitting"] ?? 0;
  const standing = wcMap["Spend Time Standing"] ?? 0;
  const handling = wcMap["Spend Time Using Your Hands to Handle, Control, or Feel Objects, Tools, or Controls"] ?? 0;
  const kneeling = wcMap["Spend Time Kneeling, Crouching, Stooping, or Crawling"] ?? 0;
  const bending = wcMap["Spend Time Bending or Twisting Your Body"] ?? 0;

  // Static Strength level is the strongest indicator:
  // Level 0-1 = Sedentary, 1-2 = Light, 2.5-3.5 = Medium, 3.5-4.5 = Heavy, 4.5+ = Very Heavy
  if (staticLevel >= 4.5) return "V";
  if (staticLevel >= 3.5) return "H";
  if (staticLevel >= 2.5) return "M";

  // For lower Static Strength, use work context as tiebreaker
  if (staticLevel >= 1.5) {
    // Light or Medium — check physical context
    if (standing >= 3.5 && handling >= 3.5) return "M";
    if (kneeling >= 2.5 || bending >= 3.0) return "M";
    return "L";
  }

  // Very low Static Strength — Sedentary or Light
  if (sitting >= 3.5 && standing <= 2.5) return "S";
  if (standing >= 3.0) return "L";
  return "S";
}

/**
 * Build and cache the complete fingerprint index for all 1016 O*NET occupations.
 * Incorporates ORS trait data, OEWS wage/employment data, and DOT strength data.
 *
 * Strength determination uses a 3-tier fallback:
 * 1. ORS strength (primary — survey-based, 277 occupations)
 * 2. DOT strength via crosswalk (secondary — analyst-rated, ~11,500 occupations)
 * 3. O*NET work context/abilities estimation (tertiary — derived from physical demands)
 *
 * Per VDARE methodology, ORS data is the primary source for physical demands.
 * OEWS data provides labor market context (employment, wages) for each occupation.
 */
export async function buildFingerprintIndex(): Promise<Map<string, OccupationFingerprint>> {
  if (_fingerprintIndex) return _fingerprintIndex;

  const [onetData, orsData, oewsData, dotData] = await Promise.all([
    loadONETFullData(),
    loadORSData(),
    loadOEWSData(),
    loadDOTData(),
  ]);

  const entries = Object.entries(onetData);
  if (entries.length === 0) {
    throw new Error("No O*NET data loaded");
  }

  // Initialize canonical ordering from first occupation
  buildCanonicalOrder(entries[0][1]);

  // Build reverse crosswalk: O*NET SOC prefix → DOT strength
  // DOT xw field is a 5-digit code; O*NET codes are XX-XXXX.XX
  // We also try matching by 6-digit SOC prefix
  const dotStrengthByOnet = new Map<string, string>();
  for (const [, dotOcc] of Object.entries(dotData)) {
    if (!dotOcc.str) continue;
    // Try to map DOT xw code to O*NET format
    // xw is like "11102" → we try matching against stripped O*NET codes
    if (dotOcc.xw) {
      const xw = dotOcc.xw;
      // Store by xw prefix for later matching
      if (!dotStrengthByOnet.has(xw)) {
        dotStrengthByOnet.set(xw, dotOcc.str);
      }
    }
  }

  const index = new Map<string, OccupationFingerprint>();

  for (const [code, occ] of entries) {
    // Compute base 237-dimensional fingerprint from O*NET components
    const rawVector = computeRawFingerprint(occ);

    // Look up ORS data (keyed by 6-digit SOC, e.g., "111021" for "11-1021")
    const socShort = code.replace(/[.-]/g, "").substring(0, 6);
    const orsEntry = orsData[socShort] ?? null;
    const orsTraits = orsEntry ? extractORSTraitSummary(orsEntry) : null;

    // Look up OEWS data (keyed by "XX-XXXX" format)
    const oewsKey = code.substring(0, 7); // "11-1011" from "11-1011.00"
    const oewsEntry = oewsData[oewsKey] ?? null;

    // ── 3-Tier Strength Determination ────────────────────────────
    const strMap: Record<number, string> = { 0: "S", 1: "L", 2: "M", 3: "H", 4: "V" };
    let strength = "?";

    // Tier 1: ORS strength (primary — survey data)
    if (orsTraits?.["ors_strength"] !== undefined) {
      strength = strMap[orsTraits["ors_strength"]] ?? "?";
    }

    // Tier 2: DOT strength via crosswalk (secondary)
    if (strength === "?") {
      // Try 5-digit match (e.g., "11101" from "11-1011.00")
      const soc5 = code.replace(/[.-]/g, "").substring(0, 5);
      const dotStr = dotStrengthByOnet.get(soc5);
      if (dotStr) {
        strength = dotStr;
      } else {
        // Try 6-digit match
        const dotStr6 = dotStrengthByOnet.get(socShort);
        if (dotStr6) {
          strength = dotStr6;
        }
      }
    }

    // Tier 3: Estimate from O*NET work context + abilities (tertiary)
    if (strength === "?") {
      strength = estimateStrengthFromONET(occ);
    }

    // L2-normalize the fingerprint
    const vector = l2Normalize(rawVector);

    // Generate CPC code
    const cpc = generateCPC(occ, occ.jz ?? 3, strength);

    index.set(code, {
      onetCode: code,
      title: occ.t,
      vector,
      jobZone: occ.jz ?? 3,
      cpc,
      orsTraits,
      oewsData: oewsEntry
        ? {
            employment: oewsEntry.e,
            medianWage: oewsEntry.md,
            meanWage: oewsEntry.m,
          }
        : null,
    });
  }

  _fingerprintIndex = index;
  return index;
}

/**
 * Get a single occupation's fingerprint. Builds the index if needed.
 */
export async function getFingerprint(
  onetCode: string
): Promise<OccupationFingerprint | null> {
  const index = await buildFingerprintIndex();
  return index.get(onetCode) ?? null;
}

/**
 * Find top matching and gap components between two fingerprint vectors.
 */
export function analyzeComponentOverlap(
  workerVector: Float64Array,
  occupationVector: Float64Array,
  topN: number = 5
): { matching: ComponentDetail[]; gaps: ComponentDetail[] } {
  const order = getCanonicalOrder();

  // Matching: both score high (both in top quartile)
  const matchScores: { idx: number; score: number }[] = [];
  const gapScores: { idx: number; gap: number }[] = [];

  for (let i = 0; i < FINGERPRINT_DIMENSIONS; i++) {
    const w = workerVector[i];
    const o = occupationVector[i];

    // Matching: geometric mean of both scores
    if (w > 0 && o > 0) {
      matchScores.push({ idx: i, score: Math.sqrt(w * o) });
    }

    // Gap: where occupation demands more than worker has
    if (o > w) {
      gapScores.push({ idx: i, gap: o - w });
    }
  }

  matchScores.sort((a, b) => b.score - a.score);
  gapScores.sort((a, b) => b.gap - a.gap);

  const toDetail = (idx: number, score: number): ComponentDetail => ({
    id: order[idx],
    name: _canonicalIdToName?.get(order[idx]) ?? order[idx],
    taxonomy: _canonicalIdToTaxonomy?.get(order[idx]) ?? "unknown",
    score,
  });

  return {
    matching: matchScores.slice(0, topN).map((m) => toDetail(m.idx, m.score)),
    gaps: gapScores.slice(0, topN).map((g) => toDetail(g.idx, g.gap)),
  };
}

/**
 * Convert O*NET Job Zone (1-5) to maximum SVP.
 * Replicates the logic from candidates.ts for consistency.
 */
export function jobZoneToMaxSvp(jobZone: number): number {
  const map: Record<number, number> = { 1: 2, 2: 4, 3: 6, 4: 7, 5: 9 };
  return map[jobZone] ?? 9;
}

/**
 * Compute the profile breadth metric — standard deviation of the fingerprint vector.
 * Low std dev = narrow/specialized profile; high std dev = broad/generalist profile.
 */
export function profileBreadth(vector: Float64Array): {
  stdDev: number;
  label: "narrow" | "moderate" | "broad";
} {
  let sum = 0;
  for (let i = 0; i < vector.length; i++) sum += vector[i];
  const mean = sum / vector.length;

  let sumSqDiff = 0;
  for (let i = 0; i < vector.length; i++) {
    const diff = vector[i] - mean;
    sumSqDiff += diff * diff;
  }
  const stdDev = Math.sqrt(sumSqDiff / vector.length);

  // Thresholds based on L2-normalized vectors (typical std dev range ~0.03-0.12)
  let label: "narrow" | "moderate" | "broad";
  if (stdDev > 0.08) label = "narrow"; // high variance = concentrated in few dimensions
  else if (stdDev > 0.05) label = "moderate";
  else label = "broad"; // low variance = spread across many dimensions

  return { stdDev, label };
}

// ─── Reset (for testing) ─────────────────────────────────────────────

export function _resetFingerprintIndex(): void {
  _fingerprintIndex = null;
  _canonicalOrder = null;
  _canonicalIdToIndex = null;
  _canonicalIdToName = null;
  _canonicalIdToTaxonomy = null;
}
