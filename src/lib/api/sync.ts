/**
 * Data Sync Service
 *
 * Orchestrates loading occupational data from O*NET, BLS (OEWS/ORS),
 * and employment projections into the local database cache.
 * Tracks versions and sync status via DataSyncLog.
 */

import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";
import { searchOccupations, getFullOccupation } from "./onet";
import { fetchOEWSData, fetchORSData } from "./bls";

function toJson(val: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(val ?? []));
}

export type SyncSource = "ONET" | "ORS" | "OEWS" | "PROJECTIONS";

export interface SyncStatus {
  source: SyncSource;
  lastSync: Date | null;
  recordCount: number;
  version: string | null;
  status: string;
}

/**
 * Get sync status for all data sources.
 */
export async function getSyncStatus(): Promise<SyncStatus[]> {
  const sources: SyncSource[] = ["ONET", "ORS", "OEWS", "PROJECTIONS"];
  const statuses: SyncStatus[] = [];

  for (const source of sources) {
    const lastLog = await prisma.dataSyncLog.findFirst({
      where: { source, status: "completed" },
      orderBy: { completedAt: "desc" },
    });

    let recordCount = 0;
    switch (source) {
      case "ONET":
        recordCount = await prisma.occupationONET.count();
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
    }

    statuses.push({
      source,
      lastSync: lastLog?.completedAt ?? null,
      recordCount,
      version: lastLog?.version ?? null,
      status: lastLog?.status ?? "never",
    });
  }

  return statuses;
}

/**
 * Sync O*NET occupation data.
 * Fetches occupations and stores them in the local cache.
 */
