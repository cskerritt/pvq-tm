/**
 * Data Sync Service
 *
 * Orchestrates loading occupational data from O*NET, BLS (OEWS/ORS),
 * and employment projections into the local database cache.
 * Tracks versions and sync status via DataSyncLog.
 */

import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";

/** OEWS wage data structure (mirrors data-loaders.ts — inline to avoid Edge Runtime warnings) */
interface OEWSOccupationData {
  t: string;
  e: number | null;
  m: number | null;
  md: number | null;
  p10: number | null;
  p25: number | null;
  p75: number | null;
  p90: number | null;
}

function toJson(val: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(val ?? []));
}

export type SyncSource = "ONET" | "ORS" | "OEWS" | "PROJECTIONS" | "DOT" | "CROSSWALK";

export interface SyncStatus {
  source: SyncSource;
  lastSync: Date | null;
  recordCount: number;
  totalOccupations: number;
  version: string | null;
  status: string;
}

/** Global sync lock to prevent concurrent syncs */
let isSyncing = false;

export function getSyncLock(): boolean {
  return isSyncing;
}

/**
 * Get sync status for all data sources.
 */
export async function getSyncStatus(): Promise<SyncStatus[]> {
  const sources: SyncSource[] = ["ONET", "ORS", "OEWS", "PROJECTIONS", "DOT", "CROSSWALK"];
  const statuses: SyncStatus[] = [];

  // Get total O*NET occupations once (used as denominator for coverage)
  const totalOccupations = await prisma.occupationONET.count();

  for (const source of sources) {
    const lastLog = await prisma.dataSyncLog.findFirst({
      where: { source, status: "completed" },
      orderBy: { completedAt: "desc" },
    });

    let recordCount = 0;
    switch (source) {
      case "ONET":
        recordCount = totalOccupations;
        break;
      case "ORS":
        recordCount = await prisma.occupationORS.count();
        break;
      case "OEWS":
        recordCount = await prisma.occupationWages.count();
        break;
      case "PROJECTIONS":
        recordCount = await prisma.occupationProjections.count();
        break;
      case "DOT":
        recordCount = await prisma.occupationDOT.count();
        break;
      case "CROSSWALK":
        recordCount = await prisma.dOTONETCrosswalk.count();
        break;
    }

    statuses.push({
      source,
      lastSync: lastLog?.completedAt ?? null,
      recordCount,
      totalOccupations,
      version: lastLog?.version ?? null,
      status: lastLog?.status ?? "never",
    });
  }

  return statuses;
}

/**
 * Sync O*NET occupation data from the complete local O*NET 30.2 dataset.
 *
 * Loads ALL data from src/data/onet-full.json (converted from O*NET 30.2 Excel files).
 * No O*NET API calls needed — everything comes from the local dataset:
 *   - 1,016 occupations with title, description
 *   - Tasks (18,796), Skills (31,290), Abilities (46,488), Knowledge (29,502)
 *   - Work Activities (36,654), Work Context (49,170), Tools/Tech (74,435)
 *   - DWAs (18,357), Related Occupations (18,460), Work Styles, Interests
 *   - Education/Training, Alternate Titles, Job Zones
 */
