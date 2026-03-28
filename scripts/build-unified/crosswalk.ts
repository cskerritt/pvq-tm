/**
 * DOT → O*NET crosswalk builder.
 *
 * Strategy: Group DOT entries by xw code (old OES), then for each group
 * find the best-matching O*NET occupation by title similarity + job zone.
 *
 * This produces much better DOT distribution than naive prefix mapping.
 */

import type { DOTEntry, ONETFull } from "./load-data";

// ─── Title Matching ────────────────────────────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z ]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))
  );
}

const STOP_WORDS = new Set([
  "the", "and", "for", "all", "other", "not", "nor", "but", "with",
  "except", "including", "general", "miscellaneous", "various",
]);

function titleOverlap(a: string, b: string): number {
  const tokA = tokenize(a);
  const tokB = tokenize(b);
  if (tokA.size === 0 || tokB.size === 0) return 0;
  let overlap = 0;
  for (const w of tokA) if (tokB.has(w)) overlap++;
  return overlap / Math.max(tokA.size, tokB.size);
}

// ─── DOT Category → SOC Major Groups ──────────────────────────────

const DOT_CATEGORY_TO_SOC: Record<string, string[]> = {
  "0": ["11", "13", "15", "17", "19", "23", "25", "29"],
  "1": ["43", "41", "13"],
  "2": ["35", "39", "31", "21", "33"],
  "3": ["45"],
  "4": ["51"],
  "5": ["51"],
  "6": ["51", "49"],
  "7": ["51"],
  "8": ["47", "49"],
  "9": ["53", "51", "49"],
};

// ─── OES Prefix → SOC Major Group (for xw-based lookup) ───────────

const OES_TO_SOC: Record<string, string[]> = {
  "11": ["11", "13"], "13": ["13"], "15": ["15"], "17": ["17"],
  "19": ["29", "19"], "21": ["13", "23"], "22": ["17", "15"],
  "23": ["25"], "24": ["19"], "25": ["21"], "27": ["27"],
  "29": ["29"], "31": ["31"], "32": ["29", "31"], "33": ["33"],
  "34": ["29"], "35": ["35"], "37": ["37"], "39": ["39"],
  "41": ["41"], "43": ["43"], "45": ["45"],
  "47": ["47"], "49": ["49"], "51": ["51"],
  "53": ["53"], "55": ["55"], "56": ["43"],
  "57": ["35", "39"], "58": ["39"], "59": ["39"],
  "63": ["53"], "64": ["47"], "65": ["47"],
  "66": ["49"], "67": ["51"], "68": ["51"],
  "69": ["51"], "71": ["51"], "72": ["51"],
  "73": ["51"], "74": ["51"], "75": ["51"],
  "76": ["51"], "77": ["51"], "78": ["47"],
  "79": ["51"], "81": ["53"], "83": ["53"],
  "85": ["53"], "87": ["37", "47"], "89": ["51"],
  "91": ["45"], "92": ["45"], "93": ["45"],
  "95": ["51", "49"], "97": ["47", "49"], "98": ["53"],
  "99": ["51"],
};

function svpToJobZone(svp: number): number {
  if (svp <= 2) return 1;
  if (svp <= 4) return 2;
  if (svp <= 6) return 3;
  if (svp === 7) return 4;
  return 5;
}

// ─── Types ─────────────────────────────────────────────────────────

export interface DOTMapping {
  dotCode: string;
  title: string;
  svp: number;
  strength: string;
  method: "title-match" | "xw-group" | "category-svp";
}

// ─── Build Function ────────────────────────────────────────────────

