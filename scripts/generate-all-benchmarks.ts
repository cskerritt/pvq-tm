#!/usr/bin/env tsx
/**
 * Generate comprehensive benchmark fixtures from ALL occupations
 * in the PVQ-TM database — every DOT code and O*NET occupation.
 *
 * Usage: npx tsx scripts/generate-all-benchmarks.ts
 *
 * Outputs:
 *   src/lib/engine/__fixtures__/all-dot-benchmarks.json   (12,726 entries)
 *   src/lib/engine/__fixtures__/all-onet-benchmarks.json  (1,016 entries)
 */

import * as fs from "fs";
import * as path from "path";

// ─── Load data files ──────────────────────────────────────────────────────────

const DATA_DIR = path.resolve(__dirname, "../src/data");
const FIXTURES_DIR = path.resolve(
  __dirname,
  "../src/lib/engine/__fixtures__"
);

interface DOTEntry {
  t: string; // title
  s: number; // SVP
  str: string; // strength code (S/L/M/H/V)
  r: number; // GED Reasoning (1-6)
  m: number; // GED Math (1-6)
  l: number; // GED Language (1-6)
  ind: string; // industry
  dlu: string; // date last updated
  dpt: { data: number; people: number; things: number }; // Worker Functions
  goe: string; // Guide for Occupational Exploration code
  xw: string; // Census crosswalk code
}

interface ONETEntry {
  t: string; // title
  d: string; // description
  jz: number; // job zone (1-5)
  ta: { id: string; t: string; im: number }[]; // tasks
  sk: { id: string; n: string; v: number; l: number }[]; // skills
  ab: { id: string; n: string; v: number; l: number }[]; // abilities
  kn: { id: string; n: string; v: number; l: number }[]; // knowledge
  wa: { id: string; n: string; v: number; l: number }[]; // work activities
  wc: { id: string; n: string; v: number }[]; // work context
  tt: { t: string; c: string; h?: boolean }[]; // tech tools
  dw: { id: string; t: string }[]; // detailed work activities
}

interface OEWSEntry {
  t: string;
  e: number | null; // employment
  m: number | null; // mean wage
  md: number | null; // median wage
  p10: number | null;
  p25: number | null;
  p75: number | null;
  p90: number | null;
}

interface ORSEntry {
  n: string; // name
  p: Record<string, { t: string; v: string | number }[]>; // physical demands
  e: Record<string, { t: string; v: string | number }[]>; // environmental conditions
  c?: unknown;
  d?: unknown;
}

console.log("Loading data files...");

const dotData: Record<string, DOTEntry> = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "dot-data.json"), "utf-8")
);
const onetData: Record<string, ONETEntry> = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "onet-full.json"), "utf-8")
);
const oewsData: Record<string, OEWSEntry> = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "oews-data.json"), "utf-8")
);
const orsData: Record<string, ORSEntry> = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "ors-data.json"), "utf-8")
);

console.log(`  DOT entries:  ${Object.keys(dotData).length}`);
console.log(`  O*NET entries: ${Object.keys(onetData).length}`);
console.log(`  OEWS entries:  ${Object.keys(oewsData).length}`);
console.log(`  ORS entries:   ${Object.keys(orsData).length}`);

// ─── Normalization functions (mirroring traits.ts EXACTLY) ────────────────────

function normalizeDOTGED(gedLevel: number): number {
  if (gedLevel < 1) return 0;
  if (gedLevel > 6) return 4;
  return Math.round(((gedLevel - 1) * (4 / 5)) * 100) / 100;
}

function normalizeDOTAptitude(dotValue: number): number {
  return Math.max(0, 5 - dotValue);
}

function normalizeDOTStrength(code: string): number {
  const map: Record<string, number> = { S: 0, L: 1, M: 2, H: 3, V: 4 };
  return map[code.toUpperCase()] ?? 0;
}

function normalizeDOTPhysical(code: string): number {
  const map: Record<string, number> = { N: 0, S: 1, O: 2, F: 3, C: 4 };
  return map[code.toUpperCase()] ?? 0;
}