export async function syncONET(): Promise<{ synced: number; errors: number }> {
  const log = await prisma.dataSyncLog.create({
    data: {
      source: "ONET",
      status: "started",
      startedAt: new Date(),
    },
  });

  let synced = 0;
  let errors = 0;

  try {
    console.log("[syncONET] Loading complete O*NET 30.2 dataset from local files...");
    const { loadONETFullData } = await import("@/lib/data-loaders");
    const onetData = await loadONETFullData();

    const codes = Object.keys(onetData);
    console.log(`[syncONET] Loaded ${codes.length} occupations with full data`);

    // Process in batches of 50 for better performance
    const batchSize = 50;
    for (let i = 0; i < codes.length; i += batchSize) {
      const batch = codes.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (code) => {
          const occ = onetData[code];
          try {
            // Expand compact keys to DB format
            const tasks = occ.ta?.map((t) => ({
              id: t.id,
              title: t.t,
              importance: t.im,
            })) ?? [];

            const skills = occ.sk?.map((e) => ({
              id: e.id,
              name: e.n,
              value: e.v,
              level: e.l,
            })) ?? [];

            const abilities = occ.ab?.map((e) => ({
              id: e.id,
              name: e.n,
              value: e.v,
              level: e.l,
            })) ?? [];

            const knowledge = occ.kn?.map((e) => ({
              id: e.id,
              name: e.n,
              value: e.v,
              level: e.l,
            })) ?? [];

            const workActivities = occ.wa?.map((e) => ({
              id: e.id,
              name: e.n,
              value: e.v,
              level: e.l,
            })) ?? [];

            const workContext = occ.wc?.map((e) => ({
              id: e.id,
              name: e.n,
              value: e.v,
            })) ?? [];

            const toolsTech = occ.tt?.map((t) => ({
              title: t.t,
              category: t.c,
              hot_technology: t.h ?? false,
            })) ?? [];

            const dwas = occ.dw?.map((d) => ({
              id: d.id,
              title: d.t,
            })) ?? [];

            const relatedOccs = occ.ro?.map((r) => ({
              code: r.c,
              title: r.t,
            })) ?? [];

            await prisma.occupationONET.upsert({
              where: { id: code },
              create: {
                id: code,
                title: occ.t,
                description: occ.d || null,
                tasks: toJson(tasks),
                dwas: toJson(dwas),
                toolsTech: toJson(toolsTech),
                knowledge: toJson(knowledge),
                skills: toJson(skills),
                abilities: toJson(abilities),
                workActivities: toJson(workActivities),
                workContext: toJson(workContext),
                relatedOccs: toJson(relatedOccs),
                jobZone: occ.jz ?? null,
              },
              update: {
                title: occ.t,
                description: occ.d || null,
                tasks: toJson(tasks),
                dwas: toJson(dwas),
                toolsTech: toJson(toolsTech),
                knowledge: toJson(knowledge),
                skills: toJson(skills),
                abilities: toJson(abilities),
                workActivities: toJson(workActivities),
                workContext: toJson(workContext),
                relatedOccs: toJson(relatedOccs),
                jobZone: occ.jz ?? null,
              },
            });
            synced++;
          } catch (e) {
            errors++;
            if (errors <= 5) {
              console.error(`[syncONET] Failed to upsert ${code}:`, e);
            }
          }
        })
      );

      if ((i + batchSize) % 200 === 0 || i + batchSize >= codes.length) {
        console.log(
          `[syncONET] Progress: ${Math.min(i + batchSize, codes.length)}/${codes.length} — ${synced} synced, ${errors} errors`
        );
      }
    }

    console.log(`[syncONET] Done: ${synced} occupations synced with full data, ${errors} errors`);

    await prisma.dataSyncLog.update({
      where: { id: log.id },
      data: {
        status: "completed",
        recordsUpdated: synced,
        version: "ONET-30.2",
        completedAt: new Date(),
      },
    });
  } catch (e) {
    await prisma.dataSyncLog.update({
      where: { id: log.id },
      data: {
        status: "failed",
        error: String(e),
        recordsUpdated: synced,
        completedAt: new Date(),
      },
    });
  }

  return { synced, errors };
}

/**
 * Sync a single O*NET occupation by code.
 * Uses local dataset — no API calls needed.
 * Useful for on-demand caching when a user looks up a specific occupation.
 */
export async function syncSingleOccupation(
  onetCode: string
): Promise<boolean> {
  try {
    const { loadONETFullData } = await import("@/lib/data-loaders");
    const onetData = await loadONETFullData();
    const occ = onetData[onetCode];

    if (!occ) {
      console.warn(`[syncSingle] O*NET code ${onetCode} not found in local dataset`);
      return false;
    }

    const tasks = occ.ta?.map((t) => ({ id: t.id, title: t.t, importance: t.im })) ?? [];
    const skills = occ.sk?.map((e) => ({ id: e.id, name: e.n, value: e.v, level: e.l })) ?? [];
    const abilities = occ.ab?.map((e) => ({ id: e.id, name: e.n, value: e.v, level: e.l })) ?? [];
    const knowledge = occ.kn?.map((e) => ({ id: e.id, name: e.n, value: e.v, level: e.l })) ?? [];
    const workActivities = occ.wa?.map((e) => ({ id: e.id, name: e.n, value: e.v, level: e.l })) ?? [];
    const workContext = occ.wc?.map((e) => ({ id: e.id, name: e.n, value: e.v })) ?? [];
    const toolsTech = occ.tt?.map((t) => ({ title: t.t, category: t.c, hot_technology: t.h ?? false })) ?? [];
    const dwas = occ.dw?.map((d) => ({ id: d.id, title: d.t })) ?? [];
    const relatedOccs = occ.ro?.map((r) => ({ code: r.c, title: r.t })) ?? [];

    await prisma.occupationONET.upsert({
      where: { id: onetCode },
      create: {
        id: onetCode,
        title: occ.t,
        description: occ.d || null,
        tasks: toJson(tasks),
        dwas: toJson(dwas),
        toolsTech: toJson(toolsTech),
        knowledge: toJson(knowledge),
        skills: toJson(skills),
        abilities: toJson(abilities),
        workActivities: toJson(workActivities),
        workContext: toJson(workContext),
        relatedOccs: toJson(relatedOccs),
        jobZone: occ.jz ?? null,
      },
      update: {
        title: occ.t,
        description: occ.d || null,
        tasks: toJson(tasks),
        dwas: toJson(dwas),
        toolsTech: toJson(toolsTech),
        knowledge: toJson(knowledge),
        skills: toJson(skills),
        abilities: toJson(abilities),
        workActivities: toJson(workActivities),
        workContext: toJson(workContext),
        relatedOccs: toJson(relatedOccs),
        jobZone: occ.jz ?? null,
      },
    });

    return true;
  } catch (e) {
    console.error(`Failed to sync ${onetCode}:`, e);
    return false;
  }
}

