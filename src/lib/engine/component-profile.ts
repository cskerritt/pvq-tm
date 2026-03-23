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
  /**
   * Fully numeric CPC code following occupational taxonomy conventions.
   *
   * Format: KK.kk-SS.ss-AA.aa-WW.ww-ZP-CCRS
   *
   * Segments:
   *   KK.kk  Primary.Secondary knowledge domain (01-33)
   *   SS.ss  Primary.Secondary skill domain (01-35)
   *   AA.aa  Primary.Secondary ability domain (01-52)
   *   WW.ww  Primary.Secondary work activity (01-41)
   *   Z      Job zone (1-5)
   *   P      Physical strength demand (1=Sedentary, 2=Light, 3=Medium, 4=Heavy, 5=Very Heavy)
   *   CCRS   ORS physical demands: Climb(0-4), Crouch/Stoop(0-4), Reach(0-4), Sensory/Manip(0-4)
   *          Each digit: 0=None, 1=Seldom, 2=Occasional, 3=Frequent, 4=Constant
   *          Defaults to 0000 if no ORS data available
   *
   * Example: 01.03-07.29-01.08-15.22-32-1230
   * Reads:   Knowledge=Admin+Econ, Skills=CritThink+Judgment, Abilities=OralComp+DeductRsn,
   *          Activities=MakeDecisions+CommSupervisors, JobZone=3, Strength=Light,
   *          ORS: Climb=1(Seldom), Stoop=2(Occasional), Reach=3(Frequent), Manip=0(None)
   */
  code: string;
  /** Legacy human-readable code for backward compatibility */
  legacyCode: string;
  topKnowledge: string[];
  topSkills: string[];
  topAbilities: string[];
  topWorkActivities: string[];
  jobZone: number;
  /** S, L, M, H, V */
  strength: string;
  /** Numeric strength level (1-5) */
  strengthLevel: number;
  /** ORS physical demand digits [climb, stoop, reach, manipulation] each 0-4 */
  orsPhysicalDemands: [number, number, number, number];
  /** Decoded numeric segments for programmatic access */
  segments: {
    knowledge: [number, number];
    skills: [number, number];
    abilities: [number, number];
    workActivities: [number, number];
  };
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

// ─── Numeric CPC Taxonomy ─────────────────────────────────────────────

/**
 * Numeric ID maps for CPC code generation.
 * Each O*NET element ID maps to a sequential numeric code within its taxonomy.
 * IDs are assigned in sorted order of the O*NET element ID strings.
 *
 * These follow the same conventions as SOC (XX-XXXX), O*NET (XX-XXXX.XX),
 * and DOT (XXX.XXX-XXX) — fully numeric, hierarchical, sortable.
 */

/** Knowledge domains: 01-33 (sorted by O*NET element ID) */
const KNOWLEDGE_ID_MAP: Record<string, number> = {
  "2.C.1.a": 1,   // Administration and Management
  "2.C.1.b": 2,   // Administrative
  "2.C.1.c": 3,   // Economics and Accounting
  "2.C.1.d": 4,   // Sales and Marketing
  "2.C.1.e": 5,   // Customer and Personal Service
  "2.C.1.f": 6,   // Personnel and Human Resources
  "2.C.10": 7,    // Transportation
  "2.C.2.a": 8,   // Production and Processing
  "2.C.2.b": 9,   // Food Production
  "2.C.3.a": 10,  // Computers and Electronics
  "2.C.3.b": 11,  // Engineering and Technology
  "2.C.3.c": 12,  // Design
  "2.C.3.d": 13,  // Building and Construction
  "2.C.3.e": 14,  // Mechanical
  "2.C.4.a": 15,  // Mathematics
  "2.C.4.b": 16,  // Physics
  "2.C.4.c": 17,  // Chemistry
  "2.C.4.d": 18,  // Biology
  "2.C.4.e": 19,  // Psychology
  "2.C.4.f": 20,  // Sociology and Anthropology
  "2.C.4.g": 21,  // Geography
  "2.C.5.a": 22,  // Medicine and Dentistry
  "2.C.5.b": 23,  // Therapy and Counseling
  "2.C.6": 24,    // Education and Training
  "2.C.7.a": 25,  // English Language
  "2.C.7.b": 26,  // Foreign Language
  "2.C.7.c": 27,  // Fine Arts
  "2.C.7.d": 28,  // History and Archeology
  "2.C.7.e": 29,  // Philosophy and Theology
  "2.C.8.a": 30,  // Public Safety and Security
  "2.C.8.b": 31,  // Law and Government
  "2.C.9.a": 32,  // Telecommunications
  "2.C.9.b": 33,  // Communications and Media
};