// ─── VQ Regression (mirroring vocational-quotient.ts EXACTLY) ─────────────────

const VQ_INTERCEPT = 34.56707;

const VQ_WEIGHTS: readonly number[] = [
  5.299567, 2.213121, 1.424168, 2.241977, 1.783972, 1.95779, 1.648707,
  1.631036, 2.126616, 1.403101, 1.431217, 1.84953, 0.774892, -0.165864,
  0.776669, 4.542681, 0.201044, 1.470938, 0.330026, 0.504727, 0.371165,
  1.217675, -0.200072, 0.298293,
];

const TRAIT_KEYS = [
  "reasoning", "math", "language",
  "spatialPerception", "formPerception", "clericalPerception",
  "motorCoordination", "fingerDexterity", "manualDexterity",
  "eyeHandFoot", "colorDiscrimination",
  "strength", "climbBalance", "stoopKneel", "reachHandle",
  "talkHear", "see",
  "workLocation", "extremeCold", "extremeHeat",
  "wetnessHumidity", "noiseVibration", "hazards", "dustsFumes",
] as const;

type TraitKey = (typeof TRAIT_KEYS)[number];
type TraitVector = Record<TraitKey, number | null>;

type TraitScaleGroup = "ged" | "apt" | "pd1" | "pdBinary" | "ec1" | "ecBinary";

const TRAIT_SCALE: Record<TraitKey, TraitScaleGroup> = {
  reasoning: "ged",
  math: "ged",
  language: "ged",
  spatialPerception: "apt",
  formPerception: "apt",
  clericalPerception: "apt",
  motorCoordination: "apt",
  fingerDexterity: "apt",
  manualDexterity: "apt",
  eyeHandFoot: "apt",
  colorDiscrimination: "apt",
  strength: "pd1",
  climbBalance: "pdBinary",
  stoopKneel: "pdBinary",
  reachHandle: "pdBinary",
  talkHear: "pdBinary",
  see: "pdBinary",
  workLocation: "ec1",
  extremeCold: "ecBinary",
  extremeHeat: "ecBinary",
  wetnessHumidity: "ecBinary",
  noiseVibration: "ecBinary",
  hazards: "ecBinary",
  dustsFumes: "ecBinary",
};

const VQS_DEFAULT_PROFILE: readonly number[] = [
  3, 2, 2, 2, 3, 2, 3, 2, 3, 2, 2, 2, 0, 0, 1, 0, 1, 2, 0, 0, 0, 1, 0, 0,
];

function toVqsNativeScale(key: TraitKey, normalized: number): number {
  const scale = TRAIT_SCALE[key];
  switch (scale) {
    case "ged":
      return Math.round((normalized / 4) * 5) + 1;
    case "apt":
    case "pd1":
      return Math.round((normalized / 4) * 4) + 1;
    case "pdBinary":
    case "ecBinary":
      return normalized >= 2 ? 1 : 0;
    case "ec1":
      return Math.round((normalized / 4) * 2) + 1;
  }
}

function classifyVQBand(vq: number): 1 | 2 | 3 | 4 {
  if (vq < 100) return 1;
  if (vq < 109) return 2;
  if (vq < 144) return 3;
  return 4;
}

function computeVQ(demands: TraitVector): { vq: number; band: 1 | 2 | 3 | 4 } {
  let score = VQ_INTERCEPT;

  for (let i = 0; i < TRAIT_KEYS.length; i++) {
    const key = TRAIT_KEYS[i];
    const normalizedVal = demands[key];
    const weight = VQ_WEIGHTS[i];

    let nativeVal: number;
    if (normalizedVal === null || normalizedVal === undefined) {
      nativeVal = VQS_DEFAULT_PROFILE[i];
    } else {
      nativeVal = toVqsNativeScale(key, normalizedVal);
    }

    score += weight * nativeVal;
  }

  const clamped = Math.round(Math.max(68, Math.min(158, score)) * 100) / 100;
  return { vq: clamped, band: classifyVQBand(clamped) };
}