/**
 * SOC code crosswalk: maps O*NET base SOC codes to their OEWS equivalents.
 * Needed because BLS periodically restructures SOC codes — O*NET may split
 * occupations that OEWS combines under a single code, or vice versa.
 * Military occupations (55-xxxx) have no OEWS data.
 */
const OEWS_SOC_CROSSWALK: Record<string, string> = {
  // Buyers & Purchasing → combined in OEWS
  "13-1021": "13-1020", "13-1022": "13-1020", "13-1023": "13-1020",
  // Property Appraisers → combined in OEWS
  "13-2022": "13-2020", "13-2023": "13-2020",
  // Counselors → combined in OEWS
  "21-1011": "21-1018", "21-1014": "21-1018",
  // Special Ed Teachers → combined K+Elem in OEWS
  "25-2055": "25-2052", "25-2056": "25-2052",
  // Teaching Assistants → combined in OEWS
  "25-9042": "25-9045", "25-9043": "25-9045", "25-9049": "25-9045",
  // Lab Technologists/Technicians → combined in OEWS
  "29-2011": "29-2010", "29-2012": "29-2010",
  // Home Health + Personal Care → combined in OEWS
  "31-1121": "31-1120", "31-1122": "31-1120",
  // Tour & Travel Guides → combined in OEWS
  "39-7011": "39-7010", "39-7012": "39-7010",
  // Construction workers → combined in OEWS
  "47-4091": "47-4090", "47-4099": "47-4090",
  // Assemblers → combined in OEWS
  "51-2022": "51-2028", "51-2023": "51-2028",
  "51-2092": "51-2090", "51-2099": "51-2090",
  // First-Line Supervisors Transportation → combined in OEWS
  "53-1042": "53-1047", "53-1043": "53-1047",
  "53-1044": "53-1047", "53-1049": "53-1047",
};

/**
 * Sync OEWS (wage & employment) data from local BLS dataset.
 *
 * Uses the complete OEWS May 2024 dataset (Excel export from BLS) which has been
 * converted to a JSON file at src/data/oews-data.json. This contains
 * 831 detailed occupations with employment, mean wage, median wage,
 * and percentile wage data (10th, 25th, 75th, 90th).
 *
 * Handles SOC code restructuring via a crosswalk — O*NET codes that
 * don't directly match an OEWS code are mapped to their combined equivalent.
 * Only military occupations (55-xxxx) and fishing (45-3031) lack OEWS data.
 *
 * No BLS API calls needed — all data is local.
 */