/** Skills domains: 01-35 (sorted by O*NET element ID) */
const SKILL_ID_MAP: Record<string, number> = {
  "2.A.1.a": 1,   // Reading Comprehension
  "2.A.1.b": 2,   // Active Listening
  "2.A.1.c": 3,   // Writing
  "2.A.1.d": 4,   // Speaking
  "2.A.1.e": 5,   // Mathematics
  "2.A.1.f": 6,   // Science
  "2.A.2.a": 7,   // Critical Thinking
  "2.A.2.b": 8,   // Active Learning
  "2.A.2.c": 9,   // Learning Strategies
  "2.A.2.d": 10,  // Monitoring
  "2.B.1.a": 11,  // Social Perceptiveness
  "2.B.1.b": 12,  // Coordination
  "2.B.1.c": 13,  // Persuasion
  "2.B.1.d": 14,  // Negotiation
  "2.B.1.e": 15,  // Instructing
  "2.B.1.f": 16,  // Service Orientation
  "2.B.2.i": 17,  // Complex Problem Solving
  "2.B.3.a": 18,  // Operations Analysis
  "2.B.3.b": 19,  // Technology Design
  "2.B.3.c": 20,  // Equipment Selection
  "2.B.3.d": 21,  // Installation
  "2.B.3.e": 22,  // Programming
  "2.B.3.g": 23,  // Operations Monitoring
  "2.B.3.h": 24,  // Operation and Control
  "2.B.3.j": 25,  // Equipment Maintenance
  "2.B.3.k": 26,  // Troubleshooting
  "2.B.3.l": 27,  // Repairing
  "2.B.3.m": 28,  // Quality Control Analysis
  "2.B.4.e": 29,  // Judgment and Decision Making
  "2.B.4.g": 30,  // Systems Analysis
  "2.B.4.h": 31,  // Systems Evaluation
  "2.B.5.a": 32,  // Time Management
  "2.B.5.b": 33,  // Management of Financial Resources
  "2.B.5.c": 34,  // Management of Material Resources
  "2.B.5.d": 35,  // Management of Personnel Resources
};