// ─── DPT-to-Trait Proxy Mapping ───────────────────────────────────────────────
//
// The DOT data file does NOT include individual aptitude codes (G,V,N,S,P,Q,K,F,M,E,C)
// or physical demand frequency codes — only GED (r,m,l), SVP, strength, and DPT
// (data/people/things worker functions). We derive proxy trait values from DPT:
//
// DPT Data levels (0=Synthesizing ... 6=Comparing ... 8=none)
// DPT People levels (0=Mentoring ... 6=Speaking-Signaling ... 8=none)
// DPT Things levels (0=Setting Up ... 7=Handling ... 8=none)
//
// Lower DPT number = higher complexity → higher trait demand.

function dptDataToAptitudes(dataLevel: number): {
  spatialPerception: number;
  formPerception: number;
  clericalPerception: number;
} {
  // Data function complexity inversely maps to cognitive aptitudes
  // 0=Synthesizing(highest), 1=Coordinating, 2=Analyzing, 3=Compiling,
  // 4=Computing, 5=Copying, 6=Comparing, 7-8=low/none
  const normalized = Math.max(0, Math.min(4, Math.round((Math.max(0, 6 - dataLevel) / 6) * 4)));
  return {
    spatialPerception: Math.max(0, normalized - 1), // Data work has modest spatial needs
    formPerception: normalized,                      // Form perception tracks data complexity
    clericalPerception: Math.min(4, normalized + 1), // Clerical perception is high for data work
  };
}

function dptPeopleToTraits(peopleLevel: number): {
  talkHear: number;
  see: number;
} {
  // People function: 0=Mentoring(highest), 1=Negotiating, 2=Instructing,
  // 3=Supervising, 4=Diverting, 5=Persuading, 6=Speaking-Signaling, 7=Serving, 8=none
  const normalized = Math.max(0, Math.min(4, Math.round((Math.max(0, 8 - peopleLevel) / 8) * 4)));
  return {
    talkHear: Math.min(4, normalized),
    see: Math.min(4, Math.max(1, Math.round(normalized * 0.75))), // Most jobs need basic vision
  };
}

function dptThingsToTraits(thingsLevel: number): {
  motorCoordination: number;
  fingerDexterity: number;
  manualDexterity: number;
  eyeHandFoot: number;
  colorDiscrimination: number;
} {
  // Things function: 0=Setting Up(highest), 1=Precision Working, 2=Operating-Controlling,
  // 3=Driving-Operating, 4=Manipulating, 5=Tending, 6=Feeding-Offbearing, 7=Handling, 8=none
  const normalized = Math.max(0, Math.min(4, Math.round((Math.max(0, 7 - thingsLevel) / 7) * 4)));
  return {
    motorCoordination: normalized,
    fingerDexterity: thingsLevel <= 1 ? Math.min(4, normalized + 1) : normalized, // Precision work needs high finger dex
    manualDexterity: normalized,
    eyeHandFoot: thingsLevel <= 3 ? Math.max(1, Math.round(normalized * 0.75)) : Math.round(normalized * 0.5),
    colorDiscrimination: thingsLevel <= 1 ? Math.max(1, Math.round(normalized * 0.5)) : 0,
  };
}

function dptToPhysicalDemands(dpt: { data: number; people: number; things: number }, strength: number): {
  climbBalance: number;
  stoopKneel: number;
  reachHandle: number;
} {
  // Physical demands proxy based on things complexity and strength
  const thingsActive = dpt.things <= 4; // Active things work
  return {
    climbBalance: strength >= 3 && thingsActive ? Math.min(4, strength - 1) : (strength >= 2 ? 1 : 0),
    stoopKneel: thingsActive ? Math.min(4, Math.max(1, strength)) : (strength >= 2 ? 1 : 0),
    reachHandle: thingsActive ? Math.min(4, Math.max(1, strength + 1)) : Math.max(1, Math.round(strength * 0.5)),
  };
}

