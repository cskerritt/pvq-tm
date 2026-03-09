/**
 * Data loaders for local BLS datasets.
 *
 * These functions load pre-converted JSON datasets from src/data/.
 * They use dynamic imports guarded by runtime checks to avoid
 * Edge Runtime warnings in Next.js.
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
 * Load ORS dataset from local JSON file.
 * Returns a map of 6-digit SOC code → ORS data.
 */
export async function loadORSData(): Promise<Record<string, ORSOccupationData>> {
  const fs = await import("fs");
  const path = await import("path");
  const filePath = path.join(process.cwd(), "src/data/ors-data.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

/**
 * Load OEWS dataset from local JSON file.
 * Returns a map of SOC code (format "XX-XXXX") → OEWS wage data.
 */
export async function loadOEWSData(): Promise<Record<string, OEWSOccupationData>> {
  const fs = await import("fs");
  const path = await import("path");
  const filePath = path.join(process.cwd(), "src/data/oews-data.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}