/** Abilities domains: 01-52 (sorted by O*NET element ID) */
const ABILITY_ID_MAP: Record<string, number> = {
  "1.A.1.a.1": 1,   // Oral Comprehension
  "1.A.1.a.2": 2,   // Written Comprehension
  "1.A.1.a.3": 3,   // Oral Expression
  "1.A.1.a.4": 4,   // Written Expression
  "1.A.1.b.1": 5,   // Fluency of Ideas
  "1.A.1.b.2": 6,   // Originality
  "1.A.1.b.3": 7,   // Problem Sensitivity
  "1.A.1.b.4": 8,   // Deductive Reasoning
  "1.A.1.b.5": 9,   // Inductive Reasoning
  "1.A.1.b.6": 10,  // Information Ordering
  "1.A.1.b.7": 11,  // Category Flexibility
  "1.A.1.c.1": 12,  // Mathematical Reasoning
  "1.A.1.c.2": 13,  // Number Facility
  "1.A.1.d.1": 14,  // Memorization
  "1.A.1.e.1": 15,  // Speed of Closure
  "1.A.1.e.2": 16,  // Flexibility of Closure
  "1.A.1.e.3": 17,  // Perceptual Speed
  "1.A.1.f.1": 18,  // Spatial Orientation
  "1.A.1.f.2": 19,  // Visualization
  "1.A.1.g.1": 20,  // Selective Attention
  "1.A.1.g.2": 21,  // Time Sharing
  "1.A.2.a.1": 22,  // Arm-Hand Steadiness
  "1.A.2.a.2": 23,  // Manual Dexterity
  "1.A.2.a.3": 24,  // Finger Dexterity
  "1.A.2.b.1": 25,  // Control Precision
  "1.A.2.b.2": 26,  // Multilimb Coordination
  "1.A.2.b.3": 27,  // Response Orientation
  "1.A.2.b.4": 28,  // Rate Control
  "1.A.2.c.1": 29,  // Reaction Time
  "1.A.2.c.2": 30,  // Wrist-Finger Speed
  "1.A.2.c.3": 31,  // Speed of Limb Movement
  "1.A.3.a.1": 32,  // Static Strength
  "1.A.3.a.2": 33,  // Explosive Strength
  "1.A.3.a.3": 34,  // Dynamic Strength
  "1.A.3.a.4": 35,  // Trunk Strength
  "1.A.3.b.1": 36,  // Stamina
  "1.A.3.c.1": 37,  // Extent Flexibility
  "1.A.3.c.2": 38,  // Dynamic Flexibility
  "1.A.3.c.3": 39,  // Gross Body Coordination
  "1.A.3.c.4": 40,  // Gross Body Equilibrium
  "1.A.4.a.1": 41,  // Near Vision
  "1.A.4.a.2": 42,  // Far Vision
  "1.A.4.a.3": 43,  // Visual Color Discrimination
  "1.A.4.a.4": 44,  // Night Vision
  "1.A.4.a.5": 45,  // Peripheral Vision
  "1.A.4.a.6": 46,  // Depth Perception
  "1.A.4.a.7": 47,  // Glare Sensitivity
  "1.A.4.b.1": 48,  // Hearing Sensitivity
  "1.A.4.b.2": 49,  // Auditory Attention
  "1.A.4.b.3": 50,  // Sound Localization
  "1.A.4.b.4": 51,  // Speech Recognition
  "1.A.4.b.5": 52,  // Speech Clarity
};

/** Work Activities domains: 01-41 (sorted by O*NET element ID) */
const WORK_ACTIVITY_ID_MAP: Record<string, number> = {
  "4.A.1.a.1": 1,   // Getting Information
  "4.A.1.a.2": 2,   // Monitoring Processes, Materials, or Surroundings
  "4.A.1.b.1": 3,   // Identifying Objects, Actions, and Events
  "4.A.1.b.2": 4,   // Inspecting Equipment, Structures, or Materials
  "4.A.2.a.1": 5,   // Estimating Quantifiable Characteristics
  "4.A.2.a.2": 6,   // Judging Qualities
  "4.A.2.a.3": 7,   // Processing Information
  "4.A.2.a.4": 8,   // Evaluating Information
  "4.A.2.b.1": 9,   // Making Decisions and Solving Problems
  "4.A.2.b.2": 10,  // Thinking Creatively
  "4.A.2.b.3": 11,  // Updating and Using Relevant Knowledge
  "4.A.2.b.4": 12,  // Developing Objectives and Strategies
  "4.A.2.b.5": 13,  // Scheduling Work and Activities
  "4.A.2.b.6": 14,  // Organizing, Planning, and Prioritizing Work
  "4.A.3.a.1": 15,  // Performing General Physical Activities
  "4.A.3.a.2": 16,  // Handling and Moving Objects
  "4.A.3.a.3": 17,  // Controlling Machines and Processes
  "4.A.3.a.4": 18,  // Operating Vehicles, Mechanized Devices, or Equipment
  "4.A.3.b.1": 19,  // Interacting With Computers
  "4.A.3.b.2": 20,  // Drafting, Laying Out, and Specifying Technical Devices
  "4.A.3.b.4": 21,  // Repairing and Maintaining Mechanical Equipment
  "4.A.3.b.5": 22,  // Repairing and Maintaining Electronic Equipment
  "4.A.3.b.6": 23,  // Documenting/Recording Information
  "4.A.4.a.1": 24,  // Interpreting the Meaning of Information for Others
  "4.A.4.a.2": 25,  // Communicating with Supervisors, Peers, or Subordinates
  "4.A.4.a.3": 26,  // Communicating with People Outside the Organization
  "4.A.4.a.4": 27,  // Establishing and Maintaining Interpersonal Relationships
  "4.A.4.a.5": 28,  // Assisting and Caring for Others
  "4.A.4.a.6": 29,  // Selling or Influencing Others
  "4.A.4.a.7": 30,  // Resolving Conflicts and Negotiating with Others
  "4.A.4.a.8": 31,  // Performing for or Working Directly with the Public
  "4.A.4.b.1": 32,  // Coordinating the Work and Activities of Others
  "4.A.4.b.2": 33,  // Developing and Building Teams
  "4.A.4.b.3": 34,  // Training and Teaching Others
  "4.A.4.b.4": 35,  // Guiding, Directing, and Motivating Subordinates
  "4.A.4.b.5": 36,  // Coaching and Developing Others
  "4.A.4.b.6": 37,  // Providing Consultation and Advice to Others
  "4.A.4.c.1": 38,  // Performing Administrative Activities
  "4.A.4.c.2": 39,  // Staffing Organizational Units
  "4.A.4.c.3": 40,  // Monitoring and Controlling Resources
  "4.A.4.c.4": 41,  // Not specified (placeholder)
};