export async function syncOEWS(): Promise<{ synced: number; errors: number }> {
  const log = await prisma.dataSyncLog.create({
    data: {
      source: "OEWS",
      status: "started",
      startedAt: new Date(),
    },
  });

  let synced = 0;
  let errors = 0;

  try {
    // Get all cached O*NET occupation codes
    const occupations = await prisma.occupationONET.findMany({
      select: { id: true, title: true },
    });

    if (occupations.length === 0) {
      console.log("[syncOEWS] No O*NET occupations cached yet. Sync O*NET first.");
      await prisma.dataSyncLog.update({
        where: { id: log.id },
        data: { status: "completed", recordsUpdated: 0, completedAt: new Date() },
      });
      return { synced: 0, errors: 0 };
    }

    // Load OEWS data from bundled JSON file
    console.log("[syncOEWS] Loading OEWS data from local dataset...");
    const { loadOEWSData } = await import("@/lib/data-loaders");
    const oewsData = await loadOEWSData();

    const oewsSocCodes = Object.keys(oewsData);
    console.log(`[syncOEWS] Loaded ${oewsSocCodes.length} occupations from OEWS dataset`);

    // Build a lookup map: SOC base code (e.g., "11-1021") → OEWS data
    const oewsLookup = new Map<string, OEWSOccupationData>();
    for (const [socCode, data] of Object.entries(oewsData)) {
      oewsLookup.set(socCode, data);
    }

    console.log(`[syncOEWS] Matching against ${occupations.length} O*NET occupations...`);

    let matched = 0;
    let unmatched = 0;
    let crosswalked = 0;
    const year = 2024; // OEWS May 2024 dataset

    for (const occ of occupations) {
      try {
        // Extract base SOC code: "11-1021.00" → "11-1021"
        const baseCode = occ.id.replace(/\.\d+$/, "");

        // Try direct match first, then crosswalk, then parent code
        let oewsOcc = oewsLookup.get(baseCode);

        if (!oewsOcc) {
          // Try the crosswalk for restructured SOC codes
          const mappedCode = OEWS_SOC_CROSSWALK[baseCode];
          if (mappedCode) {
            oewsOcc = oewsLookup.get(mappedCode);
            if (oewsOcc) crosswalked++;
          }
        }

        if (!oewsOcc) {
          // Try parent code: "13-1021" → "13-1020"
          const parentCode = baseCode.slice(0, -1) + "0";
          oewsOcc = oewsLookup.get(parentCode);
          if (oewsOcc) crosswalked++;
        }

        if (oewsOcc) {
          matched++;
          const employment = oewsOcc.e !== null ? Math.round(oewsOcc.e) : null;

          await prisma.occupationWages.upsert({
            where: {
              onetSocCode_areaType_areaCode_year: {
                onetSocCode: occ.id,
                areaType: "national",
                areaCode: "0000000",
                year,
              },
            },
            create: {
              onetSocCode: occ.id,
              areaType: "national",
              areaCode: "0000000",
              areaName: "National",
              employment,
              meanWage: oewsOcc.m,
              medianWage: oewsOcc.md,
              pct10: oewsOcc.p10,
              pct25: oewsOcc.p25,
              pct75: oewsOcc.p75,
              pct90: oewsOcc.p90,
              year,
            },
            update: {
              areaName: "National",
              employment,
              meanWage: oewsOcc.m,
              medianWage: oewsOcc.md,
              pct10: oewsOcc.p10,
              pct25: oewsOcc.p25,
              pct75: oewsOcc.p75,
              pct90: oewsOcc.p90,
            },
          });
          synced++;
        } else {
          unmatched++;
        }
      } catch (e) {
        errors++;
        console.error(`[syncOEWS] Failed to upsert ${occ.id}:`, e);
      }
    }

    console.log(
      `[syncOEWS] Done: ${matched} matched (${crosswalked} via crosswalk), ${unmatched} unmatched (military/fishing), ${synced} synced, ${errors} errors`
    );

    await prisma.dataSyncLog.update({
      where: { id: log.id },
      data: {
        status: "completed",
        recordsUpdated: synced,
        version: "OEWS-2024",
        completedAt: new Date(),
      },
    });
  } catch (e) {
    await prisma.dataSyncLog.update({
      where: { id: log.id },
      data: {
        status: "failed",
        error: String(e),
        recordsUpdated: synced,
        completedAt: new Date(),
      },
    });
  }

  return { synced, errors };
}

/**
 * Convert a 6-digit SOC code to the O*NET base format.
 * e.g., "111021" → "11-1021"
 */
function socToOnetBase(soc: string): string {
  return soc.slice(0, 2) + "-" + soc.slice(2);
}

/**
 * Sync ORS (Occupational Requirements Survey) data from local dataset.
 *
 * Uses the complete ORS 2025 dataset (Excel export from BLS) which has been
 * converted to a JSON file at src/data/ors-data.json. This contains
 * per-occupation data for 226 SOC codes across 48 categories covering
 * physical demands, environmental conditions, cognitive/mental requirements,
 * and education/training/experience.
 *
 * No BLS API calls needed — all data is local.
 */
export async function syncORS(): Promise<{ synced: number; errors: number }> {
  const log = await prisma.dataSyncLog.create({
    data: {
      source: "ORS",
      status: "started",
      startedAt: new Date(),
    },
  });

  let synced = 0;
  let errors = 0;

  try {
    // Load ORS data from bundled JSON file
    console.log("[syncORS] Loading ORS data from local dataset...");
    const { loadORSData } = await import("@/lib/data-loaders");
    const orsData = await loadORSData();

    const orsSocCodes = Object.keys(orsData);
    console.log(`[syncORS] Loaded ${orsSocCodes.length} occupations from ORS dataset`);

    // Get all cached O*NET occupations
    const occupations = await prisma.occupationONET.findMany({
      select: { id: true, title: true },
    });

    console.log(`[syncORS] Matching against ${occupations.length} O*NET occupations...`);

    // Build a map from O*NET base code (e.g., "11-1021") to ORS data
    // O*NET codes like "11-1021.00" and "11-1021.01" both map to SOC "111021"
    const orsLookup = new Map<string, typeof orsData[string]>();
    for (const [socCode, data] of Object.entries(orsData)) {
      const onetBase = socToOnetBase(socCode);
      orsLookup.set(onetBase, data);
    }

    let matched = 0;
    let unmatched = 0;

    for (const occ of occupations) {
      try {
        // Extract base SOC code: "11-1021.00" → "11-1021"
        const baseCode = occ.id.replace(/\.\d+$/, "");
        const orsOcc = orsLookup.get(baseCode);

        if (orsOcc) {
          matched++;
          await prisma.occupationORS.upsert({
            where: { onetSocCode: occ.id },
            create: {
              onetSocCode: occ.id,
              title: occ.title,
              physicalDemands: toJson(orsOcc.p),
              envConditions: toJson(orsOcc.e),
              cogMental: toJson(orsOcc.c),
              eduTrainExp: toJson(orsOcc.d),
            },
            update: {
              title: occ.title,
              physicalDemands: toJson(orsOcc.p),
              envConditions: toJson(orsOcc.e),
              cogMental: toJson(orsOcc.c),
              eduTrainExp: toJson(orsOcc.d),
            },
          });
          synced++;
        } else {
          unmatched++;
        }
      } catch (e) {
        errors++;
        console.error(`[syncORS] Failed to store ORS for ${occ.id}:`, e);
      }
    }

    console.log(
      `[syncORS] Done: ${matched} matched, ${unmatched} unmatched, ${synced} synced, ${errors} errors`
    );

    await prisma.dataSyncLog.update({
      where: { id: log.id },
      data: {
        status: "completed",
        recordsUpdated: synced,
        version: "ORS-2025",
        completedAt: new Date(),
      },
    });
  } catch (e) {
    await prisma.dataSyncLog.update({
      where: { id: log.id },
      data: {
        status: "failed",
        error: String(e),
        recordsUpdated: synced,
        completedAt: new Date(),
      },
    });
  }

  return { synced, errors };
}

