/**
 * Data loaders for local occupational datasets.
 *
 * Uses JSON module imports (resolved by Turbopack/webpack) instead of
 * fs/path/process.cwd to avoid Edge Runtime warnings in Next.js.
 *
 * All loaders use module-level caching to avoid re-parsing large JSON
 * files on every call. The O*NET full dataset is 26 MB — without caching,
 * every API call that touches O*NET data would re-parse it.
 */

export interface ORSOccupationData {
  n: string; // occupation name
  p: Record<string, { t: string; v: string }[]>; // physical demands
  e: Record<string, { t: string; v: string }[]>; // environmental conditions
  c: Record<string, { t: string; v: string }[]>; // cognitive/mental
  d: Record<string, { t: string; v: string }[]>; // education/training/experience
}

export interface OEWSOccupationData {
  t: string;       // title
  e: number | null; // employment
  m: number | null; // annual mean wage
  md: number | null; // annual median wage
  p10: number | null; // annual 10th percentile
  p25: number | null; // annual 25th percentile
  p75: number | null; // annual 75th percentile
  p90: number | null; // annual 90th percentile
}

export interface DOTOccupationData {
  t: string;       // title
  s: number;       // SVP (1-9)
  str: string;     // strength level (S, L, M, H, V)
  r: number;       // GED Reasoning (1-6)
  m: number;       // GED Math (1-6)
  l: number;       // GED Language (1-6)
  ind?: string;    // industry designation
  dlu?: string;    // date of last update
  dpt?: { data: number; people: number; things: number };
  goe?: string;    // GOE code
  xw?: string;     // O*NET crosswalk code (old format)
}

export interface ONETOccupationData {
  t: string;       // title
  jz: number | null; // job zone
}

/** Compact element entry in the full O*NET dataset */
export interface ONETElement {
  id: string;  // element ID (e.g., "2.A.1.a")
  n: string;   // element name
  v?: number;  // importance value
  l?: number;  // level value
}

/** Compact task entry */
export interface ONETTask {
  id: string;  // task ID
  t: string;   // task text
  im?: number; // importance score
}

/** Compact tool/technology entry */
export interface ONETToolTech {
  t: string;   // title (tool/tech name)
  c: string;   // category (commodity title)
  h?: boolean; // hot technology flag
}

/** Compact DWA entry */
export interface ONETDWA {
  id: string;  // DWA ID
  t: string;   // DWA title
}

/** Compact related occupation entry */
export interface ONETRelated {
  c: string;   // related O*NET-SOC code
  t: string;   // related title
}

/** Compact education/training entry */
export interface ONETEducation {
  id: string;  // element ID
  n: string;   // element name
  s: string;   // scale ID
  cat: number | null; // category
  v: number;   // data value
}

/** Full O*NET occupation data (compact keys from onet-full.json) */
export interface ONETFullOccupationData {
  t: string;               // title
  d: string;               // description
  jz?: number;             // job zone (1-5)
  ta?: ONETTask[];         // tasks
  sk?: ONETElement[];      // skills
  ab?: ONETElement[];      // abilities
  kn?: ONETElement[];      // knowledge
  wa?: ONETElement[];      // work activities
  wc?: ONETElement[];      // work context
  tt?: ONETToolTech[];     // tools & technology
  dw?: ONETDWA[];          // detailed work activities
  ro?: ONETRelated[];      // related occupations
  ws?: ONETElement[];      // work styles
  in?: ONETElement[];      // interests (RIASEC)
  ed?: ONETEducation[];    // education/training/experience
  at?: string[];           // alternate titles
}

export interface JOLTSYearData {
  jo: number | null; // job openings (thousands)
  hi: number | null; // hires (thousands)
}

export interface JOLTSIndustryData {
  n: string;                          // industry name
  d: Record<string, JOLTSYearData>;   // year → data
}

export interface MetroOEWSData {
  n: string; // Metro area name
  o: Record<string, number>; // SOC code → employment count
}

export interface BLSProjectionsData {
  t: string;        // title
  be: number | null; // base year employment (2024)
  pe: number | null; // projected year employment (2034)
  cn: number | null; // employment change, numeric
  cp: number | null; // employment change, percent
  oa: number | null; // annual openings (avg 2024-34)
}

// ─── Module-Level Caches ─────────────────────────────────────────────