/** Strength letter → numeric level */
const STRENGTH_NUMERIC: Record<string, number> = {
  "S": 1, "L": 2, "M": 3, "H": 4, "V": 5, "?": 0,
};

/** Reverse: numeric → letter */
const STRENGTH_LETTER: Record<number, string> = {
  0: "?", 1: "S", 2: "L", 3: "M", 4: "H", 5: "V",
};

/**
 * Human-readable labels for all numeric IDs.
 * Used for decoding CPC codes into plain text.
 */
export const CPC_KNOWLEDGE_LABELS: Record<number, string> = {
  1: "Administration & Management", 2: "Administrative", 3: "Economics & Accounting",
  4: "Sales & Marketing", 5: "Customer & Personal Service", 6: "Personnel & HR",
  7: "Transportation", 8: "Production & Processing", 9: "Food Production",
  10: "Computers & Electronics", 11: "Engineering & Technology", 12: "Design",
  13: "Building & Construction", 14: "Mechanical", 15: "Mathematics",
  16: "Physics", 17: "Chemistry", 18: "Biology", 19: "Psychology",
  20: "Sociology & Anthropology", 21: "Geography", 22: "Medicine & Dentistry",
  23: "Therapy & Counseling", 24: "Education & Training", 25: "English Language",
  26: "Foreign Language", 27: "Fine Arts", 28: "History & Archeology",
  29: "Philosophy & Theology", 30: "Public Safety & Security", 31: "Law & Government",
  32: "Telecommunications", 33: "Communications & Media",
};

export const CPC_SKILL_LABELS: Record<number, string> = {
  1: "Reading Comprehension", 2: "Active Listening", 3: "Writing", 4: "Speaking",
  5: "Mathematics", 6: "Science", 7: "Critical Thinking", 8: "Active Learning",
  9: "Learning Strategies", 10: "Monitoring", 11: "Social Perceptiveness",
  12: "Coordination", 13: "Persuasion", 14: "Negotiation", 15: "Instructing",
  16: "Service Orientation", 17: "Complex Problem Solving", 18: "Operations Analysis",
  19: "Technology Design", 20: "Equipment Selection", 21: "Installation",
  22: "Programming", 23: "Operations Monitoring", 24: "Operation & Control",
  25: "Equipment Maintenance", 26: "Troubleshooting", 27: "Repairing",
  28: "Quality Control Analysis", 29: "Judgment & Decision Making", 30: "Systems Analysis",
  31: "Systems Evaluation", 32: "Time Management", 33: "Mgmt of Financial Resources",
  34: "Mgmt of Material Resources", 35: "Mgmt of Personnel Resources",
};