function dptToEnvironmental(dpt: { data: number; people: number; things: number }, strength: number): {
  workLocation: number;
  extremeCold: number;
  extremeHeat: number;
  wetnessHumidity: number;
  noiseVibration: number;
  hazards: number;
  dustsFumes: number;
} {
  // Environmental conditions proxy — heavier/more physical jobs more likely outdoors, exposed
  const isPhysical = strength >= 2 && dpt.things <= 4;
  const isHeavyPhysical = strength >= 3 && dpt.things <= 3;
  return {
    workLocation: isPhysical ? Math.min(4, strength - 1) : 0,
    extremeCold: isHeavyPhysical ? 1 : 0,
    extremeHeat: isHeavyPhysical ? 1 : 0,
    wetnessHumidity: isHeavyPhysical ? 1 : 0,
    noiseVibration: isPhysical ? Math.min(4, Math.max(1, strength - 1)) : (dpt.things <= 5 ? 1 : 0),
    hazards: isHeavyPhysical ? Math.min(4, strength - 2) : 0,
    dustsFumes: isHeavyPhysical ? Math.min(4, strength - 2) : 0,
  };
}

// ─── Generate DOT Benchmarks ──────────────────────────────────────────────────

interface DOTBenchmark {
  id: string;
  title: string;
  dotCode: string;
  onetCode: string | null;
  svp: number;
  strength: string;
  traitVector: Record<string, number>;
  traitSources: Record<string, string>;
  expectedVQ: number;
  expectedVQBand: 1 | 2 | 3 | 4;
}

function sanitizeId(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, "-");
}

console.log("\nGenerating DOT benchmarks...");

const dotBenchmarks: DOTBenchmark[] = [];
const dotCodes = Object.keys(dotData);
let processed = 0;

for (const dotCode of dotCodes) {
  const entry = dotData[dotCode];

  // Build trait vector from available DOT data
  const strengthNorm = normalizeDOTStrength(entry.str);
  const dpt = entry.dpt;

  // GED traits
  const reasoning = normalizeDOTGED(entry.r);
  const math = normalizeDOTGED(entry.m);
  const language = normalizeDOTGED(entry.l);

  // Aptitudes derived from DPT
  const dataApts = dptDataToAptitudes(dpt.data);
  const thingsApts = dptThingsToTraits(dpt.things);
  const peopleTraits = dptPeopleToTraits(dpt.people);

  // Physical demands from DPT + strength
  const physDemands = dptToPhysicalDemands(dpt, strengthNorm);

  // Environmental from DPT + strength
  const envTraits = dptToEnvironmental(dpt, strengthNorm);

  const traitVector: TraitVector = {
    reasoning,
    math,
    language,
    spatialPerception: dataApts.spatialPerception,
    formPerception: dataApts.formPerception,
    clericalPerception: dataApts.clericalPerception,
    motorCoordination: thingsApts.motorCoordination,
    fingerDexterity: thingsApts.fingerDexterity,
    manualDexterity: thingsApts.manualDexterity,
    eyeHandFoot: thingsApts.eyeHandFoot,
    colorDiscrimination: thingsApts.colorDiscrimination,
    strength: strengthNorm,
    climbBalance: physDemands.climbBalance,
    stoopKneel: physDemands.stoopKneel,
    reachHandle: physDemands.reachHandle,
    talkHear: peopleTraits.talkHear,
    see: peopleTraits.see,
    workLocation: envTraits.workLocation,
    extremeCold: envTraits.extremeCold,
    extremeHeat: envTraits.extremeHeat,
    wetnessHumidity: envTraits.wetnessHumidity,
    noiseVibration: envTraits.noiseVibration,
    hazards: envTraits.hazards,
    dustsFumes: envTraits.dustsFumes,
  };

  // Build trait sources — all derived from DOT data
  const traitSources: Record<string, string> = {};
  for (const key of TRAIT_KEYS) {
    traitSources[key] = "DOT";
  }

  // Compute VQ
  const { vq, band } = computeVQ(traitVector);

  // Clean up trait vector: replace null with 0 for output
  const cleanVector: Record<string, number> = {};
  for (const key of TRAIT_KEYS) {
    cleanVector[key] = traitVector[key] ?? 0;
  }

  dotBenchmarks.push({
    id: `dot-${sanitizeId(dotCode)}`,
    title: entry.t,
    dotCode,
    onetCode: null, // No reliable DOT→O*NET crosswalk in this dataset
    svp: entry.s,
    strength: entry.str,
    traitVector: cleanVector,
    traitSources,
    expectedVQ: vq,
    expectedVQBand: band,
  });

  processed++;
  if (processed % 1000 === 0) {
    console.log(`  DOT progress: ${processed}/${dotCodes.length}`);
  }
}

