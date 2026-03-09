/**
 * Data Sync Service
 *
 * Orchestrates loading occupational data from O*NET, BLS (OEWS/ORS),
 * and employment projections into the local database cache.
 * Tracks versions and sync status via DataSyncLog.
 */

import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";
import { getFullOccupation } from "./onet";

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
 * Sync O*NET occupation data from local dataset + O*NET API for details.
 *
 * Phase 1: Load all 1,016 occupations from local dataset (code, title, jobZone).
 *          This ensures every occupation exists in the database immediately.
 * Phase 2: For occupations missing detailed data (tasks, skills, etc.),
 *          fetch from O*NET API and update. This is optional and rate-limited.
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
    // Phase 1: Load all occupations from local dataset
    console.log("[syncONET] Loading O*NET occupations from local dataset...");
    const { loadONETData } = await import("@/lib/data-loaders");
    const onetData = await loadONETData();

    const codes = Object.keys(onetData);
    console.log(`[syncONET] Loaded ${codes.length} occupations from local dataset`);

    // Upsert all basic occupation records
    for (const code of codes) {
      const occ = onetData[code];
      try {
        await prisma.occupationONET.upsert({
          where: { id: code },
          create: {
            id: code,
            title: occ.t,
            jobZone: occ.jz,
          },
          update: {
            title: occ.t,
            jobZone: occ.jz,
          },
        });
        synced++;
      } catch (e) {
        errors++;
        if (errors <= 5) {
          console.error(`[syncONET] Failed to upsert ${code}:`, e);
        }
      }
    }

    console.log(`[syncONET] Phase 1 done: ${synced} basic records upserted`);

    // Phase 2: Fetch detailed data from O*NET API for occupations missing it
    const needDetails = await prisma.occupationONET.findMany({
      where: { description: null },
      select: { id: true },
    });

    if (needDetails.length > 0) {
      console.log(`[syncONET] Phase 2: ${needDetails.length} occupations need detailed data from O*NET API`);

      let detailed = 0;
      let detailErrors = 0;

      for (let i = 0; i < needDetails.length; i++) {
        const occ = needDetails[i];
        try {
          const full = await getFullOccupation(occ.id);

          await prisma.occupationONET.update({
            where: { id: occ.id },
            data: {
              title: full.title,
              description: full.description,
              tasks: toJson(full.tasks),
              dwas: toJson(full.dwas),
              toolsTech: toJson(full.toolsTech),
              knowledge: toJson(full.knowledge),
              skills: toJson(full.skills),
              abilities: toJson(full.abilities),
              workActivities: toJson(full.workActivities),
              workContext: toJson(full.workContext),
              relatedOccs: toJson(full.relatedOccs),
              jobZone: full.jobZone ?? onetData[occ.id]?.jz ?? null,
            },
          });

          detailed++;
        } catch (e) {
          detailErrors++;
          if (detailErrors <= 5) {
            console.error(`[syncONET] Failed to fetch details for ${occ.id}:`, e);
          }
        }

        // Rate limiting: 200ms between API calls
        await new Promise((r) => setTimeout(r, 200));

        // Progress logging every 100 occupations
        if ((i + 1) % 100 === 0 || i === needDetails.length - 1) {
          console.log(
            `[syncONET] Phase 2 progress: ${i + 1}/${needDetails.length} — ${detailed} detailed, ${detailErrors} errors`
          );
        }
      }

      console.log(`[syncONET] Phase 2 done: ${detailed} occupations enriched with API data`);
    } else {
      console.log("[syncONET] All occupations already have detailed data");
    }

    await prisma.dataSyncLog.update({
      where: { id: log.id },
      data: {
        status: "completed",
        recordsUpdated: synced,
        version: `ONET-${new Date().getFullYear()}`,
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
 * Useful for on-demand caching when a user looks up a specific occupation.
 */
export async function syncSingleOccupation(
  onetCode: string
): Promise<boolean> {
  try {
    const full = await getFullOccupation(onetCode);

    await prisma.occupationONET.upsert({
      where: { id: onetCode },
      create: {
        id: onetCode,
        title: full.title,
        description: full.description,
        tasks: toJson(full.tasks),
        dwas: toJson(full.dwas),
        toolsTech: toJson(full.toolsTech),
        knowledge: toJson(full.knowledge),
        skills: toJson(full.skills),
        abilities: toJson(full.abilities),
        workActivities: toJson(full.workActivities),
        workContext: toJson(full.workContext),
        relatedOccs: toJson(full.relatedOccs),
        jobZone: full.jobZone ?? null,
      },
      update: {
        title: full.title,
        description: full.description,
        tasks: toJson(full.tasks),
        dwas: toJson(full.dwas),
        toolsTech: toJson(full.toolsTech),
        knowledge: toJson(full.knowledge),
        skills: toJson(full.skills),
        abilities: toJson(full.abilities),
        workActivities: toJson(full.workActivities),
        workContext: toJson(full.workContext),
        relatedOccs: toJson(full.relatedOccs),
        jobZone: full.jobZone ?? null,
      },
    });

    return true;
  } catch (e) {
    console.error(`Failed to sync ${onetCode}:`, e);
    return false;
  }
}

/**
 * Sync OEWS (wage & employment) data from local BLS dataset.
 *
 * Uses the complete OEWS May 2024 dataset (Excel export from BLS) which has been
 * converted to a JSON file at src/data/oews-data.json. This contains
 * 831 detailed occupations with employment, mean wage, median wage,
 * and percentile wage data (10th, 25th, 75th, 90th).
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
    const year = 2024; // OEWS May 2024 dataset

    for (const occ of occupations) {
      try {
        // Extract base SOC code: "11-1021.00" → "11-1021"
        const baseCode = occ.id.replace(/\.\d+$/, "");
        const oewsOcc = oewsLookup.get(baseCode);

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
      `[syncOEWS] Done: ${matched} matched, ${unmatched} unmatched, ${synced} synced, ${errors} errors`
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

/**
 * Sync employment projections.
 * BLS Employment Projections are published as static tables, not via the timeseries API.
 * We create projection records based on current employment data and national growth rates.
 * This provides a reasonable baseline for labor market viability scoring.
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

    console.log(`[syncProjections] Generating projections for ${occupations.length} occupations...`);

    for (const occ of occupations) {
      try {
        // Check if we have wage data with employment for this occupation
        const wageData = await prisma.occupationWages.findFirst({
          where: { onetSocCode: occ.id, employment: { not: null } },
          orderBy: { year: "desc" },
        });

        if (wageData && wageData.employment) {
          const currentYear = new Date().getFullYear();
          const projYear = currentYear + 10;
          // Use a conservative 3% total growth estimate as baseline
          const projEmployment = Math.round(wageData.employment * 1.03);
          const changeN = projEmployment - wageData.employment;
          const changePct = (changeN / wageData.employment) * 100;
          // Estimate annual openings as ~10% of employment (replacement + growth)
          const openingsAnnual = Math.round(wageData.employment * 0.10);

          await prisma.occupationProjections.upsert({
            where: {
              socCode_baseYear_projYear: {
                socCode: occ.id,
                baseYear: currentYear,
                projYear: projYear,
              },
            },
            create: {
              socCode: occ.id,
              title: occ.title,
              baseYear: currentYear,
              projYear: projYear,
              baseEmployment: wageData.employment,
              projEmployment: projEmployment,
              changeN: changeN,
              changePct: changePct,
              openingsAnnual: openingsAnnual,
            },
            update: {
              title: occ.title,
              baseEmployment: wageData.employment,
              projEmployment: projEmployment,
              changeN: changeN,
              changePct: changePct,
              openingsAnnual: openingsAnnual,
            },
          });
          synced++;
        }
      } catch (e) {
        errors++;
        console.error(`[syncProjections] Failed for ${occ.id}:`, e);
      }
    }

    await prisma.dataSyncLog.update({
      where: { id: log.id },
      data: {
        status: "completed",
        recordsUpdated: synced,
        version: `EP-${new Date().getFullYear()}`,
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