export const CPC_ABILITY_LABELS: Record<number, string> = {
  1: "Oral Comprehension", 2: "Written Comprehension", 3: "Oral Expression",
  4: "Written Expression", 5: "Fluency of Ideas", 6: "Originality",
  7: "Problem Sensitivity", 8: "Deductive Reasoning", 9: "Inductive Reasoning",
  10: "Information Ordering", 11: "Category Flexibility", 12: "Mathematical Reasoning",
  13: "Number Facility", 14: "Memorization", 15: "Speed of Closure",
  16: "Flexibility of Closure", 17: "Perceptual Speed", 18: "Spatial Orientation",
  19: "Visualization", 20: "Selective Attention", 21: "Time Sharing",
  22: "Arm-Hand Steadiness", 23: "Manual Dexterity", 24: "Finger Dexterity",
  25: "Control Precision", 26: "Multilimb Coordination", 27: "Response Orientation",
  28: "Rate Control", 29: "Reaction Time", 30: "Wrist-Finger Speed",
  31: "Speed of Limb Movement", 32: "Static Strength", 33: "Explosive Strength",
  34: "Dynamic Strength", 35: "Trunk Strength", 36: "Stamina",
  37: "Extent Flexibility", 38: "Dynamic Flexibility", 39: "Gross Body Coordination",
  40: "Gross Body Equilibrium", 41: "Near Vision", 42: "Far Vision",
  43: "Visual Color Discrimination", 44: "Night Vision", 45: "Peripheral Vision",
  46: "Depth Perception", 47: "Glare Sensitivity", 48: "Hearing Sensitivity",
  49: "Auditory Attention", 50: "Sound Localization", 51: "Speech Recognition",
  52: "Speech Clarity",
};

export const CPC_WORK_ACTIVITY_LABELS: Record<number, string> = {
  1: "Getting Information", 2: "Monitoring Processes/Materials",
  3: "Identifying Objects/Actions", 4: "Inspecting Equipment/Structures",
  5: "Estimating Quantities", 6: "Judging Qualities", 7: "Processing Information",
  8: "Evaluating Information", 9: "Making Decisions & Problem Solving",
  10: "Thinking Creatively", 11: "Updating Knowledge", 12: "Developing Strategies",
  13: "Scheduling Work", 14: "Organizing & Prioritizing", 15: "General Physical Activities",
  16: "Handling & Moving Objects", 17: "Controlling Machines", 18: "Operating Vehicles",
  19: "Interacting With Computers", 20: "Drafting/Specifying Technical Devices",
  21: "Repairing Mechanical Equipment", 22: "Repairing Electronic Equipment",
  23: "Documenting/Recording Info", 24: "Interpreting Information",
  25: "Communicating with Supervisors/Peers", 26: "Communicating Externally",
  27: "Establishing Relationships", 28: "Assisting & Caring for Others",
  29: "Selling or Influencing", 30: "Resolving Conflicts/Negotiating",
  31: "Working with Public", 32: "Coordinating Work of Others",
  33: "Developing & Building Teams", 34: "Training & Teaching",
  35: "Guiding & Motivating Subordinates", 36: "Coaching & Developing Others",
  37: "Providing Consultation & Advice", 38: "Administrative Activities",
  39: "Staffing Units", 40: "Monitoring & Controlling Resources", 41: "Other",
};

/**
 * Decode a numeric CPC code into human-readable components.
 */