/** BLS projections data structure (mirrors data-loaders.ts) */
interface BLSProjectionsData {
  t: string;        // title
  be: number | null; // base year employment (2024)
  pe: number | null; // projected year employment (2034)
  cn: number | null; // employment change, numeric
  cp: number | null; // employment change, percent
  oa: number | null; // annual openings (avg 2024-34)
}

/**
 * Sync employment projections from real BLS 2024-2034 data.
 *
 * Source: BLS Table 1.10 "Occupational projections and worker characteristics"
 * (https://www.bls.gov/emp/tables/occupational-projections-and-characteristics.htm)
 *
 * BLS uses 7-char SOC codes ("XX-XXXX"), while O*NET uses "XX-XXXX.XX".
 * We store socCode in "XX-XXXX" format to match the compute route lookup.
 *
 * For O*NET codes that don't directly match a BLS SOC code, we apply
 * the same OEWS_SOC_CROSSWALK used for wage data, since BLS projections
 * use the same SOC structure as OEWS.
 */
export async function syncProjections(): Promise<{ synced: number; errors: number }> {
  const log = await prisma.dataSyncLog.create({
    data: {
      source: "PROJECTIONS",
      status: "started",
      startedAt: new Date(),
    },
  });

  let synced = 0;
  let errors = 0;

  try {
    // Clean up old synthetic projection records (used wrong SOC format / synthetic data)
    const deleted = await prisma.occupationProjections.deleteMany({});
    console.log(`[syncProjections] Cleared ${deleted.count} old projection records`);

    // Load real BLS projections data from bundled JSON
    const blsModule = await import("@/data/bls-projections.json");
    const blsData = blsModule.default as unknown as Record<string, BLSProjectionsData>;
    const blsCount = Object.keys(blsData).length;
    console.log(`[syncProjections] Loaded ${blsCount} BLS projections (2024-2034)`);

    // Load O*NET occupations to map to BLS SOC codes
    const occupations = await prisma.occupationONET.findMany({
      select: { id: true, title: true },
    });

    if (occupations.length === 0) {
      console.log("[syncProjections] No O*NET occupations cached yet. Sync O*NET first.");
      await prisma.dataSyncLog.update({
        where: { id: log.id },
        data: { status: "completed", recordsUpdated: 0, completedAt: new Date() },
      });
      return { synced: 0, errors: 0 };
    }

    console.log(`[syncProjections] Matching ${occupations.length} O*NET occupations to BLS projections...`);

    let directMatch = 0;
    let crosswalkMatch = 0;
    let baseMatch = 0;
    let noMatch = 0;

    for (const occ of occupations) {
      try {
        // Normalize O*NET code "XX-XXXX.XX" → "XX-XXXX"
        const baseSoc = occ.id.replace(/\.\d+$/, "");

        // Priority chain for BLS lookup:
        // 1. Direct match on base SOC code
        // 2. Crosswalk lookup (for restructured SOC codes)
        // 3. Base .00 code (for O*NET specializations under same SOC)
        let bls = blsData[baseSoc];
        let matchType = "direct";

        if (!bls) {
          const crosswalked = OEWS_SOC_CROSSWALK[baseSoc];
          if (crosswalked) {
            bls = blsData[crosswalked];
            matchType = "crosswalk";
          }
        }

        if (!bls) {
          // Try parent SOC (e.g., "29-1141" for "29-1141.01")
          // Already handled by baseSoc above — skip
          noMatch++;
          continue;
        }

        if (matchType === "direct") directMatch++;
        else if (matchType === "crosswalk") crosswalkMatch++;
        else baseMatch++;

        // Store with "XX-XXXX" format SOC code (matches compute route lookup)
        const socCode = baseSoc;

        await prisma.occupationProjections.upsert({
          where: {
            socCode_baseYear_projYear: {
              socCode,
              baseYear: 2024,
              projYear: 2034,
            },
          },
          create: {
            socCode,
            title: bls.t,
            baseYear: 2024,
            projYear: 2034,
            baseEmployment: bls.be,
            projEmployment: bls.pe,
            changeN: bls.cn,
            changePct: bls.cp,
            openingsAnnual: bls.oa,
          },
          update: {
            title: bls.t,
            baseEmployment: bls.be,
            projEmployment: bls.pe,
            changeN: bls.cn,
            changePct: bls.cp,
            openingsAnnual: bls.oa,
          },
        });
        synced++;
      } catch (e) {
        errors++;
        console.error(`[syncProjections] Failed for ${occ.id}:`, e);
      }
    }

    console.log(`[syncProjections] Results: ${synced} synced, ${errors} errors`);
    console.log(`  Direct matches: ${directMatch}, Crosswalk: ${crosswalkMatch}, Base: ${baseMatch}, No match: ${noMatch}`);

    await prisma.dataSyncLog.update({
      where: { id: log.id },
      data: {
        status: "completed",
        recordsUpdated: synced,
        version: "EP-2024-34",
        completedAt: new Date(),
      },
    });
  } catch (e) {
    await prisma.dataSyncLog.update({
      where: { id: log.id },
      data: {
        status: "failed",
        error: String(e),
        recordsUpdated: synced,
        completedAt: new Date(),
      },
    });
  }

  return { synced, errors };
}