export function buildDOTToONETMap(
  dotData: Record<string, DOTEntry>,
  onetData: Record<string, ONETFull>
): Map<string, DOTMapping[]> {
  const result = new Map<string, DOTMapping[]>();
  const onetEntries = Object.entries(onetData);

  // Pre-index O*NET by SOC major group and by alternate titles
  const socGroupIndex = new Map<string, Array<{ code: string; title: string; jz: number }>>();
  const allOnetTitleIndex: Array<{ code: string; title: string; jz: number }> = [];

  for (const [code, data] of onetEntries) {
    const major = code.slice(0, 2);
    const entry = { code, title: data.t, jz: data.jz || 3 };
    if (!socGroupIndex.has(major)) socGroupIndex.set(major, []);
    socGroupIndex.get(major)!.push(entry);
    allOnetTitleIndex.push(entry);

    // Also index alternate titles
    if (data.at) {
      for (const alt of data.at) {
        allOnetTitleIndex.push({ code, title: alt, jz: data.jz || 3 });
      }
    }
  }

  let titleMatchCount = 0;
  let xwGroupCount = 0;
  let categoryCount = 0;
  let unmapped = 0;

  for (const [dotCode, dot] of Object.entries(dotData)) {
    const mapping: DOTMapping = {
      dotCode,
      title: dot.t,
      svp: dot.s,
      strength: dot.str,
      method: "category-svp",
    };

    const targetJZ = svpToJobZone(dot.s);

    // Strategy 1: Title matching against O*NET titles (including alternates)
    // Narrow search to relevant SOC groups first
    let searchPool: Array<{ code: string; title: string; jz: number }> = [];

    if (dot.xw) {
      const oesPrefix = dot.xw.slice(0, 2);
      const socMajors = OES_TO_SOC[oesPrefix] || [];
      for (const major of socMajors) {
        searchPool.push(...(socGroupIndex.get(major) || []));
      }
    }
    if (searchPool.length === 0) {
      const dotCat = dotCode.charAt(0);
      const socMajors = DOT_CATEGORY_TO_SOC[dotCat] || [];
      for (const major of socMajors) {
        searchPool.push(...(socGroupIndex.get(major) || []));
      }
    }
    if (searchPool.length === 0) {
      searchPool = allOnetTitleIndex;
    }

    // Score each candidate
    let bestScore = 0;
    let bestMatch: string | null = null;

    for (const candidate of searchPool) {
      const ts = titleOverlap(dot.t, candidate.title);
      const jzDiff = Math.abs(candidate.jz - targetJZ);
      const jzBonus = (5 - jzDiff) / 50; // small job-zone proximity bonus
      const score = ts + jzBonus;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate.code;
      }
    }

    if (bestMatch && bestScore > 0.1) {
      mapping.method = bestScore > 0.25 ? "title-match" : "xw-group";
      addMapping(result, bestMatch, mapping);
      if (mapping.method === "title-match") titleMatchCount++;
      else xwGroupCount++;
    } else if (searchPool.length > 0) {
      // Fall back to best job-zone match in the pool
      let bestJZ: string | null = null;
      let bestJZDiff = 999;
      for (const c of searchPool) {
        const diff = Math.abs(c.jz - targetJZ);
        if (diff < bestJZDiff) { bestJZDiff = diff; bestJZ = c.code; }
      }
      if (bestJZ) {
        mapping.method = "category-svp";
        addMapping(result, bestJZ, mapping);
        categoryCount++;
      } else {
        unmapped++;
      }
    } else {
      unmapped++;
    }
  }

  // Report how many O*NET codes actually got DOT entries
  let onetWithDot = 0;
  for (const [, entries] of result) {
    if (entries.length > 0) onetWithDot++;
  }

  console.log(`  DOT crosswalk: ${titleMatchCount} title-matched, ${xwGroupCount} xw-group, ${categoryCount} category-fallback, ${unmapped} unmapped`);
  console.log(`  O*NET codes with DOT entries: ${onetWithDot} / ${onetEntries.length}`);
  return result;
}

function addMapping(map: Map<string, DOTMapping[]>, onetCode: string, mapping: DOTMapping) {
  if (!map.has(onetCode)) map.set(onetCode, []);
  map.get(onetCode)!.push(mapping);
}
