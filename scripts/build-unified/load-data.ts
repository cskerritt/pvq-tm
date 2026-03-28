/**
 * Standalone data loaders for the unified occupation build script.
 * Uses fs.readFileSync instead of Next.js module imports.
 */

import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(__dirname, "../../src/data");

function loadJSON<T>(filename: string): T {
  const raw = fs.readFileSync(path.join(DATA_DIR, filename), "utf-8");
  return JSON.parse(raw) as T;
}

// ─── Type Definitions ─────────────────────────────────────────────

export interface DOTEntry {
  t: string;       // title
  s: number;       // SVP (1-9)
  str: string;     // strength (S, L, M, H, V)
  r: number;       // GED Reasoning (1-6)
  m: number;       // GED Math (1-6)
  l: number;       // GED Language (1-6)
  ind?: string;    // industry designation
  dlu?: string;    // date last updated
  dpt?: { data: number; people: number; things: number };
  goe?: string;    // GOE code
  xw?: string;     // OES crosswalk code
}

export interface ONETElement {
  id: string;
  n: string;
  v?: number;  // importance
  l?: number;  // level
}

export interface ONETTask {
  id: string;
  t: string;
  im?: number;
}

export interface ONETToolTech {
  t: string;
  c: string;
  h?: boolean;
}

export interface ONETDWA {
  id: string;
  t: string;
}

export interface ONETFull {
  t: string;
  d: string;
  jz?: number;
  ta?: ONETTask[];
  sk?: ONETElement[];
  ab?: ONETElement[];
  kn?: ONETElement[];
  wa?: ONETElement[];
  wc?: ONETElement[];
  tt?: ONETToolTech[];
  dw?: ONETDWA[];
  ws?: ONETElement[];
  in?: ONETElement[];
  ed?: Array<{ id: string; n: string; s: string; cat: number | null; v: number }>;
  at?: string[];
}

export interface OEWSEntry {
  t: string;
  e: number | null;
  m: number | null;
  md: number | null;
  p10: number | null;
  p25: number | null;
  p75: number | null;
  p90: number | null;
}

export interface ORSEntry {
  n: string;
  p: Record<string, { t: string; v: string }[]>;
  e?: Record<string, { t: string; v: string }[]>;
  c?: Record<string, { t: string; v: string }[]>;
  d?: Record<string, { t: string; v: string }[]>;
}

export interface BLSProjection {
  t: string;
  be: number | null;
  pe: number | null;
  cn: number | null;
  cp: number | null;
  oa: number | null;
}

// ─── Loaders ─────────────────────────────────────────────────────

export function loadDOT(): Record<string, DOTEntry> {
  return loadJSON<Record<string, DOTEntry>>("dot-data.json");
}

export function loadONETFull(): Record<string, ONETFull> {
  return loadJSON<Record<string, ONETFull>>("onet-full.json");
}

export function loadONETOccupations(): Record<string, { t: string; jz: number | null }> {
  return loadJSON("onet-occupations.json");
}

export function loadOEWS(): Record<string, OEWSEntry> {
  return loadJSON<Record<string, OEWSEntry>>("oews-data.json");
}

export function loadORS(): Record<string, ORSEntry> {
  return loadJSON<Record<string, ORSEntry>>("ors-data.json");
}

export function loadBLSProjections(): Record<string, BLSProjection> {
  return loadJSON<Record<string, BLSProjection>>("bls-projections.json");
}