console.log(`  DOT complete: ${dotBenchmarks.length} benchmarks generated`);

// ─── Generate O*NET Benchmarks ────────────────────────────────────────────────

interface ONETBenchmark {
  id: string;
  title: string;
  onetCode: string;
  description: string;
  jobZone: number;
  tasks: string[];
  knowledge: { name: string; importance: number }[];
  skills: { name: string; importance: number }[];
  tools: { name: string; category: string }[];
  abilities: { id: string; name: string; importance: number; level: number }[];
  oewsData: {
    employment: number | null;
    medianWage: number | null;
    meanWage: number | null;
    pct10: number | null;
    pct25: number | null;
    pct75: number | null;
    pct90: number | null;
  } | null;
  orsAvailable: boolean;
  orsTraits: Record<string, number> | null;
}

console.log("\nGenerating O*NET benchmarks...");

const onetBenchmarks: ONETBenchmark[] = [];
const onetCodes = Object.keys(onetData);
let onetProcessed = 0;
let oewsMatched = 0;
let orsMatched = 0;

for (const onetCode of onetCodes) {
  const entry = onetData[onetCode];

  // Tasks: first 5
  const tasks = (entry.ta || []).slice(0, 5).map((t) => t.t);

  // Knowledge: top 5 by importance (v field)
  const knowledge = (entry.kn || [])
    .sort((a, b) => b.v - a.v)
    .slice(0, 5)
    .map((k) => ({ name: k.n, importance: k.v }));

  // Skills: top 5 by importance (v field)
  const skills = (entry.sk || [])
    .sort((a, b) => b.v - a.v)
    .slice(0, 5)
    .map((s) => ({ name: s.n, importance: s.v }));

  // Tools: first 5
  const tools = (entry.tt || []).slice(0, 5).map((t) => ({ name: t.t, category: t.c }));

  // Abilities: all
  const abilities = (entry.ab || []).map((a) => ({
    id: a.id,
    name: a.n,
    importance: a.v,
    level: a.l,
  }));

  // Match OEWS data by SOC code (strip .XX suffix from O*NET code)
  const socCode = onetCode.replace(/\.\d+$/, "");
  const oews = oewsData[socCode] || null;
  let oewsResult: ONETBenchmark["oewsData"] = null;
  if (oews) {
    oewsMatched++;
    oewsResult = {
      employment: oews.e,
      medianWage: oews.md,
      meanWage: oews.m,
      pct10: oews.p10,
      pct25: oews.p25,
      pct75: oews.p75,
      pct90: oews.p90,
    };
  }

  // Match ORS data by SOC code (ORS keys are SOC without hyphens)
  const orsSocKey = socCode.replace(/-/g, "");
  const ors = orsData[orsSocKey] || null;
  let orsTraits: Record<string, number> | null = null;
  if (ors) {
    orsMatched++;
    // Extract ORS-derived traits using the same mapping logic as traits.ts
    orsTraits = extractORSTraits(ors);
  }

  onetBenchmarks.push({
    id: `onet-${sanitizeId(onetCode)}`,
    title: entry.t,
    onetCode,
    description: entry.d,
    jobZone: entry.jz,
    tasks,
    knowledge,
    skills,
    tools,
    abilities,
    oewsData: oewsResult,
    orsAvailable: ors !== null,
    orsTraits,
  });

  onetProcessed++;
  if (onetProcessed % 100 === 0) {
    console.log(`  O*NET progress: ${onetProcessed}/${onetCodes.length}`);
  }
}

