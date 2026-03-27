/**
 * OEWS Wage Data Fallback
 *
 * Provides fallback wage data for the 54 O*NET occupations (5.3%) that
 * lack direct OEWS wage records. These are primarily:
 *
 * 1. Military occupations (55-XXXX) — no civilian wage data exists
 * 2. "All Other" residual categories (XX-XXXX.99, XX-9XXX)
 * 3. Recently split/merged SOC codes
 *
 * Fallback strategy:
 * - For "All Other" residuals → inherit parent SOC minor group average
 * - For split codes (e.g., 51-2022, 51-2023) → inherit from parent aggregate
 * - For military → use comparable civilian occupation wages
 * - All results flagged with `isFallback: true`
 */

import { loadOEWSData, type OEWSOccupationData } from "@/lib/data-loaders";

// ─── Types ───────────────────────────────────────────────────────────

export interface OEWSFallbackResult {
  socCode: string;
  wageData: OEWSOccupationData;
  isFallback: boolean;
  fallbackSource?: string;
  fallbackMethod?: "minor-group-average" | "parent-aggregate" | "military-proxy" | "major-group-average";
}

// ─── Military → Civilian Proxy Mapping ──────────────────────────────
// Maps military O*NET codes to the closest civilian SOC code with OEWS data

const MILITARY_CIVILIAN_PROXY: Record<string, string> = {
  "55-1011": "53-2011",  // Air Crew Officers → Airline Pilots
  "55-1012": "53-2012",  // Aircraft Launch/Recovery Officers → Commercial Pilots
  "55-1013": "11-1021",  // Armored Assault Vehicle Officers → General/Operations Managers
  "55-1014": "17-2199",  // Artillery/Missile Officers → Engineers, All Other
  "55-1015": "15-1241",  // Command/Control Center Officers → Computer Network Architects
  "55-1016": "33-3051",  // Infantry Officers → Police/Sheriff Patrol Officers
  "55-1017": "33-9032",  // Special Forces Officers → Security Guards (proxy)
  "55-1019": "33-3051",  // Military Officer All Other → Police/Sheriff
  "55-2011": "33-1012",  // FLS Air Crew → FLS Police/Detective
  "55-2012": "33-1012",  // FLS Weapons → FLS Police/Detective
  "55-2013": "33-1012",  // FLS Tactical → FLS Police/Detective
  "55-3011": "53-2012",  // Air Crew Members → Commercial Pilots
  "55-3012": "53-2012",  // Aircraft Launch/Recovery → Commercial Pilots
  "55-3013": "53-3032",  // Armored Assault Crew → Heavy Truck Drivers (proxy)
  "55-3014": "17-2199",  // Artillery Crew → Engineers, All Other
  "55-3015": "15-1241",  // Command/Control Specialists → Computer Network Architects
  "55-3016": "33-3051",  // Infantry → Police/Sheriff
  "55-3018": "33-3051",  // Special Forces → Police/Sheriff
  "55-3019": "33-3051",  // Military Enlisted All Other → Police/Sheriff
};

// ─── Explicit Parent Aggregate Mapping ──────────────────────────────
// For recently split SOC codes, map to the aggregate parent

