/**
 * Trait computation for unified occupations.
 *
 * Builds the 24-trait demand vector for each occupation using the
 * priority chain: ORS (primary) → DOT (secondary) → O*NET (tertiary).
 *
 * Mirrors the logic in src/lib/engine/traits.ts but runs standalone.
 */

import type { ONETFull, ORSEntry, DOTEntry } from "./load-data";
import type { TraitDemand } from "./types";
import type { DOTMapping } from "./crosswalk";

// ─── 24 Trait Keys ─────────────────────────────────────────────────

export const TRAIT_KEYS = [
  "reasoning", "math", "language",
  "spatialPerception", "formPerception", "clericalPerception",
  "motorCoordination", "fingerDexterity", "manualDexterity",
  "eyeHandFoot", "colorDiscrimination",
  "strength", "climbing", "stooping", "reaching",
  "talking", "hearing", "seeing",
  "workLocation", "cold", "heat", "wetness",
  "noise", "hazards",
] as const;

export type TraitKey = (typeof TRAIT_KEYS)[number];

// ─── Normalization helpers ─────────────────────────────────────────

function normGED(level: number): number {
  if (level < 1) return 0;
  if (level > 6) return 4;
  return Math.round(((level - 1) * (4 / 5)) * 100) / 100;
}

function normStrength(code: string): number {
  const map: Record<string, number> = { S: 0, L: 1, M: 2, H: 3, V: 4 };
  return map[code.toUpperCase()] ?? 0;
}

function normONET(score: number, maxScale = 7): number {
  return Math.round(Math.min(4, Math.max(0, (score / maxScale) * 4)) * 100) / 100;
}

function parseORSPct(val: string | number): number {
  if (typeof val === "number") return val;
  const s = String(val).trim();
  if (s.startsWith(">")) return parseFloat(s.slice(1)) || 0;
  if (s.startsWith("<")) return (parseFloat(s.slice(1)) * 0.5) || 0;
  return parseFloat(s) || 0;
}

// ─── ORS extraction ────────────────────────────────────────────────

function orsFrequency(items: { t: string; v: string }[]): number | null {
  const freq = { notPresent: 0, seldom: 0, occasionally: 0, frequently: 0, constantly: 0 };
  for (const item of items) {
    if (!item?.t) continue;
    const t = String(item.t).toLowerCase();
    const pct = parseORSPct(item.v);
    if (t.includes("were not") || t.includes("did not require") || t.includes("not exposed") || t.includes("not in proximity")) {
      freq.notPresent = Math.max(freq.notPresent, pct);
    } else if (t.includes("constantly")) freq.constantly = Math.max(freq.constantly, pct);
    else if (t.includes("frequently")) freq.frequently = Math.max(freq.frequently, pct);
    else if (t.includes("occasionally")) freq.occasionally = Math.max(freq.occasionally, pct);
    else if (t.includes("seldom")) freq.seldom = Math.max(freq.seldom, pct);
  }
  const total = Object.values(freq).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const cats = [
    { level: 0, pct: freq.notPresent }, { level: 1, pct: freq.seldom },
    { level: 2, pct: freq.occasionally }, { level: 3, pct: freq.frequently },
    { level: 4, pct: freq.constantly },
  ];
  return cats.reduce((max, c) => (c.pct > max.pct ? c : max)).level;
}

function orsStrength(items: { t: string; v: string }[]): number | null {
  const levels: { level: number; pct: number }[] = [];
  for (const item of items) {
    const t = String(item.t).toLowerCase();
    const pct = parseORSPct(item.v);
    if (t.includes("sedentary")) levels.push({ level: 0, pct });
    else if (t.includes("light")) levels.push({ level: 1, pct });
    else if (t.includes("medium")) levels.push({ level: 2, pct });
    else if (t.includes("very heavy")) levels.push({ level: 4, pct });
    else if (t.includes("heavy")) levels.push({ level: 3, pct });
  }
  if (levels.length === 0) return null;
  return levels.reduce((max, l) => (l.pct > max.pct ? l : max)).level;
}

