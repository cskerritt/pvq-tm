/**
 * Data loaders for local occupational datasets.
 *
 * Uses JSON module imports (resolved by Turbopack/webpack) instead of
 * fs/path/process.cwd to avoid Edge Runtime warnings in Next.js.
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

/**
 * Load ORS dataset from bundled JSON.
 * Returns a map of 6-digit SOC code → ORS data.
 */
export async function loadORSData(): Promise<Record<string, ORSOccupationData>> {
  // Dynamic JSON import — resolved by the bundler, no fs/path needed
  const data = await import("@/data/ors-data.json");
  return data.default as unknown as Record<string, ORSOccupationData>;
}

/**
 * Load OEWS dataset from bundled JSON.
 * Returns a map of SOC code (format "XX-XXXX") → OEWS wage data.
 */
export async function loadOEWSData(): Promise<Record<string, OEWSOccupationData>> {
  // Dynamic JSON import — resolved by the bundler, no fs/path needed
  const data = await import("@/data/oews-data.json");
  return data.default as unknown as Record<string, OEWSOccupationData>;
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

/**
 * Load DOT dataset from bundled JSON.
 * Returns a map of DOT code (format "XXX.XXX-XXX") → DOT occupation data.
 */
export async function loadDOTData(): Promise<Record<string, DOTOccupationData>> {
  const data = await import("@/data/dot-data.json");
  return data.default as unknown as Record<string, DOTOccupationData>;
}

export interface ONETOccupationData {
  t: string;       // title
  jz: number | null; // job zone
}

/**
 * Load O*NET occupation list from bundled JSON (lightweight — 62 KB).
 * Returns a map of O*NET code (format "XX-XXXX.XX") → basic occupation data.
 */
export async function loadONETData(): Promise<Record<string, ONETOccupationData>> {
  const data = await import("@/data/onet-occupations.json");
  return data.default as unknown as Record<string, ONETOccupationData>;
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

/**
 * Load complete O*NET 30.2 dataset from bundled JSON (26 MB).
 * Contains ALL data for 1,016 occupations: tasks, skills, abilities,
 * knowledge, work activities, work context, tools/tech, DWAs,
 * related occupations, work styles, interests, education, alternate titles.
 *
 * Returns a map of O*NET code (format "XX-XXXX.XX") → full occupation data.
 */
export async function loadONETFullData(): Promise<Record<string, ONETFullOccupationData>> {
  const data = await import("@/data/onet-full.json");
  return data.default as unknown as Record<string, ONETFullOccupationData>;
}

export interface JOLTSYearData {
  jo: number | null; // job openings (thousands)
  hi: number | null; // hires (thousands)
}

export interface JOLTSIndustryData {
  n: string;                          // industry name
  d: Record<string, JOLTSYearData>;   // year → data
}

/**
 * Load JOLTS (Job Openings and Labor Turnover Survey) data from bundled JSON.
 * Source: BLS Public Data API v2 — JOLTS series JTU*JOL and JTU*HIL.
 * Returns a map of NAICS industry code → { name, yearlyData }.
 * Values are in thousands (matching raw BLS format).
 */
export async function loadJOLTSData(): Promise<Record<string, JOLTSIndustryData>> {
  const data = await import("@/data/jolts-data.json");
  return data.default as unknown as Record<string, JOLTSIndustryData>;
}

export interface BLSProjectionsData {
  t: string;        // title
  be: number | null; // base year employment (2024)
  pe: number | null; // projected year employment (2034)
  cn: number | null; // employment change, numeric
  cp: number | null; // employment change, percent
  oa: number | null; // annual openings (avg 2024-34)
}

/**
 * Load BLS Employment Projections 2024-2034 from bundled JSON.
 * Source: BLS Table 1.10 "Occupational projections and worker characteristics"
 * Returns a map of SOC code (format "XX-XXXX") → projections data.
 */
export async function loadBLSProjectionsData(): Promise<Record<string, BLSProjectionsData>> {
  const data = await import("@/data/bls-projections.json");
  return data.default as unknown as Record<string, BLSProjectionsData>;
}
