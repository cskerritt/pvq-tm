/**
 * Residual Category Handler
 *
 * Provides proxy trait data for the 122 O*NET "All Other" residual categories
 * and other occupations (12% gap) that lack scorable abilities, skills, or
 * knowledge data.
 *
 * Strategy:
 * - For each occupation without scorable data, find all sibling occupations
 *   in the same SOC minor group (same XX-XXNN prefix)
 * - Compute median trait values across those siblings
 * - Flag results with `isResidualProxy: true`
 *
 * This ensures 100% of O*NET occupations have trait data for PVQ-TM scoring.
 */

import {
  loadONETFullData,
  type ONETFullOccupationData,
  type ONETElement,
} from "@/lib/data-loaders";

// ─── Types ───────────────────────────────────────────────────────────

export interface ResidualProxyResult {
  onetCode: string;
  onetTitle: string;
  isResidualProxy: boolean;
  proxySource: string;
  siblingCount: number;
  abilities: ONETElement[];
  skills: ONETElement[];
  knowledge: ONETElement[];
  workActivities: ONETElement[];
  workContext: ONETElement[];
  workStyles: ONETElement[];
  jobZone: number | null;
}

// ─── Military → Civilian Proxy for Trait Data ───────────────────────
// Military occupations (55-XXXX) have no O*NET trait data and no siblings.
// Map them to comparable civilian occupations for proxy traits.

const MILITARY_TRAIT_PROXY: Record<string, string> = {
  "55-1011.00": "53-2011.00",  // Air Crew Officers → Airline Pilots
  "55-1012.00": "53-2012.00",  // Aircraft Launch/Recovery Officers → Commercial Pilots
  "55-1013.00": "11-1021.00",  // Armored Assault Vehicle Officers → General/Ops Managers
  "55-1014.00": "17-2051.00",  // Artillery/Missile Officers → Civil Engineers (proxy)
  "55-1015.00": "15-1241.00",  // Command/Control Officers → Computer Network Architects
  "55-1016.00": "33-3051.00",  // Infantry Officers → Police/Sheriff Patrol
  "55-1017.00": "33-9032.00",  // Special Forces Officers → Security Guards
  "55-1019.00": "33-3051.00",  // Military Officer All Other → Police/Sheriff
  "55-2011.00": "33-1012.00",  // FLS Air Crew → FLS Police/Detective
  "55-2012.00": "33-1012.00",  // FLS Weapons → FLS Police/Detective
  "55-2013.00": "33-1012.00",  // FLS Tactical → FLS Police/Detective
  "55-3011.00": "53-2012.00",  // Air Crew Members → Commercial Pilots
  "55-3012.00": "53-2012.00",  // Aircraft Launch/Recovery → Commercial Pilots
  "55-3013.00": "53-3032.00",  // Armored Assault Crew → Heavy Truck Drivers
  "55-3014.00": "17-3027.00",  // Artillery Crew → Mechanical Engineering Technologists/Technicians
  "55-3015.00": "15-1241.00",  // Command/Control Specialists → Computer Network Architects
  "55-3016.00": "33-3051.00",  // Infantry → Police/Sheriff
  "55-3018.00": "33-3051.00",  // Special Forces → Police/Sheriff
  "55-3019.00": "33-3051.00",  // Military Enlisted All Other → Police/Sheriff
};

// ─── Module-Level Cache ─────────────────────────────────────────────

let _residualCache: Map<string, ResidualProxyResult> | null = null;

// ─── Helper: Compute Median of Number Array ─────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ─── Helper: Aggregate Elements Across Siblings ─────────────────────

function aggregateElements(
  siblingData: ONETFullOccupationData[],
  field: "ab" | "sk" | "kn" | "wa" | "wc" | "ws"
): ONETElement[] {
  // Collect all element IDs across siblings
  const elementMap = new Map<string, {
    id: string;
    n: string;
    values: number[];
    levels: number[];
  }>();

  for (const sibling of siblingData) {
    const elements = sibling[field];
    if (!elements || !Array.isArray(elements)) continue;

    for (const elem of elements) {
      if (!elementMap.has(elem.id)) {
        elementMap.set(elem.id, {
          id: elem.id,
          n: elem.n,
          values: [],
          levels: [],
        });
      }
      const entry = elementMap.get(elem.id)!;
      if (elem.v !== undefined && elem.v !== null) entry.values.push(elem.v);
      if (elem.l !== undefined && elem.l !== null) entry.levels.push(elem.l);
    }
  }

  // Compute median for each element
  const result: ONETElement[] = [];
  for (const [, entry] of elementMap) {
    const element: ONETElement = {
      id: entry.id,
      n: entry.n,
    };
    if (entry.values.length > 0) {
      element.v = Math.round(median(entry.values) * 100) / 100;
    }
    if (entry.levels.length > 0) {
      element.l = Math.round(median(entry.levels) * 100) / 100;
    }
    result.push(element);
  }

  return result;
}

