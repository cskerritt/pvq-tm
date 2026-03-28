/**
 * Unified Occupation Data Loader
 *
 * Provides fast access to pre-computed unified occupation records.
 * Replaces the 4-table runtime pipeline (DOT → O*NET → ORS → OEWS)
 * with a single JSON lookup.
 *
 * Each record contains:
 * - Pre-computed 24-trait demand vector with source provenance
 * - VQ score and band (McCroskey regression)
 * - Wages, employment, projections
 * - DOT title drill-down
 * - O*NET content (tasks, DWAs, tools)
 */

import type { TraitVector, TraitKey } from "./traits";
import { TRAIT_KEYS } from "./traits";
import type { TraitSource } from "./trait-feasibility";

// ─── Types ─────────────────────────────────────────────────────────

export interface TraitDemand {
  value: number;
  source: "ors" | "dot" | "onet" | "proxy";
  rawValue?: string;
}

export interface UnifiedOccupation {
  onetCode: string;
  socCode: string;
  title: string;
  description: string;
  traits: Record<string, TraitDemand>;
  vqScore: number;
  vqBand: number;
  svp: number;
  svpRange: [number, number];
  jobZone: number | null;
  strengthLevel: string;
  strengthRange: string[];
  wages: {
    median: number | null;
    mean: number | null;
    p10: number | null;
    p25: number | null;
    p75: number | null;
    p90: number | null;
  };
  employment: number | null;
  projections: {
    growthPercent: number | null;
    annualOpenings: number | null;
  } | null;
  dotTitles: Array<{
    code: string;
    title: string;
    svp: number;
    strength: string;
  }>;
  dotTitleCount: number;
  tasks: string[];
  dwas: string[];
  tools: string[];
  dataSources: string[];
  traitCoverage: number;
  hasORS: boolean;
  hasDOT: boolean;
  hasOEWS: boolean;
  hasBLSProjections: boolean;
}

// ─── Module-Level Cache ────────────────────────────────────────────

let _cache: UnifiedOccupation[] | null = null;
let _byOnetCode: Map<string, UnifiedOccupation> | null = null;
let _bySocCode: Map<string, UnifiedOccupation[]> | null = null;
let _byDotCode: Map<string, UnifiedOccupation> | null = null;

async function ensureLoaded(): Promise<void> {
  if (_cache) return;
  const data = (await import("@/data/unified-occupations.json")).default;
  _cache = data as unknown as UnifiedOccupation[];

  _byOnetCode = new Map();
  _bySocCode = new Map();
  _byDotCode = new Map();

  for (const occ of _cache) {
    _byOnetCode.set(occ.onetCode, occ);

    if (!_bySocCode.has(occ.socCode)) _bySocCode.set(occ.socCode, []);
    _bySocCode.get(occ.socCode)!.push(occ);

    for (const dot of occ.dotTitles) {
      _byDotCode.set(dot.code, occ);
    }
  }
}

// ─── Public API ────────────────────────────────────────────────────

/** Load all unified occupations */
export async function loadUnifiedOccupations(): Promise<UnifiedOccupation[]> {
  await ensureLoaded();
  return _cache!;
}

/** Look up by O*NET code (e.g., "29-1141.02") */
export async function getByOnetCode(code: string): Promise<UnifiedOccupation | null> {
  await ensureLoaded();
  return _byOnetCode!.get(code) || _byOnetCode!.get(code + ".00") || null;
}

/** Look up by SOC code (e.g., "29-1141") — may return multiple O*NET specializations */
export async function getBySocCode(code: string): Promise<UnifiedOccupation[]> {
  await ensureLoaded();
  return _bySocCode!.get(code) || [];
}

/** Look up by DOT code (e.g., "079.101-018") — returns the unified occ containing this DOT title */
export async function getByDotCode(code: string): Promise<UnifiedOccupation | null> {
  await ensureLoaded();
  return _byDotCode!.get(code) || null;
}

/** Look up by any code type — tries O*NET, SOC, then DOT */
export async function getByAnyCode(code: string): Promise<UnifiedOccupation | null> {
  const byOnet = await getByOnetCode(code);
  if (byOnet) return byOnet;

  const bySoc = await getBySocCode(code);
  if (bySoc.length > 0) return bySoc[0];

  return getByDotCode(code);
}

