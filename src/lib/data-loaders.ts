/**
 * Data loaders for local BLS datasets.
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