let _orsCache: Record<string, ORSOccupationData> | null = null;
let _oewsCache: Record<string, OEWSOccupationData> | null = null;
let _dotCache: Record<string, DOTOccupationData> | null = null;
let _onetCache: Record<string, ONETOccupationData> | null = null;
let _onetFullCache: Record<string, ONETFullOccupationData> | null = null;
let _metroOewsCache: Record<string, MetroOEWSData> | null = null;
let _joltsCache: Record<string, JOLTSIndustryData> | null = null;
let _blsProjectionsCache: Record<string, BLSProjectionsData> | null = null;

// ─── Cached Loaders ─────────────────────────────────────────────────

/**
 * Load ORS dataset from bundled JSON.
 * Returns a map of 6-digit SOC code → ORS data.
 */
export async function loadORSData(): Promise<Record<string, ORSOccupationData>> {
  if (!_orsCache) {
    const data = await import("@/data/ors-data.json");
    _orsCache = data.default as unknown as Record<string, ORSOccupationData>;
  }
  return _orsCache;
}

/**
 * Load OEWS dataset from bundled JSON.
 * Returns a map of SOC code (format "XX-XXXX") → OEWS wage data.
 */
export async function loadOEWSData(): Promise<Record<string, OEWSOccupationData>> {
  if (!_oewsCache) {
    const data = await import("@/data/oews-data.json");
    _oewsCache = data.default as unknown as Record<string, OEWSOccupationData>;
  }
  return _oewsCache;
}

/**
 * Load DOT dataset from bundled JSON.
 * Returns a map of DOT code (format "XXX.XXX-XXX") → DOT occupation data.
 */
export async function loadDOTData(): Promise<Record<string, DOTOccupationData>> {
  if (!_dotCache) {
    const data = await import("@/data/dot-data.json");
    _dotCache = data.default as unknown as Record<string, DOTOccupationData>;
  }
  return _dotCache;
}

/**
 * Load O*NET occupation list from bundled JSON (lightweight — 62 KB).
 * Returns a map of O*NET code (format "XX-XXXX.XX") → basic occupation data.
 */
export async function loadONETData(): Promise<Record<string, ONETOccupationData>> {
  if (!_onetCache) {
    const data = await import("@/data/onet-occupations.json");
    _onetCache = data.default as unknown as Record<string, ONETOccupationData>;
  }
  return _onetCache;
}

/**
 * Load complete O*NET 30.2 dataset from bundled JSON (26 MB).
 * Contains ALL data for 1,016 occupations: tasks, skills, abilities,
 * knowledge, work activities, work context, tools/tech, DWAs,
 * related occupations, work styles, interests, education, alternate titles.
 *
 * Returns a map of O*NET code (format "XX-XXXX.XX") → full occupation data.
 */
export async function loadONETFullData(): Promise<Record<string, ONETFullOccupationData>> {
  if (!_onetFullCache) {
    const data = await import("@/data/onet-full.json");
    _onetFullCache = data.default as unknown as Record<string, ONETFullOccupationData>;
  }
  return _onetFullCache;
}

/**
 * Load metro-area OEWS employment data from bundled JSON.
 * Returns a map of BLS area code → { name, occupations: { socCode → employment } }
 * Contains 393 metropolitan areas with per-occupation employment counts.
 */
export async function loadMetroOEWSData(): Promise<Record<string, MetroOEWSData>> {
  if (!_metroOewsCache) {
    const data = await import("@/data/oews-metro-data.json");
    _metroOewsCache = data.default as unknown as Record<string, MetroOEWSData>;
  }
  return _metroOewsCache;
}

export async function loadJOLTSData(): Promise<Record<string, JOLTSIndustryData>> {
  if (!_joltsCache) {
    const data = await import("@/data/jolts-data.json");
    _joltsCache = data.default as unknown as Record<string, JOLTSIndustryData>;
  }
  return _joltsCache;
}

/**
 * Load BLS Employment Projections 2024-2034 from bundled JSON.
 * Source: BLS Table 1.10 "Occupational projections and worker characteristics"
 * Returns a map of SOC code (format "XX-XXXX") → projections data.
 */
export async function loadBLSProjectionsData(): Promise<Record<string, BLSProjectionsData>> {
  if (!_blsProjectionsCache) {
    const data = await import("@/data/bls-projections.json");
    _blsProjectionsCache = data.default as unknown as Record<string, BLSProjectionsData>;
  }
  return _blsProjectionsCache;
}