export function decodeCPC(code: string): {
  knowledge: [string, string];
  skills: [string, string];
  abilities: [string, string];
  workActivities: [string, string];
  jobZone: number;
  strength: string;
  strengthLevel: number;
  orsPhysicalDemands: { climb: number; stoop: number; reach: number; manipulation: number };
} {
  // Parse: KK.kk-SS.ss-AA.aa-WW.ww-ZP-CCRS
  const segments = code.split("-");
  const [k1, k2] = (segments[0] || "00.00").split(".").map(Number);
  const [s1, s2] = (segments[1] || "00.00").split(".").map(Number);
  const [a1, a2] = (segments[2] || "00.00").split(".").map(Number);
  const [w1, w2] = (segments[3] || "00.00").split(".").map(Number);
  const zpStr = segments[4] || "00";
  const orsStr = segments[5] || "0000";

  return {
    knowledge: [CPC_KNOWLEDGE_LABELS[k1] ?? "Unknown", CPC_KNOWLEDGE_LABELS[k2] ?? "Unknown"],
    skills: [CPC_SKILL_LABELS[s1] ?? "Unknown", CPC_SKILL_LABELS[s2] ?? "Unknown"],
    abilities: [CPC_ABILITY_LABELS[a1] ?? "Unknown", CPC_ABILITY_LABELS[a2] ?? "Unknown"],
    workActivities: [CPC_WORK_ACTIVITY_LABELS[w1] ?? "Unknown", CPC_WORK_ACTIVITY_LABELS[w2] ?? "Unknown"],
    jobZone: Number(zpStr[0]) || 0,
    strengthLevel: Number(zpStr[1]) || 0,
    strength: STRENGTH_LETTER[Number(zpStr[1]) || 0] ?? "?",
    orsPhysicalDemands: {
      climb: Number(orsStr[0]) || 0,
      stoop: Number(orsStr[1]) || 0,
      reach: Number(orsStr[2]) || 0,
      manipulation: Number(orsStr[3]) || 0,
    },
  };
}

// ─── CPC Code Generation ─────────────────────────────────────────────

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

/** Get numeric ID for an O*NET element within its taxonomy */
function getNumericId(
  el: ONETElement,
  idMap: Record<string, number>
): number {
  return idMap[el.id] ?? 0;
}

/** Format a 2-digit zero-padded number */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Legacy abbreviation map for backward-compatible codes */
const CPC_ABBREVIATIONS: Record<string, string> = {
  "Administration and Management": "Admin", "Administrative": "AdminSvc",
  "Biology": "Bio", "Building and Construction": "Build", "Chemistry": "Chem",
  "Communications and Media": "CommMedia", "Computers and Electronics": "CompElec",
  "Customer and Personal Service": "CustSvc", "Design": "Design",
  "Economics and Accounting": "Econ", "Education and Training": "EduTrain",
  "Engineering and Technology": "EngTech", "English Language": "English",
  "Fine Arts": "FineArts", "Food Production": "FoodProd", "Foreign Language": "ForeignLg",
  "Geography": "Geo", "History and Archeology": "History", "Law and Government": "LawGov",
  "Mathematics": "Math", "Mechanical": "Mech", "Medicine and Dentistry": "MedDent",
  "Personnel and Human Resources": "HR", "Philosophy and Theology": "PhilTheo",
  "Physics": "Physics", "Production and Processing": "ProdProc", "Psychology": "Psych",
  "Public Safety and Security": "PubSafe", "Sales and Marketing": "SalesMkt",
  "Sociology and Anthropology": "SocAnth", "Telecommunications": "Telecom",
  "Therapy and Counseling": "Therapy", "Transportation": "Transport",
  "Active Learning": "ActLearn", "Active Listening": "ActListen",
  "Complex Problem Solving": "CmplxProb", "Coordination": "Coord",
  "Critical Thinking": "CritThink", "Equipment Maintenance": "EquipMaint",
  "Judgment and Decision Making": "JudgDecis", "Monitoring": "Monitor",
  "Reading Comprehension": "ReadComp", "Speaking": "Speaking", "Writing": "Writing",
  "Oral Comprehension": "OralComp", "Oral Expression": "OralExpr",
  "Deductive Reasoning": "DeductRsn", "Problem Sensitivity": "ProbSens",
  "Inductive Reasoning": "InductRsn", "Written Comprehension": "WritComp",
  "Written Expression": "WritExpr", "Near Vision": "NearVis",
  "Speech Clarity": "SpchClar", "Speech Recognition": "SpchRecog",
  "Finger Dexterity": "FingerDex", "Manual Dexterity": "ManualDex",
  "Static Strength": "StaticStr", "Selective Attention": "SelAttent",
};