const SPLIT_CODE_PARENT: Record<string, string> = {
  "13-2022": "13-2020",  // Appraisers Personal/Business → Appraisers aggregate
  "13-2023": "13-2020",  // Appraisers Real Estate → Appraisers aggregate
  "13-1021": "13-1020",  // Buyers Farm → Buyers aggregate
  "13-1022": "13-1020",  // Wholesale/Retail Buyers → Buyers aggregate
  "13-1023": "13-1020",  // Purchasing Agents → Buyers aggregate
  "29-2011": "29-2010",  // Med/Clin Lab Technologists → aggregate
  "29-2011.01": "29-2010", // Cytogenetic Technologists
  "29-2011.02": "29-2010", // Cytotechnologists
  "29-2011.04": "29-2010", // Histotechnologists
  "29-2012": "29-2010",  // Med/Clin Lab Technicians → aggregate
  "29-2012.01": "29-2010", // Histology Technicians
  "21-1011": "21-1010",  // Substance Abuse Counselors → aggregate
  "21-1014": "21-1010",  // Mental Health Counselors → aggregate
  "25-2055": "25-2050",  // Special Ed Teachers K → aggregate
  "25-2056": "25-2050",  // Special Ed Teachers Elem → aggregate
  "25-9042": "25-9040",  // Teaching Assistants → aggregate
  "25-9043": "25-9040",  // Teaching Assistants Special Ed → aggregate
  "31-1121": "31-1120",  // Home Health Aides → aggregate
  "31-1122": "31-1120",  // Personal Care Aides → aggregate
  "39-7011": "39-7010",  // Tour Guides → aggregate
  "39-7012": "39-7010",  // Travel Guides → aggregate
  "45-3031": "45-3000",  // Fishing/Hunting → Fishing/Hunting aggregate
  "47-4091": "47-4090",  // Segmental Pavers → aggregate
  "47-4099.03": "47-4090", // Weatherization Installers
  "51-2022": "51-2020",  // Electrical Equipment Assemblers → aggregate
  "51-2023": "51-2020",  // Electromechanical Assemblers → aggregate
  "51-2092": "51-2090",  // Team Assemblers → aggregate
  "53-1042": "53-1040",  // FLS Helpers/Laborers → aggregate
  "53-1042.01": "53-1040", // Recycling Coordinators
  "53-1043": "53-1040",  // FLS Material-Moving → aggregate
  "53-1044": "53-1040",  // FLS Passenger Attendants → aggregate
};

// ─── Module-Level Cache ─────────────────────────────────────────────

let _oewsFallbackCache: Map<string, OEWSFallbackResult> | null = null;

// ─── Helper: Compute Average Wage Data ──────────────────────────────