function orsNoise(items: { t: string; v: string }[]): number | null {
  const levels: { level: number; pct: number }[] = [];
  for (const item of items) {
    const t = String(item.t).toLowerCase();
    const pct = parseORSPct(item.v);
    if (t.includes("quiet")) levels.push({ level: 1, pct });
    else if (t.includes("very loud")) levels.push({ level: 4, pct });
    else if (t.includes("loud")) levels.push({ level: 3, pct });
    else if (t.includes("moderate")) levels.push({ level: 2, pct });
  }
  if (levels.length === 0) return null;
  return levels.reduce((max, l) => (l.pct > max.pct ? l : max)).level;
}

function orsBinary(items: { t: string; v: string }[]): boolean {
  for (const item of items) {
    const t = String(item.t).toLowerCase();
    if (t.includes("required") && !t.includes("did not")) {
      if (parseORSPct(item.v) > 50) return true;
    }
  }
  return false;
}

// ─── Extract ORS traits ────────────────────────────────────────────

function extractORSTraits(ors: ORSEntry): Map<TraitKey, { value: number }> {
  const traits = new Map<TraitKey, { value: number }>();

  if (ors.p) {
    for (const [cat, items] of Object.entries(ors.p)) {
      const c = cat.toLowerCase();
      if (c === "strength") {
        const v = orsStrength(items); if (v !== null) traits.set("strength", { value: v });
      } else if (c.includes("fine manipulation")) {
        const v = orsFrequency(items); if (v !== null) traits.set("fingerDexterity", { value: v });
      } else if (c.includes("gross manipulation")) {
        const v = orsFrequency(items); if (v !== null) traits.set("manualDexterity", { value: v });
      } else if (c.includes("foot or leg")) {
        const v = orsFrequency(items); if (v !== null) traits.set("motorCoordination", { value: v });
      } else if (c.includes("reaching")) {
        const v = orsFrequency(items); if (v !== null) traits.set("reaching", { value: v });
      } else if (c.includes("low postures")) {
        const v = orsFrequency(items); if (v !== null) traits.set("stooping", { value: v });
      } else if (c.includes("climbing")) {
        const v = orsFrequency(items); if (v !== null) traits.set("climbing", { value: v });
      } else if (c === "speaking") {
        const v = orsFrequency(items); if (v !== null) traits.set("talking", { value: v });
      } else if (c.includes("hearing")) {
        if (orsBinary(items)) traits.set("hearing", { value: 3 });
      } else if (c === "vision") {
        if (orsBinary(items)) traits.set("seeing", { value: 3 });
      }
    }
  }

  if (ors.e) {
    for (const [cat, items] of Object.entries(ors.e)) {
      const c = cat.toLowerCase();
      if (c.includes("extreme cold")) {
        const v = orsFrequency(items); if (v !== null) traits.set("cold", { value: v });
      } else if (c.includes("extreme heat")) {
        const v = orsFrequency(items); if (v !== null) traits.set("heat", { value: v });
      } else if (c === "humidity" || c === "wetness") {
        const v = orsFrequency(items); if (v !== null) traits.set("wetness", { value: v });
      } else if (c.includes("noise")) {
        const v = orsNoise(items); if (v !== null) traits.set("noise", { value: v });
      } else if (c.includes("vibration")) {
        const v = orsFrequency(items);
        if (v !== null) {
          const existing = traits.get("noise");
          traits.set("noise", { value: Math.max(existing?.value ?? 0, v) });
        }
      } else if (c.includes("hazardous") || c.includes("heights") || c.includes("proximity")) {
        const v = orsFrequency(items);
        if (v !== null) {
          const existing = traits.get("hazards");
          traits.set("hazards", { value: Math.max(existing?.value ?? 0, v) });
        }
      } else if (c.includes("outdoors")) {
        const v = orsFrequency(items); if (v !== null) traits.set("workLocation", { value: v });
      }
    }
  }

  return traits;
}

// ─── O*NET ability ID → trait mapping ──────────────────────────────

const ONET_ABILITY_TO_TRAIT: Record<string, TraitKey> = {
  "1.A.1.b.3": "spatialPerception",   // Spatial Orientation
  "1.A.2.a.2": "fingerDexterity",     // Finger Dexterity
  "1.A.2.a.1": "manualDexterity",     // Arm-Hand Steadiness → manual
  "1.A.2.b.1": "motorCoordination",   // Control Precision
  "1.A.2.b.3": "eyeHandFoot",         // Response Orientation
  "1.A.1.f.1": "seeing",              // Near Vision
  "1.A.1.g.1": "colorDiscrimination", // Color Discrimination (if present)
};