function abbreviate(name: string): string {
  return CPC_ABBREVIATIONS[name] ?? name.substring(0, 8);
}

/**
 * Generate the numeric Component Profile Code for an occupation.
 *
 * Integrates O*NET taxonomy data and ORS physical demand data into
 * a fully numeric code following occupational classification conventions.
 */
export function generateCPC(
  occ: ONETFullOccupationData,
  jobZone: number,
  strength: string = "?",
  orsTraits: Partial<Record<string, number>> | null = null
): ComponentProfileCode {
  const topKnEl = topElements(occ.kn, 2);
  const topSkEl = topElements(occ.sk, 2);
  const topAbEl = topElements(occ.ab, 2);
  const topWaEl = topElements(occ.wa, 2);

  // Numeric IDs
  const kIds: [number, number] = [
    topKnEl[0] ? getNumericId(topKnEl[0], KNOWLEDGE_ID_MAP) : 0,
    topKnEl[1] ? getNumericId(topKnEl[1], KNOWLEDGE_ID_MAP) : 0,
  ];
  const sIds: [number, number] = [
    topSkEl[0] ? getNumericId(topSkEl[0], SKILL_ID_MAP) : 0,
    topSkEl[1] ? getNumericId(topSkEl[1], SKILL_ID_MAP) : 0,
  ];
  const aIds: [number, number] = [
    topAbEl[0] ? getNumericId(topAbEl[0], ABILITY_ID_MAP) : 0,
    topAbEl[1] ? getNumericId(topAbEl[1], ABILITY_ID_MAP) : 0,
  ];
  const wIds: [number, number] = [
    topWaEl[0] ? getNumericId(topWaEl[0], WORK_ACTIVITY_ID_MAP) : 0,
    topWaEl[1] ? getNumericId(topWaEl[1], WORK_ACTIVITY_ID_MAP) : 0,
  ];

  const strNum = STRENGTH_NUMERIC[strength] ?? 0;

  // ORS physical demands: [climb, stoop, reach, manipulation] each 0-4
  const orsClimb = orsTraits?.["ors_climbBalance"] ?? 0;
  const orsStoop = orsTraits?.["ors_stoopKneel"] ?? 0;
  const orsReach = orsTraits?.["ors_reachHandle"] ?? 0;
  const orsManip = Math.max(
    orsTraits?.["ors_fingerDexterity"] ?? 0,
    orsTraits?.["ors_manualDexterity"] ?? 0
  );
  const orsDemands: [number, number, number, number] = [
    Math.round(orsClimb), Math.round(orsStoop),
    Math.round(orsReach), Math.round(orsManip),
  ];

  // Build numeric code: KK.kk-SS.ss-AA.aa-WW.ww-ZP-CCRS
  const code = [
    `${pad2(kIds[0])}.${pad2(kIds[1])}`,
    `${pad2(sIds[0])}.${pad2(sIds[1])}`,
    `${pad2(aIds[0])}.${pad2(aIds[1])}`,
    `${pad2(wIds[0])}.${pad2(wIds[1])}`,
    `${jobZone}${strNum}`,
    `${orsDemands[0]}${orsDemands[1]}${orsDemands[2]}${orsDemands[3]}`,
  ].join("-");

  // Legacy human-readable code
  const topKn = topKnEl.map((e) => e.n);
  const topSk = topSkEl.map((e) => e.n);
  const topAb = topAbEl.map((e) => e.n);
  const topWa = topWaEl.map((e) => e.n);

  const legacyCode = `K[${topKn.map(abbreviate).join("+")}]-S[${topSk.map(abbreviate).join("+")}]-A[${topAb.map(abbreviate).join("+")}]-Z${jobZone}-STR:${strength}`;

  return {
    code,
    legacyCode,
    topKnowledge: topKn,
    topSkills: topSk,
    topAbilities: topAb,
    topWorkActivities: topWa,
    jobZone,
    strength,
    strengthLevel: strNum,
    orsPhysicalDemands: orsDemands,
    segments: {
      knowledge: kIds,
      skills: sIds,
      abilities: aIds,
      workActivities: wIds,
    },
  };
}