console.log(`  O*NET complete: ${onetBenchmarks.length} benchmarks generated`);
console.log(`  OEWS matches: ${oewsMatched}/${onetCodes.length} (${Math.round((oewsMatched / onetCodes.length) * 100)}%)`);
console.log(`  ORS matches:  ${orsMatched}/${onetCodes.length} (${Math.round((orsMatched / onetCodes.length) * 100)}%)`);

// ─── ORS Trait Extraction (mirroring traits.ts) ──────────────────────────────

function parseORSPercent(val: string | number): number {
  if (typeof val === "number") return val;
  const s = String(val).trim();
  if (s.startsWith(">")) return parseFloat(s.slice(1)) || 0;
  if (s.startsWith("<")) return (parseFloat(s.slice(1)) * 0.5) || 0;
  return parseFloat(s) || 0;
}

function orsFrequencyFromItems(items: { t: string; v: string | number }[]): number | null {
  const freq: Record<string, number> = {
    notPresent: 0, seldom: 0, occasionally: 0, frequently: 0, constantly: 0,
  };
  for (const item of items) {
    if (!item?.t) continue;
    const t = String(item.t).toLowerCase();
    const pct = parseORSPercent(item.v);
    if (t.includes("were not") || t.includes("did not require") || t.includes("not exposed") || t.includes("not in proximity")) {
      freq.notPresent = Math.max(freq.notPresent, pct);
    } else if (t.includes("constantly")) {
      freq.constantly = Math.max(freq.constantly, pct);
    } else if (t.includes("frequently")) {
      freq.frequently = Math.max(freq.frequently, pct);
    } else if (t.includes("occasionally")) {
      freq.occasionally = Math.max(freq.occasionally, pct);
    } else if (t.includes("seldom")) {
      freq.seldom = Math.max(freq.seldom, pct);
    }
  }
  const total = Object.values(freq).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const categories = [
    { level: 0, pct: freq.notPresent },
    { level: 1, pct: freq.seldom },
    { level: 2, pct: freq.occasionally },
    { level: 3, pct: freq.frequently },
    { level: 4, pct: freq.constantly },
  ];
  return categories.reduce((max, c) => (c.pct > max.pct ? c : max)).level;
}

function orsStrengthFromItems(items: { t: string; v: string | number }[]): number | null {
  const levels: { level: number; pct: number }[] = [];
  for (const item of items) {
    if (!item?.t) continue;
    const t = String(item.t).toLowerCase();
    const pct = parseORSPercent(item.v);
    if (t.includes("sedentary")) levels.push({ level: 0, pct });
    else if (t.includes("light")) levels.push({ level: 1, pct });
    else if (t.includes("medium")) levels.push({ level: 2, pct });
    else if (t.includes("very heavy")) levels.push({ level: 4, pct });
    else if (t.includes("heavy")) levels.push({ level: 3, pct });
  }
  if (levels.length === 0) return null;
  return levels.reduce((max, l) => (l.pct > max.pct ? l : max)).level;
}

function orsNoiseFromItems(items: { t: string; v: string | number }[]): number | null {
  const levels: { level: number; pct: number }[] = [];
  for (const item of items) {
    if (!item?.t) continue;
    const t = String(item.t).toLowerCase();
    const pct = parseORSPercent(item.v);
    if (t.includes("quiet")) levels.push({ level: 1, pct });
    else if (t.includes("very loud")) levels.push({ level: 4, pct });
    else if (t.includes("loud")) levels.push({ level: 3, pct });
    else if (t.includes("moderate")) levels.push({ level: 2, pct });
  }
  if (levels.length === 0) return null;
  return levels.reduce((max, l) => (l.pct > max.pct ? l : max)).level;
}