/**
 * Sync DOT (Dictionary of Occupational Titles) data from local dataset.
 *
 * Uses the complete DOT dataset (12,726 occupations) scraped from occupationalinfo.org
 * and converted to a compact JSON file at src/data/dot-data.json.
 * Each entry contains DOT code, title, SVP, strength, GED levels, and worker functions.
 *
 * No external API calls needed — all data is local.
 */
export async function syncDOT(): Promise<{ synced: number; errors: number }> {
  const log = await prisma.dataSyncLog.create({
    data: {
      source: "DOT",
      status: "started",
      startedAt: new Date(),
    },
  });

  let synced = 0;
  let errors = 0;

  try {
    console.log("[syncDOT] Loading DOT data from local dataset...");
    const { loadDOTData } = await import("@/lib/data-loaders");
    const dotData = await loadDOTData();

    const dotCodes = Object.keys(dotData);
    console.log(`[syncDOT] Loaded ${dotCodes.length} DOT occupations`);

    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < dotCodes.length; i += batchSize) {
      const batch = dotCodes.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (dotCode) => {
          const occ = dotData[dotCode];
          try {
            // Build aptitudes object from DPT and GOE
            const aptitudes: Record<string, unknown> = {};
            if (occ.dpt) aptitudes.workerFunctions = occ.dpt;
            if (occ.goe) aptitudes.goe = occ.goe;

            const physicalDemands: Record<string, unknown> = {
              strength: occ.str,
            };

            await prisma.occupationDOT.upsert({
              where: { id: dotCode },
              create: {
                id: dotCode,
                title: occ.t,
                industryDesig: occ.ind || null,
                svp: occ.s,
                strength: occ.str,
                gedR: occ.r,
                gedM: occ.m,
                gedL: occ.l,
                aptitudes: toJson(aptitudes),
                temperaments: [],
                interests: [],
                physicalDemands: toJson(physicalDemands),
                envConditions: toJson({}),
                workFields: [],
                mpsms: [],
                dlu: occ.dlu || null,
              },
              update: {
                title: occ.t,
                industryDesig: occ.ind || null,
                svp: occ.s,
                strength: occ.str,
                gedR: occ.r,
                gedM: occ.m,
                gedL: occ.l,
                aptitudes: toJson(aptitudes),
                physicalDemands: toJson(physicalDemands),
                dlu: occ.dlu || null,
              },
            });
            synced++;
          } catch (e) {
            errors++;
            if (errors <= 5) {
              console.error(`[syncDOT] Failed for ${dotCode}:`, e);
            }
          }
        })
      );

      if ((i + batchSize) % 1000 === 0 || i + batchSize >= dotCodes.length) {
        console.log(
          `[syncDOT] Progress: ${Math.min(i + batchSize, dotCodes.length)}/${dotCodes.length} — ${synced} synced, ${errors} errors`
        );
      }
    }

    console.log(`[syncDOT] Done: ${synced} synced, ${errors} errors`);

    await prisma.dataSyncLog.update({
      where: { id: log.id },
      data: {
        status: "completed",
        recordsUpdated: synced,
        version: "DOT-4th-Ed",
        completedAt: new Date(),
      },
    });
  } catch (e) {
    await prisma.dataSyncLog.update({
      where: { id: log.id },
      data: {
        status: "failed",
        error: String(e),
        recordsUpdated: synced,
        completedAt: new Date(),
      },
    });
  }

  return { synced, errors };
}