// ─── Extract O*NET traits ──────────────────────────────────────────

function extractONETTraits(onet: ONETFull): Map<TraitKey, { value: number }> {
  const traits = new Map<TraitKey, { value: number }>();

  // Abilities
  if (onet.ab) {
    for (const ab of onet.ab) {
      const key = ONET_ABILITY_TO_TRAIT[ab.id];
      if (key && ab.l != null) {
        traits.set(key, { value: normONET(ab.l) });
      }
    }
  }

  return traits;
}

// ─── Build the 24-trait vector ─────────────────────────────────────

export function buildTraitVector(
  onet: ONETFull,
  ors: ORSEntry | null,
  dotEntries: DOTMapping[]
): Record<TraitKey, TraitDemand> {
  // Start with defaults (all zero, source "proxy")
  const result: Record<string, TraitDemand> = {};
  for (const key of TRAIT_KEYS) {
    result[key] = { value: 0, source: "proxy" };
  }

  // Layer 1: O*NET (lowest priority)
  const onetTraits = extractONETTraits(onet);
  for (const [key, val] of onetTraits) {
    result[key] = { value: val.value, source: "onet" };
  }

  // Layer 2: DOT (aggregate from mapped DOT titles)
  if (dotEntries.length > 0) {
    // Use the most conservative DOT entry (highest demands)
    // For GED/cognitive: use the maximum across DOT titles
    const maxR = Math.max(...dotEntries.map(d => {
      // We need to look up the full DOT data for GED, but we only have svp/strength
      // GED is not in the DOTMapping — we'll handle this via the full DOT lookup
      return 0;
    }));

    // For strength: use the most common (mode)
    const strengthCounts = new Map<string, number>();
    for (const d of dotEntries) {
      strengthCounts.set(d.strength, (strengthCounts.get(d.strength) || 0) + 1);
    }
    let modeStrength = dotEntries[0].strength;
    let maxCount = 0;
    for (const [str, count] of strengthCounts) {
      if (count > maxCount) { maxCount = count; modeStrength = str; }
    }
    result.strength = { value: normStrength(modeStrength), source: "dot", rawValue: modeStrength };
  }

  // Layer 3: ORS (highest priority — overwrites DOT/O*NET)
  if (ors) {
    const orsTraits = extractORSTraits(ors);
    for (const [key, val] of orsTraits) {
      result[key] = { value: val.value, source: "ors" };
    }
  }

  return result as Record<TraitKey, TraitDemand>;
}

/**
 * Enhanced build that also uses full DOT data for GED/cognitive traits.
 */
export function buildTraitVectorWithDOT(
  onet: ONETFull,
  ors: ORSEntry | null,
  dotMappings: DOTMapping[],
  dotData: Record<string, DOTEntry>
): Record<TraitKey, TraitDemand> {
  const result = buildTraitVector(onet, ors, dotMappings);

  if (dotMappings.length === 0) return result;

  // Get full DOT entries for GED data
  const fullDots = dotMappings
    .map(m => dotData[m.dotCode])
    .filter(Boolean);

  if (fullDots.length === 0) return result;

  // GED: use the mode (most common) value
  const gedR = fullDots.map(d => d.r).filter(v => v > 0);
  const gedM = fullDots.map(d => d.m).filter(v => v > 0);
  const gedL = fullDots.map(d => d.l).filter(v => v > 0);

  if (gedR.length > 0 && result.reasoning.source !== "ors") {
    const modeR = mode(gedR);
    result.reasoning = { value: normGED(modeR), source: "dot", rawValue: `GED-R ${modeR}` };
  }
  if (gedM.length > 0 && result.math.source !== "ors") {
    const modeM = mode(gedM);
    result.math = { value: normGED(modeM), source: "dot", rawValue: `GED-M ${modeM}` };
  }
  if (gedL.length > 0 && result.language.source !== "ors") {
    const modeL = mode(gedL);
    result.language = { value: normGED(modeL), source: "dot", rawValue: `GED-L ${modeL}` };
  }

  return result;
}

function mode(arr: number[]): number {
  const counts = new Map<number, number>();
  for (const v of arr) counts.set(v, (counts.get(v) || 0) + 1);
  let best = arr[0];
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) { bestCount = c; best = v; }
  }
  return best;
}