function extractORSTraits(ors: ORSEntry): Record<string, number> {
  const traits: Record<string, number> = {};

  if (ors.p) {
    for (const [category, items] of Object.entries(ors.p)) {
      if (!Array.isArray(items)) continue;
      const cat = category.toLowerCase();

      if (cat === "strength") {
        const val = orsStrengthFromItems(items);
        if (val !== null) traits.strength = val;
      } else if (cat.includes("fine manipulation")) {
        const val = orsFrequencyFromItems(items);
        if (val !== null) traits.fingerDexterity = val;
      } else if (cat.includes("gross manipulation")) {
        const val = orsFrequencyFromItems(items);
        if (val !== null) traits.manualDexterity = val;
      } else if (cat.includes("foot or leg controls")) {
        const val = orsFrequencyFromItems(items);
        if (val !== null) traits.motorCoordination = val;
      } else if (cat.includes("reaching")) {
        const val = orsFrequencyFromItems(items);
        if (val !== null) traits.reachHandle = Math.max(traits.reachHandle ?? 0, val);
      } else if (cat.includes("low postures")) {
        const val = orsFrequencyFromItems(items);
        if (val !== null) traits.stoopKneel = val;
      } else if (cat.includes("climbing")) {
        const val = orsFrequencyFromItems(items);
        if (val !== null) traits.climbBalance = Math.max(traits.climbBalance ?? 0, val);
      } else if (cat === "speaking") {
        const val = orsFrequencyFromItems(items);
        if (val !== null) traits.talkHear = Math.max(traits.talkHear ?? 0, val);
      } else if (cat.includes("hearing")) {
        let required = false;
        for (const item of items) {
          if (!item?.t) continue;
          const label = String(item.t).toLowerCase();
          if (label.includes("required") && !label.includes("did not")) {
            const pct = parseORSPercent(item.v);
            if (pct > 50) required = true;
          }
        }
        if (required) traits.talkHear = Math.max(traits.talkHear ?? 0, 3);
      } else if (cat === "vision") {
        let required = false;
        for (const item of items) {
          if (!item?.t) continue;
          const label = String(item.t).toLowerCase();
          if (label.includes("required") && !label.includes("did not")) {
            const pct = parseORSPercent(item.v);
            if (pct > 50) required = true;
          }
        }
        if (required) traits.see = 3;
      }
    }
  }

  if (ors.e) {
    for (const [category, items] of Object.entries(ors.e)) {
      if (!Array.isArray(items)) continue;
      const cat = category.toLowerCase();

      if (cat.includes("extreme cold")) {
        const val = orsFrequencyFromItems(items);
        if (val !== null) traits.extremeCold = val;
      } else if (cat.includes("extreme heat")) {
        const val = orsFrequencyFromItems(items);
        if (val !== null) traits.extremeHeat = val;
      } else if (cat === "humidity" || cat === "wetness") {
        const val = orsFrequencyFromItems(items);
        if (val !== null) traits.wetnessHumidity = Math.max(traits.wetnessHumidity ?? 0, val);
      } else if (cat.includes("noise")) {
        const val = orsNoiseFromItems(items);
        if (val !== null) traits.noiseVibration = val;
      } else if (cat.includes("heavy vibrations")) {
        const val = orsFrequencyFromItems(items);
        if (val !== null) traits.noiseVibration = Math.max(traits.noiseVibration ?? 0, val);
      } else if (cat.includes("hazardous") || cat.includes("heights") || cat.includes("proximity")) {
        const val = orsFrequencyFromItems(items);
        if (val !== null) traits.hazards = Math.max(traits.hazards ?? 0, val);
      } else if (cat.includes("outdoors")) {
        const val = orsFrequencyFromItems(items);
        if (val !== null) traits.workLocation = val;
      }
    }

    // Dusts/fumes from hazardous contaminants
    for (const [category, items] of Object.entries(ors.e)) {
      if (!Array.isArray(items)) continue;
      if (category.toLowerCase().includes("hazardous contaminants")) {
        const val = orsFrequencyFromItems(items);
        if (val !== null) traits.dustsFumes = val;
      }
    }
  }

  return traits;
}