/**
 * Build DOT→O*NET crosswalk by matching DOT occupation titles to O*NET occupations.
 *
 * Matching strategy (in priority order):
 * 1. Exact title match (normalized)
 * 2. DOT title is substring of O*NET title or vice versa
 * 3. High word overlap (≥30% of significant words match, minimum 2 words)
 *
 * Requires both DOT and O*NET data to be synced first.
 */
export async function syncCrosswalk(): Promise<{ synced: number; errors: number }> {
  const log = await prisma.dataSyncLog.create({
    data: {
      source: "CROSSWALK",
      status: "started",
      startedAt: new Date(),
    },
  });

  let synced = 0;
  let errors = 0;

  // Common words to ignore when matching
  const STOP_WORDS = new Set([
    "and", "the", "for", "all", "any", "not", "nor", "but", "yet",
    "other", "except", "general", "special", "first", "second", "third",
    "chief", "head", "lead", "senior", "junior", "apprentice", "helper",
    "worker", "operator", "supervisor", "manager", "director", "assistant",
    "aide", "attendant", "clerk", "technician", "specialist",
  ]);

  function normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getSignificantWords(title: string): string[] {
    return normalizeTitle(title)
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  }

  try {
    // Get all O*NET occupations
    const onetOccs = await prisma.occupationONET.findMany({
      select: { id: true, title: true },
    });

    // Get all DOT occupations
    const dotOccs = await prisma.occupationDOT.findMany({
      select: { id: true, title: true },
    });

    if (onetOccs.length === 0 || dotOccs.length === 0) {
      console.log("[syncCrosswalk] Need both O*NET and DOT data. Sync those first.");
      await prisma.dataSyncLog.update({
        where: { id: log.id },
        data: { status: "completed", recordsUpdated: 0, completedAt: new Date() },
      });
      return { synced: 0, errors: 0 };
    }

    console.log(`[syncCrosswalk] Matching ${dotOccs.length} DOT → ${onetOccs.length} O*NET occupations...`);

    // Clear existing crosswalk
    await prisma.dOTONETCrosswalk.deleteMany({});

    // Build word index for O*NET for fast lookups
    const onetByWord = new Map<string, Set<number>>();
    for (let i = 0; i < onetOccs.length; i++) {
      const words = getSignificantWords(onetOccs[i].title);
      for (const word of words) {
        if (!onetByWord.has(word)) onetByWord.set(word, new Set());
        onetByWord.get(word)!.add(i);
      }
    }

    // Match each DOT occupation to best O*NET occupation
    const crosswalkEntries: { dotCode: string; onetSocCode: string }[] = [];
    let matched = 0;
    let unmatched = 0;

    for (const dot of dotOccs) {
      const dotNorm = normalizeTitle(dot.title);
      const dotWords = getSignificantWords(dot.title);

      // Get candidate O*NET indices using word index
      const candidateIndices = new Set<number>();
      for (const word of dotWords) {
        const indices = onetByWord.get(word);
        if (indices) {
          for (const idx of indices) candidateIndices.add(idx);
        }
      }

      // Score each candidate
      let bestIdx = -1;
      let bestScore = 0;

      for (const idx of candidateIndices) {
        const onetNorm = normalizeTitle(onetOccs[idx].title);

        // Exact match
        if (dotNorm === onetNorm) {
          bestIdx = idx;
          bestScore = 1.0;
          break;
        }

        // Substring containment
        if (dotNorm.includes(onetNorm) || onetNorm.includes(dotNorm)) {
          if (0.9 > bestScore) {
            bestIdx = idx;
            bestScore = 0.9;
          }
          continue;
        }

        // Word overlap
        const onetWords = new Set(getSignificantWords(onetOccs[idx].title));
        let wordMatches = 0;
        for (const w of dotWords) {
          if (onetWords.has(w)) wordMatches++;
        }
        if (wordMatches >= 2) {
          const totalUnique = new Set([...dotWords, ...onetWords]).size;
          const score = wordMatches / totalUnique;
          if (score > bestScore) {
            bestScore = score;
            bestIdx = idx;
          }
        }
      }

      // Also try substring match against all O*NET if no good word match
      if (bestScore < 0.4) {
        for (let j = 0; j < onetOccs.length; j++) {
          const onetNorm = normalizeTitle(onetOccs[j].title);
          if (dotNorm.includes(onetNorm) || onetNorm.includes(dotNorm)) {
            bestIdx = j;
            bestScore = 0.9;
            break;
          }
        }
      }

      if (bestIdx >= 0 && bestScore >= 0.3) {
        matched++;
        crosswalkEntries.push({
          dotCode: dot.id,
          onetSocCode: onetOccs[bestIdx].id,
        });
      } else {
        unmatched++;
      }
    }

    console.log(`[syncCrosswalk] Matched: ${matched}, Unmatched: ${unmatched}`);
    console.log(`[syncCrosswalk] Inserting ${crosswalkEntries.length} crosswalk entries...`);

    // Batch insert
    const batchSize = 500;
    for (let i = 0; i < crosswalkEntries.length; i += batchSize) {
      const batch = crosswalkEntries.slice(i, i + batchSize);
      try {
        await prisma.dOTONETCrosswalk.createMany({
          data: batch,
          skipDuplicates: true,
        });
        synced += batch.length;
      } catch {
        // Fall back to individual inserts
        for (const entry of batch) {
          try {
            await prisma.dOTONETCrosswalk.create({ data: entry });
            synced++;
          } catch {
            errors++;
          }
        }
      }
    }

    const uniqueOnet = new Set(crosswalkEntries.map((e) => e.onetSocCode));
    console.log(
      `[syncCrosswalk] Done: ${synced} crosswalk entries, linking to ${uniqueOnet.size} O*NET occupations`
    );

    await prisma.dataSyncLog.update({
      where: { id: log.id },
      data: {
        status: "completed",
        recordsUpdated: synced,
        version: "DOT-ONET-XW",
        completedAt: new Date(),
      },
    });
  } catch (e) {
    await prisma.dataSyncLog.update({
      where: { id: log.id },
      data: {
        status: "failed",
        error: String(e),
        recordsUpdated: synced,
        completedAt: new Date(),
      },
    });
  }

  return { synced, errors };
}