/**
 * Generate CPC from a raw fingerprint vector (used for worker composite profiles).
 */
export function generateCPCFromVector(
  vector: Float64Array,
  jobZone: number,
  strength: string,
  orsTraits: Partial<Record<string, number>> | null = null
): ComponentProfileCode {
  const order = getCanonicalOrder();

  // Extract top 2 from each taxonomy using the canonical ordering
  const ranges = [
    { name: "knowledge", ...TAXONOMY_RANGES.knowledge, idMap: KNOWLEDGE_ID_MAP },
    { name: "skills", ...TAXONOMY_RANGES.skills, idMap: SKILL_ID_MAP },
    { name: "abilities", ...TAXONOMY_RANGES.abilities, idMap: ABILITY_ID_MAP },
    { name: "workActivities", ...TAXONOMY_RANGES.workActivities, idMap: WORK_ACTIVITY_ID_MAP },
  ];

  const topNames: string[][] = [];
  const topIds: [number, number][] = [];

  for (const range of ranges) {
    const entries: { id: string; name: string; score: number }[] = [];
    for (let i = range.start; i < range.start + range.count; i++) {
      entries.push({
        id: order[i],
        name: _canonicalIdToName?.get(order[i]) ?? order[i],
        score: vector[i],
      });
    }
    entries.sort((a, b) => b.score - a.score);
    topNames.push(entries.slice(0, 2).map((e) => e.name));
    topIds.push([
      range.idMap[entries[0]?.id] ?? 0,
      range.idMap[entries[1]?.id] ?? 0,
    ]);
  }

  const [topKn, topSk, topAb, topWa] = topNames;
  const [kIds, sIds, aIds, wIds] = topIds;

  const strNum = STRENGTH_NUMERIC[strength] ?? 0;
  const orsClimb = Math.round(orsTraits?.["ors_climbBalance"] ?? 0);
  const orsStoop = Math.round(orsTraits?.["ors_stoopKneel"] ?? 0);
  const orsReach = Math.round(orsTraits?.["ors_reachHandle"] ?? 0);
  const orsManip = Math.round(Math.max(
    orsTraits?.["ors_fingerDexterity"] ?? 0,
    orsTraits?.["ors_manualDexterity"] ?? 0
  ));
  const orsDemands: [number, number, number, number] = [orsClimb, orsStoop, orsReach, orsManip];

  const code = [
    `${pad2(kIds[0])}.${pad2(kIds[1])}`,
    `${pad2(sIds[0])}.${pad2(sIds[1])}`,
    `${pad2(aIds[0])}.${pad2(aIds[1])}`,
    `${pad2(wIds[0])}.${pad2(wIds[1])}`,
    `${jobZone}${strNum}`,
    `${orsDemands[0]}${orsDemands[1]}${orsDemands[2]}${orsDemands[3]}`,
  ].join("-");

  const legacyCode = `K[${topKn.map(abbreviate).join("+")}]-S[${topSk.map(abbreviate).join("+")}]-A[${topAb.map(abbreviate).join("+")}]-Z${jobZone}-STR:${strength}`;

  return {
    code,
    legacyCode,
    topKnowledge: topKn,
    topSkills: topSk,
    topAbilities: topAb,
    topWorkActivities: topWa,
    jobZone,
    strength,
    strengthLevel: strNum,
    orsPhysicalDemands: orsDemands,
    segments: {
      knowledge: kIds,
      skills: sIds,
      abilities: aIds,
      workActivities: wIds,
    },
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

    // Generate CPC code with ORS physical demands
    const cpc = generateCPC(occ, occ.jz ?? 3, strength, orsTraits);

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