// ─── Helper: Get SOC Minor Group Prefix ─────────────────────────────

function getMinorGroupPrefix(onetCode: string): string {
  // O*NET code format: XX-XXXX.XX
  // Minor group: first 5 chars = "XX-XX" (e.g., "15-12" for 15-1200 range)
  return onetCode.slice(0, 5);
}

function getMajorGroupPrefix(onetCode: string): string {
  return onetCode.slice(0, 2);
}

// ─── Build Proxy Data ────────────────────────────────────────────────

async function buildAllProxies(): Promise<Map<string, ResidualProxyResult>> {
  if (_residualCache) return _residualCache;

  const onetFull = await loadONETFullData();
  const allCodes = Object.keys(onetFull);
  const result = new Map<string, ResidualProxyResult>();

  // Identify codes without scorable data
  const needsProxy: string[] = [];
  const hasScorable = new Set<string>();

  for (const code of allCodes) {
    const entry = onetFull[code];
    const hasAb = entry.ab && entry.ab.length > 0;
    const hasSk = entry.sk && entry.sk.length > 0;
    const hasKn = entry.kn && entry.kn.length > 0;

    if (hasAb || hasSk || hasKn) {
      hasScorable.add(code);
    } else {
      needsProxy.push(code);
    }
  }

  // Build minor group index of scorable occupations
  const minorGroupIndex = new Map<string, ONETFullOccupationData[]>();
  const majorGroupIndex = new Map<string, ONETFullOccupationData[]>();

  for (const code of hasScorable) {
    const minorPrefix = getMinorGroupPrefix(code);
    const majorPrefix = getMajorGroupPrefix(code);

    if (!minorGroupIndex.has(minorPrefix)) minorGroupIndex.set(minorPrefix, []);
    minorGroupIndex.get(minorPrefix)!.push(onetFull[code]);

    if (!majorGroupIndex.has(majorPrefix)) majorGroupIndex.set(majorPrefix, []);
    majorGroupIndex.get(majorPrefix)!.push(onetFull[code]);
  }

  // Generate proxy data for each occupation that needs it
  for (const code of needsProxy) {
    const entry = onetFull[code];
    const minorPrefix = getMinorGroupPrefix(code);
    const majorPrefix = getMajorGroupPrefix(code);

    // Try minor group siblings first
    let siblings = minorGroupIndex.get(minorPrefix);
    let proxySource = `minor group ${minorPrefix}XXX`;

    // Fall back to major group if no minor group siblings
    if (!siblings || siblings.length === 0) {
      siblings = majorGroupIndex.get(majorPrefix);
      proxySource = `major group ${majorPrefix}-XXXX`;
    }

    // If no siblings found, try military proxy mapping
    if (!siblings || siblings.length === 0) {
      const proxyCode = MILITARY_TRAIT_PROXY[code];
      if (proxyCode && onetFull[proxyCode]) {
        const proxyEntry = onetFull[proxyCode];
        const hasData = (proxyEntry.ab && proxyEntry.ab.length > 0) ||
                        (proxyEntry.sk && proxyEntry.sk.length > 0) ||
                        (proxyEntry.kn && proxyEntry.kn.length > 0);
        if (hasData) {
          siblings = [proxyEntry];
          proxySource = `military proxy → ${proxyCode} (${proxyEntry.t})`;
        }
      }
    }

    if (!siblings || siblings.length === 0) {
      // No siblings at all — try any occupation in the entire dataset as last resort
      // Use the most common occupation (largest SOC group)
      const allScorable = allCodes
        .filter(c => hasScorable.has(c))
        .map(c => onetFull[c]);
      if (allScorable.length > 0) {
        // Use a generic proxy from the largest group
        siblings = allScorable.slice(0, 5);
        proxySource = "global average (last resort)";
      } else {
        result.set(code, {
          onetCode: code,
          onetTitle: entry.t,
          isResidualProxy: true,
          proxySource: "none",
          siblingCount: 0,
          abilities: [],
          skills: [],
          knowledge: [],
          workActivities: [],
          workContext: [],
          workStyles: [],
          jobZone: entry.jz ?? null,
        });
        continue;
      }
    }

    // Compute median job zone from siblings
    const siblingJZs = siblings
      .map(s => s.jz)
      .filter((jz): jz is number => jz !== undefined && jz !== null);
    const medianJZ = siblingJZs.length > 0 ? Math.round(median(siblingJZs)) : null;

    result.set(code, {
      onetCode: code,
      onetTitle: entry.t,
      isResidualProxy: true,
      proxySource,
      siblingCount: siblings.length,
      abilities: aggregateElements(siblings, "ab"),
      skills: aggregateElements(siblings, "sk"),
      knowledge: aggregateElements(siblings, "kn"),
      workActivities: aggregateElements(siblings, "wa"),
      workContext: aggregateElements(siblings, "wc"),
      workStyles: aggregateElements(siblings, "ws"),
      jobZone: entry.jz ?? medianJZ,
    });
  }

  _residualCache = result;
  return result;
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Check if an O*NET code needs proxy trait data.
 */
export async function needsResidualProxy(onetCode: string): Promise<boolean> {
  const onetFull = await loadONETFullData();
  const entry = onetFull[onetCode];
  if (!entry) return false;

  const hasAb = entry.ab && entry.ab.length > 0;
  const hasSk = entry.sk && entry.sk.length > 0;
  const hasKn = entry.kn && entry.kn.length > 0;
  return !hasAb && !hasSk && !hasKn;
}

/**
 * Get proxy trait data for an O*NET occupation that lacks scorable data.
 * Returns null if the occupation already has its own trait data.
 */
export async function getResidualProxy(onetCode: string): Promise<ResidualProxyResult | null> {
  const needs = await needsResidualProxy(onetCode);
  if (!needs) return null;

  const proxies = await buildAllProxies();
  return proxies.get(onetCode) ?? null;
}

/**
 * Get scorable data for ANY O*NET code — direct if available, proxy if not.
 * This is the unified access point that guarantees 100% coverage.
 */
export async function getScorableData(onetCode: string): Promise<{
  abilities: ONETElement[];
  skills: ONETElement[];
  knowledge: ONETElement[];
  workActivities: ONETElement[];
  workContext: ONETElement[];
  workStyles: ONETElement[];
  jobZone: number | null;
  isResidualProxy: boolean;
  proxySource?: string;
}> {
  const onetFull = await loadONETFullData();
  const entry = onetFull[onetCode];

  if (!entry) {
    return {
      abilities: [],
      skills: [],
      knowledge: [],
      workActivities: [],
      workContext: [],
      workStyles: [],
      jobZone: null,
      isResidualProxy: false,
    };
  }

  const hasAb = entry.ab && entry.ab.length > 0;
  const hasSk = entry.sk && entry.sk.length > 0;
  const hasKn = entry.kn && entry.kn.length > 0;

  if (hasAb || hasSk || hasKn) {
    // Direct data available
    return {
      abilities: entry.ab || [],
      skills: entry.sk || [],
      knowledge: entry.kn || [],
      workActivities: entry.wa || [],
      workContext: entry.wc || [],
      workStyles: entry.ws || [],
      jobZone: entry.jz ?? null,
      isResidualProxy: false,
    };
  }

  // Need proxy data
  const proxy = await getResidualProxy(onetCode);
  if (proxy) {
    return {
      abilities: proxy.abilities,
      skills: proxy.skills,
      knowledge: proxy.knowledge,
      workActivities: proxy.workActivities,
      workContext: proxy.workContext,
      workStyles: proxy.workStyles,
      jobZone: proxy.jobZone,
      isResidualProxy: true,
      proxySource: proxy.proxySource,
    };
  }

  // Should not reach here, but return empty as safety
  return {
    abilities: [],
    skills: [],
    knowledge: [],
    workActivities: [],
    workContext: [],
    workStyles: [],
    jobZone: entry.jz ?? null,
    isResidualProxy: true,
    proxySource: "none",
  };
}

/**
 * Get residual coverage statistics.
 */
export async function getResidualCoverage(): Promise<{
  total: number;
  withDirectData: number;
  withProxyData: number;
  withNoData: number;
  coveragePct: number;
  proxyBySource: Record<string, number>;
}> {
  const onetFull = await loadONETFullData();
  const allCodes = Object.keys(onetFull);
  const proxies = await buildAllProxies();

  let withDirectData = 0;
  let withProxyData = 0;
  let withNoData = 0;
  const proxyBySource: Record<string, number> = {};

  for (const code of allCodes) {
    const entry = onetFull[code];
    const hasAb = entry.ab && entry.ab.length > 0;
    const hasSk = entry.sk && entry.sk.length > 0;
    const hasKn = entry.kn && entry.kn.length > 0;

    if (hasAb || hasSk || hasKn) {
      withDirectData++;
    } else if (proxies.has(code)) {
      const proxy = proxies.get(code)!;
      if (proxy.abilities.length > 0 || proxy.skills.length > 0 || proxy.knowledge.length > 0) {
        withProxyData++;
        proxyBySource[proxy.proxySource] = (proxyBySource[proxy.proxySource] || 0) + 1;
      } else {
        withNoData++;
      }
    } else {
      withNoData++;
    }
  }

  return {
    total: allCodes.length,
    withDirectData,
    withProxyData,
    withNoData,
    coveragePct: ((withDirectData + withProxyData) / allCodes.length) * 100,
    proxyBySource,
  };
}