// ─── Trait Vector Conversion ───────────────────────────────────────

// Map from unified trait keys to engine TraitKey names
const UNIFIED_TO_ENGINE_KEY: Record<string, TraitKey> = {
  reasoning: "reasoning",
  math: "math",
  language: "language",
  spatialPerception: "spatialPerception",
  formPerception: "formPerception",
  clericalPerception: "clericalPerception",
  motorCoordination: "motorCoordination",
  fingerDexterity: "fingerDexterity",
  manualDexterity: "manualDexterity",
  eyeHandFoot: "eyeHandFoot",
  colorDiscrimination: "colorDiscrimination",
  strength: "strength",
  climbing: "climbBalance",
  stooping: "stoopKneel",
  reaching: "reachHandle",
  talking: "talkHear",
  hearing: "talkHear",  // hearing folds into talkHear — use max
  seeing: "see",
  workLocation: "workLocation",
  cold: "extremeCold",
  heat: "extremeHeat",
  wetness: "wetnessHumidity",
  noise: "noiseVibration",
  hazards: "hazards",
};

/**
 * Convert a unified occupation's trait demands into the engine's TraitVector format.
 * Also returns a source map for provenance tracking.
 */
export function toTraitVector(occ: UnifiedOccupation): {
  demands: TraitVector;
  sources: Partial<Record<string, TraitSource>>;
} {
  const demands: Record<string, number | null> = {};
  const sources: Record<string, TraitSource> = {} as Record<string, TraitSource>;

  const sourceMap: Record<string, TraitSource> = {
    ors: "ORS", dot: "DOT", onet: "ONET", proxy: "proxy",
  } as Record<string, TraitSource>;

  // Initialize all to null
  for (const key of TRAIT_KEYS) {
    demands[key] = null;
    sources[key] = "proxy" as TraitSource;
  }

  for (const [unifiedKey, trait] of Object.entries(occ.traits)) {
    const engineKey = UNIFIED_TO_ENGINE_KEY[unifiedKey];
    if (!engineKey) continue;

    if (trait.source !== "proxy") {
      const mappedSource = sourceMap[trait.source] || ("proxy" as TraitSource);
      // For talkHear: take the max of talking and hearing
      if (engineKey === "talkHear") {
        const current = demands[engineKey];
        if (current === null || trait.value > current) {
          demands[engineKey] = trait.value;
          sources[engineKey] = mappedSource;
        }
      } else {
        demands[engineKey] = trait.value;
        sources[engineKey] = mappedSource;
      }
    }
  }

  // Map "dustsFumes" — not in unified, default to proxy
  if (demands.dustsFumes === undefined) {
    demands.dustsFumes = null;
    sources.dustsFumes = "proxy" as TraitSource;
  }

  return {
    demands: demands as TraitVector,
    sources: sources as Partial<Record<string, TraitSource>>,
  };
}

// ─── SOC Major Group Definitions ───────────────────────────────────

export const SOC_MAJOR_GROUPS: Record<string, string> = {
  "11": "Management",
  "13": "Business and Financial Operations",
  "15": "Computer and Mathematical",
  "17": "Architecture and Engineering",
  "19": "Life, Physical, and Social Science",
  "21": "Community and Social Service",
  "23": "Legal",
  "25": "Educational Instruction and Library",
  "27": "Arts, Design, Entertainment, Sports, and Media",
  "29": "Healthcare Practitioners and Technical",
  "31": "Healthcare Support",
  "33": "Protective Service",
  "35": "Food Preparation and Serving Related",
  "37": "Building and Grounds Cleaning and Maintenance",
  "39": "Personal Care and Service",
  "41": "Sales and Related",
  "43": "Office and Administrative Support",
  "45": "Farming, Fishing, and Forestry",
  "47": "Construction and Extraction",
  "49": "Installation, Maintenance, and Repair",
  "51": "Production",
  "53": "Transportation and Material Moving",
};

/** Get major group code from an O*NET or SOC code */
export function getMajorGroup(code: string): string {
  return code.slice(0, 2);
}

/** Get major group name */
export function getMajorGroupName(code: string): string {
  return SOC_MAJOR_GROUPS[getMajorGroup(code)] || "Unknown";
}