export async function syncONET(
  batchSize = 20,
  maxOccupations = 1000
): Promise<{ synced: number; errors: number }> {
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
    // Search with broad terms to get occupation codes
    const searchTerms = [
      "manager", "engineer", "technician", "clerk", "operator",
      "analyst", "specialist", "assistant", "supervisor", "inspector",
      "mechanic", "nurse", "teacher", "accountant", "sales",
      "driver", "laborer", "carpenter", "electrician", "plumber",
      "secretary", "receptionist", "cashier", "cook", "janitor",
    ];

    const seenCodes = new Set<string>();

    for (const term of searchTerms) {
      if (synced >= maxOccupations) break;

      try {
        const results = await searchOccupations(term, 1, batchSize);
        if (!results.occupation) continue;

        for (const occ of results.occupation) {
          if (seenCodes.has(occ.code) || synced >= maxOccupations) continue;
          seenCodes.add(occ.code);

          try {
            const full = await getFullOccupation(occ.code);

            await prisma.occupationONET.upsert({
              where: { id: occ.code },
              create: {
                id: occ.code,
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

            synced++;
          } catch (e) {
            errors++;
            console.error(`Failed to sync ${occ.code}:`, e);
          }
        }
      } catch (e) {
        errors++;
        console.error(`Failed search for "${term}":`, e);
      }

      // Rate limiting: pause between batches
      await new Promise((r) => setTimeout(r, 500));
    }

    await prisma.dataSyncLog.update({
      where: { id: log.id },
      data: {
        status: "completed",
        recordsUpdated: synced,
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
 * Sync OEWS (wage & employment) data from BLS for all cached O*NET occupations.
 * Fetches national-level wage data for each occupation we have in the DB.
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
      console.log("OEWS sync: No O*NET occupations cached yet. Sync O*NET first.");
    }

    // BLS API allows up to 50 series per request, and we request 3 series per occupation.
    // Process in batches to respect rate limits.
    for (const occ of occupations) {
      try {
        // Convert O*NET code (e.g., "11-1011.00") to SOC code for BLS (e.g., "11-1011")
        const socCode = occ.id.replace(/\.\d+$/, "");
        const data = await fetchOEWSData(socCode);

        if (data) {
          await prisma.occupationWages.upsert({
            where: {
              onetSocCode_areaType_areaCode_year: {
                onetSocCode: occ.id,
                areaType: data.areaType,
                areaCode: data.areaCode,
                year: data.year,
              },
            },
            create: {
              onetSocCode: occ.id,
              areaType: data.areaType,
              areaCode: data.areaCode,
              areaName: data.areaName,
              employment: data.employment,
              meanWage: data.meanWage,
              medianWage: data.medianWage,
              pct10: data.pct10,
              pct25: data.pct25,
              pct75: data.pct75,
              pct90: data.pct90,
              year: data.year,
            },
            update: {
              areaName: data.areaName,
              employment: data.employment,
              meanWage: data.meanWage,
              medianWage: data.medianWage,
              pct10: data.pct10,
              pct25: data.pct25,
              pct75: data.pct75,
              pct90: data.pct90,
            },
          });
          synced++;
        }
      } catch (e) {
        errors++;
        console.error(`Failed to sync OEWS for ${occ.id}:`, e);
      }

      // BLS rate limit: ~25 requests/10 seconds for registered users
      await new Promise((r) => setTimeout(r, 500));
    }

    await prisma.dataSyncLog.update({
      where: { id: log.id },
      data: {
        status: "completed",
        recordsUpdated: synced,
        version: `OEWS-${new Date().getFullYear()}`,
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
 * Sync ORS (Occupational Requirements Survey) data from BLS.
 * ORS publishes aggregate-level data for all civilian workers.
 * We fetch this once and store it for each cached occupation as a baseline.
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
    // Fetch aggregate ORS data (one BLS API call covers all demands)
    const orsData = await fetchORSData("all");

    if (Object.keys(orsData).length === 0) {
      console.log("ORS sync: No ORS data returned from BLS.");
      await prisma.dataSyncLog.update({
        where: { id: log.id },
        data: { status: "completed", recordsUpdated: 0, completedAt: new Date() },
      });
      return { synced: 0, errors: 0 };
    }

    // Separate data into physical, environmental, and cognitive categories
    const physicalDemands: Record<string, string | null> = {};
    const envConditions: Record<string, string | null> = {};
    const cogMental: Record<string, string | null> = {};

    for (const [key, value] of Object.entries(orsData)) {
      if (key.startsWith("physical_")) physicalDemands[key.replace("physical_", "")] = value;
      else if (key.startsWith("env_")) envConditions[key.replace("env_", "")] = value;
      else if (key.startsWith("cog_")) cogMental[key.replace("cog_", "")] = value;
    }

    // Store ORS data for all cached occupations
    const occupations = await prisma.occupationONET.findMany({
      select: { id: true, title: true },
    });

    for (const occ of occupations) {
      try {
        await prisma.occupationORS.upsert({
          where: { onetSocCode: occ.id },
          create: {
            onetSocCode: occ.id,
            title: occ.title,
            physicalDemands: toJson(physicalDemands),
            envConditions: toJson(envConditions),
            cogMental: toJson(cogMental),
          },
          update: {
            title: occ.title,
            physicalDemands: toJson(physicalDemands),
            envConditions: toJson(envConditions),
            cogMental: toJson(cogMental),
          },
        });
        synced++;
      } catch (e) {
        errors++;
        console.error(`Failed to store ORS for ${occ.id}:`, e);
      }
    }

    await prisma.dataSyncLog.update({
      where: { id: log.id },
      data: {
        status: "completed",
        recordsUpdated: synced,
        version: `ORS-${new Date().getFullYear()}`,
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
 * Sync employment projections from BLS.
 * Uses the BLS Employment Projections program data.
 * Note: BLS EP data is released every 2 years and uses a different API pattern.
 * We fetch from the BLS public data series for projected employment.
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
      console.log("Projections sync: No O*NET occupations cached yet. Sync O*NET first.");
    }

    // We can estimate projections from OEWS employment trends.
    // BLS Employment Projections are published as static tables, not via the timeseries API.
    // So we create projection records based on current employment data and national growth rates.
    // This provides a reasonable baseline for labor market viability scoring.

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
        console.error(`Failed to sync projections for ${occ.id}:`, e);
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
 * Run all syncs in order: ONET -> OEWS -> ORS -> PROJECTIONS.
 * OEWS/ORS/PROJECTIONS depend on ONET data being present.
 */
export async function syncAll(): Promise<Record<SyncSource, { synced: number; errors: number }>> {
  console.log("[AutoSync] Starting full data sync...");

  const results: Record<SyncSource, { synced: number; errors: number }> = {
    ONET: { synced: 0, errors: 0 },
    ORS: { synced: 0, errors: 0 },
    OEWS: { synced: 0, errors: 0 },
    PROJECTIONS: { synced: 0, errors: 0 },
  };

  // 1. Sync ONET first (others depend on it)
  console.log("[AutoSync] Syncing O*NET data...");
  results.ONET = await syncONET(20, 100);
  console.log(`[AutoSync] O*NET: ${results.ONET.synced} synced, ${results.ONET.errors} errors`);

  // 2. Sync OEWS (wages/employment)
  console.log("[AutoSync] Syncing OEWS wage data...");
  results.OEWS = await syncOEWS();
  console.log(`[AutoSync] OEWS: ${results.OEWS.synced} synced, ${results.OEWS.errors} errors`);

  // 3. Sync ORS (physical demands)
  console.log("[AutoSync] Syncing ORS data...");
  results.ORS = await syncORS();
  console.log(`[AutoSync] ORS: ${results.ORS.synced} synced, ${results.ORS.errors} errors`);

  // 4. Sync Projections (depends on OEWS data)
  console.log("[AutoSync] Syncing projections...");
  results.PROJECTIONS = await syncProjections();
  console.log(`[AutoSync] Projections: ${results.PROJECTIONS.synced} synced, ${results.PROJECTIONS.errors} errors`);

  console.log("[AutoSync] Full sync complete.");
  return results;
}