// ─── Write Output Files ──────────────────────────────────────────────────────

console.log("\nWriting output files...");

// Ensure fixtures directory exists
if (!fs.existsSync(FIXTURES_DIR)) {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
}

const dotPath = path.join(FIXTURES_DIR, "all-dot-benchmarks.json");
const onetPath = path.join(FIXTURES_DIR, "all-onet-benchmarks.json");

fs.writeFileSync(dotPath, JSON.stringify(dotBenchmarks, null, 2), "utf-8");
fs.writeFileSync(onetPath, JSON.stringify(onetBenchmarks, null, 2), "utf-8");

const dotSize = (fs.statSync(dotPath).size / 1024 / 1024).toFixed(1);
const onetSize = (fs.statSync(onetPath).size / 1024 / 1024).toFixed(1);

console.log(`  ${dotPath} (${dotSize} MB)`);
console.log(`  ${onetPath} (${onetSize} MB)`);

// ─── Summary Statistics ──────────────────────────────────────────────────────

console.log("\n═══ Summary Statistics ═══");
console.log(`\nDOT Benchmarks: ${dotBenchmarks.length}`);

// VQ Band distribution
const bandCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
for (const b of dotBenchmarks) {
  bandCounts[b.expectedVQBand]++;
}
console.log("  VQ Band distribution:");
console.log(`    Band 1 (68-99.99):   ${bandCounts[1]} (${((bandCounts[1] / dotBenchmarks.length) * 100).toFixed(1)}%)`);
console.log(`    Band 2 (100-108.99): ${bandCounts[2]} (${((bandCounts[2] / dotBenchmarks.length) * 100).toFixed(1)}%)`);
console.log(`    Band 3 (109-143.99): ${bandCounts[3]} (${((bandCounts[3] / dotBenchmarks.length) * 100).toFixed(1)}%)`);
console.log(`    Band 4 (144-158):    ${bandCounts[4]} (${((bandCounts[4] / dotBenchmarks.length) * 100).toFixed(1)}%)`);

// Strength distribution
const strengthCounts: Record<string, number> = {};
for (const b of dotBenchmarks) {
  strengthCounts[b.strength] = (strengthCounts[b.strength] || 0) + 1;
}
console.log("  Strength distribution:");
for (const s of ["S", "L", "M", "H", "V"]) {
  console.log(`    ${s}: ${strengthCounts[s] || 0}`);
}

// SVP distribution
const svpCounts: Record<number, number> = {};
for (const b of dotBenchmarks) {
  svpCounts[b.svp] = (svpCounts[b.svp] || 0) + 1;
}
console.log("  SVP distribution:");
for (let s = 1; s <= 9; s++) {
  console.log(`    SVP ${s}: ${svpCounts[s] || 0}`);
}

// VQ range
const vqs = dotBenchmarks.map((b) => b.expectedVQ);
console.log(`  VQ range: ${Math.min(...vqs).toFixed(2)} – ${Math.max(...vqs).toFixed(2)}`);
console.log(`  VQ mean: ${(vqs.reduce((a, b) => a + b, 0) / vqs.length).toFixed(2)}`);

console.log(`\nO*NET Benchmarks: ${onetBenchmarks.length}`);
console.log(`  OEWS coverage: ${oewsMatched} (${Math.round((oewsMatched / onetBenchmarks.length) * 100)}%)`);
console.log(`  ORS coverage:  ${orsMatched} (${Math.round((orsMatched / onetBenchmarks.length) * 100)}%)`);

const withTasks = onetBenchmarks.filter((b) => b.tasks.length > 0).length;
console.log(`  With tasks:    ${withTasks} (${Math.round((withTasks / onetBenchmarks.length) * 100)}%)`);

console.log("\nDone!");