function averageWageData(
  entries: OEWSOccupationData[],
  title: string
): OEWSOccupationData {
  if (entries.length === 0) {
    return { t: title, e: null, m: null, md: null, p10: null, p25: null, p75: null, p90: null };
  }

  const avg = (vals: (number | null)[]): number | null => {
    const valid = vals.filter((v): v is number => v !== null);
    if (valid.length === 0) return null;
    return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
  };

  const sum = (vals: (number | null)[]): number | null => {
    const valid = vals.filter((v): v is number => v !== null);
    if (valid.length === 0) return null;
    return valid.reduce((a, b) => a + b, 0);
  };

  return {
    t: title,
    e: sum(entries.map(e => e.e)),
    m: avg(entries.map(e => e.m)),
    md: avg(entries.map(e => e.md)),
    p10: avg(entries.map(e => e.p10)),
    p25: avg(entries.map(e => e.p25)),
    p75: avg(entries.map(e => e.p75)),
    p90: avg(entries.map(e => e.p90)),
  };
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Get OEWS wage data for a SOC code, with fallback.
 * The socCode should be in "XX-XXXX" format (no .XX suffix).
 */
export async function getOEWSWithFallback(socCode: string): Promise<OEWSFallbackResult> {
  const oewsData = await loadOEWSData();

  // Direct lookup
  if (oewsData[socCode]) {
    return {
      socCode,
      wageData: oewsData[socCode],
      isFallback: false,
    };
  }

  // Check split-code parent mapping
  if (SPLIT_CODE_PARENT[socCode]) {
    const parentCode = SPLIT_CODE_PARENT[socCode];
    if (oewsData[parentCode]) {
      return {
        socCode,
        wageData: oewsData[parentCode],
        isFallback: true,
        fallbackSource: parentCode,
        fallbackMethod: "parent-aggregate",
      };
    }
  }

  // Check military proxy
  if (socCode.startsWith("55-")) {
    const proxyCode = MILITARY_CIVILIAN_PROXY[socCode];
    if (proxyCode && oewsData[proxyCode]) {
      return {
        socCode,
        wageData: oewsData[proxyCode],
        isFallback: true,
        fallbackSource: proxyCode,
        fallbackMethod: "military-proxy",
      };
    }
  }

  // Minor group average: XX-XX00 group
  const minorGroup = socCode.slice(0, 5); // "XX-XX"
  const minorGroupEntries: OEWSOccupationData[] = [];
  for (const [code, entry] of Object.entries(oewsData)) {
    if (code.startsWith(minorGroup) && code !== socCode) {
      minorGroupEntries.push(entry);
    }
  }

  if (minorGroupEntries.length > 0) {
    return {
      socCode,
      wageData: averageWageData(minorGroupEntries, `${socCode} (minor group average)`),
      isFallback: true,
      fallbackSource: `${minorGroup}XX minor group (${minorGroupEntries.length} occupations)`,
      fallbackMethod: "minor-group-average",
    };
  }

  // Major group average: XX-XXXX where first 2 digits match
  const majorGroup = socCode.slice(0, 2);
  const majorGroupEntries: OEWSOccupationData[] = [];
  for (const [code, entry] of Object.entries(oewsData)) {
    if (code.startsWith(majorGroup)) {
      majorGroupEntries.push(entry);
    }
  }

  if (majorGroupEntries.length > 0) {
    return {
      socCode,
      wageData: averageWageData(majorGroupEntries, `${socCode} (major group average)`),
      isFallback: true,
      fallbackSource: `${majorGroup}-XXXX major group (${majorGroupEntries.length} occupations)`,
      fallbackMethod: "major-group-average",
    };
  }

  // Last resort: return null wages
  return {
    socCode,
    wageData: { t: `${socCode} (no data)`, e: null, m: null, md: null, p10: null, p25: null, p75: null, p90: null },
    isFallback: true,
    fallbackSource: "none",
    fallbackMethod: "major-group-average",
  };
}

/**
 * Get fallback wage data for ALL O*NET codes that lack OEWS records.
 */
export async function getAllOEWSFallbacks(
  onetCodes: string[]
): Promise<Map<string, OEWSFallbackResult>> {
  if (_oewsFallbackCache) return _oewsFallbackCache;

  const oewsData = await loadOEWSData();
  const oewsSet = new Set(Object.keys(oewsData));
  const result = new Map<string, OEWSFallbackResult>();

  for (const onetCode of onetCodes) {
    const socCode = onetCode.replace(/\.\d+$/, "");
    if (oewsSet.has(socCode)) continue; // already has direct data

    const fallback = await getOEWSWithFallback(socCode);
    result.set(onetCode, fallback);
  }

  _oewsFallbackCache = result;
  return result;
}

/**
 * Check if a SOC code has OEWS data (direct or fallback with real wages).
 */
export async function hasOEWSData(socCode: string): Promise<boolean> {
  const result = await getOEWSWithFallback(socCode);
  return result.wageData.md !== null || result.wageData.m !== null;
}

/**
 * Get OEWS coverage statistics with fallbacks.
 */
export async function getOEWSCoverage(onetCodes: string[]): Promise<{
  total: number;
  directCoverage: number;
  fallbackCoverage: number;
  noCoverage: number;
  coveragePct: number;
  fallbackByMethod: Record<string, number>;
}> {
  const oewsData = await loadOEWSData();
  const oewsSet = new Set(Object.keys(oewsData));

  let directCoverage = 0;
  let fallbackCoverage = 0;
  let noCoverage = 0;
  const fallbackByMethod: Record<string, number> = {};

  for (const onetCode of onetCodes) {
    const socCode = onetCode.replace(/\.\d+$/, "");
    if (oewsSet.has(socCode)) {
      directCoverage++;
    } else {
      const fallback = await getOEWSWithFallback(socCode);
      if (fallback.wageData.md !== null || fallback.wageData.m !== null) {
        fallbackCoverage++;
        const method = fallback.fallbackMethod || "unknown";
        fallbackByMethod[method] = (fallbackByMethod[method] || 0) + 1;
      } else {
        noCoverage++;
      }
    }
  }

  return {
    total: onetCodes.length,
    directCoverage,
    fallbackCoverage,
    noCoverage,
    coveragePct: ((directCoverage + fallbackCoverage) / onetCodes.length) * 100,
    fallbackByMethod,
  };
}