/**
 * Run all syncs in order: ONET -> OEWS -> ORS -> PROJECTIONS -> DOT -> CROSSWALK.
 * OEWS/ORS/PROJECTIONS depend on ONET data being present.
 * CROSSWALK depends on both ONET and DOT data being present.
 * Uses a global lock to prevent concurrent syncs.
 */
export async function syncAll(): Promise<Record<SyncSource, { synced: number; errors: number }>> {
  if (isSyncing) {
    console.log("[syncAll] Sync already in progress, skipping.");
    return {
      ONET: { synced: 0, errors: 0 },
      ORS: { synced: 0, errors: 0 },
      OEWS: { synced: 0, errors: 0 },
      PROJECTIONS: { synced: 0, errors: 0 },
      DOT: { synced: 0, errors: 0 },
      CROSSWALK: { synced: 0, errors: 0 },
    };
  }

  isSyncing = true;
  const startTime = Date.now();

  console.log("[syncAll] Starting full data sync...");

  const results: Record<SyncSource, { synced: number; errors: number }> = {
    ONET: { synced: 0, errors: 0 },
    ORS: { synced: 0, errors: 0 },
    OEWS: { synced: 0, errors: 0 },
    PROJECTIONS: { synced: 0, errors: 0 },
    DOT: { synced: 0, errors: 0 },
    CROSSWALK: { synced: 0, errors: 0 },
  };

  try {
    // 1. Sync ONET first (others depend on it)
    console.log("[syncAll] Syncing O*NET data...");
    results.ONET = await syncONET();
    console.log(`[syncAll] O*NET: ${results.ONET.synced} synced, ${results.ONET.errors} errors`);

    // 2. Sync OEWS (wages/employment)
    console.log("[syncAll] Syncing OEWS wage data...");
    results.OEWS = await syncOEWS();
    console.log(`[syncAll] OEWS: ${results.OEWS.synced} synced, ${results.OEWS.errors} errors`);

    // 3. Sync ORS (physical demands)
    console.log("[syncAll] Syncing ORS data...");
    results.ORS = await syncORS();
    console.log(`[syncAll] ORS: ${results.ORS.synced} synced, ${results.ORS.errors} errors`);

    // 4. Sync Projections (depends on OEWS data)
    console.log("[syncAll] Syncing projections...");
    results.PROJECTIONS = await syncProjections();
    console.log(`[syncAll] Projections: ${results.PROJECTIONS.synced} synced, ${results.PROJECTIONS.errors} errors`);

    // 5. Sync DOT occupations
    console.log("[syncAll] Syncing DOT data...");
    results.DOT = await syncDOT();
    console.log(`[syncAll] DOT: ${results.DOT.synced} synced, ${results.DOT.errors} errors`);

    // 6. Build DOT→O*NET crosswalk (depends on both ONET and DOT)
    console.log("[syncAll] Building DOT→O*NET crosswalk...");
    results.CROSSWALK = await syncCrosswalk();
    console.log(`[syncAll] Crosswalk: ${results.CROSSWALK.synced} synced, ${results.CROSSWALK.errors} errors`);

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`[syncAll] Full sync complete in ${elapsed} minutes.`);
  } finally {
    isSyncing = false;
  }

  return results;
}
