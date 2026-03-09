/**
 * Data Sync Service
 *
 * Orchestrates loading occupational data from O*NET, BLS (OEWS/ORS),
 * and employment projections into the local database cache.
 * Tracks versions and sync status via DataSyncLog.
 */

import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";
import { browseAllOccupations, getFullOccupation } from "./onet";
import { fetchBLSSeries, buildOEWSSeriesId, fetchORSData } from "./bls";

function toJson(val: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(val ?? []));
}

export type SyncSource = "ONET" | "ORS" | "OEWS" | "PROJECTIONS";

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
  const sources: SyncSource[] = ["ONET", "ORS", "OEWS", "PROJECTIONS"];
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
 * Sync O*NET occupation data using the browse API.
 * Fetches ALL occupations (~1,016+) and stores full details in the local cache.
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
    // Step 1: Browse all O*NET occupations (paginated, ~11 API calls)
    console.log("[syncONET] Browsing all O*NET occupations...");
    const allOccs = await browseAllOccupations();
    console.log(`[syncONET] Found ${allOccs.length} occupations`);

    // Step 2: For each occupation, fetch full details and upsert
    for (let i = 0; i < allOccs.length; i++) {
      const occ = allOccs[i];

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
            jobZone: full.jobZone ?? occ.jobZone ?? null,
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
            jobZone: full.jobZone ?? occ.jobZone ?? null,
          },
        });

        synced++;
      } catch (e) {
        errors++;
        console.error(`[syncONET] Failed to sync ${occ.code}:`, e);
      }

      // Rate limiting: 200ms between occupations
      await new Promise((r) => setTimeout(r, 200));

      // Progress logging every 100 occupations
      if ((i + 1) % 100 === 0 || i === allOccs.length - 1) {
        console.log(
          `[syncONET] Progress: ${i + 1}/${allOccs.length} — ${synced} synced, ${errors} errors`
        );
      }
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
 * Maximum number of BLS API calls per OEWS sync run.
 * Each call covers 7 occupations (49 series < 50 max per request).
 * At 100 calls/run → 700 occupations per day.
 * Full coverage of ~1,020 occupations in ~2 daily runs.
 * BLS allows 500 queries/day, so 100 leaves headroom for ORS and retries.
 */
const MAX_BLS_CALLS_PER_OEWS_SYNC = 100;

/**
 * Sync OEWS (wage & employment) data from BLS for cached O*NET occupations.
 *
 * Uses an incremental strategy to stay within BLS daily API limits:
 * 1. Prioritises occupations with NO wage data at all (new occupations)
 * 2. Then refreshes occupations with the OLDEST data
 * 3. Processes at most MAX_BLS_CALLS_PER_OEWS_SYNC batches per run (~700 occupations)
 * 4. Detects daily BLS limit and stops early
 *
 * Over 2 daily runs, all ~1,020 occupations get coverage.
 * Monthly refresh cycle keeps everything current.
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

    // Get existing wage data with timestamps so we can prioritise
    const existingWages = await prisma.occupationWages.findMany({
      select: { onetSocCode: true, year: true, createdAt: true },
      orderBy: { createdAt: "asc" }, // oldest first
    });

    // Build a map: onetSocCode → { year, createdAt }
    const wageDataMap = new Map<string, { year: number; createdAt: Date }>();
    for (const w of existingWages) {
      // Keep the most recent record per occupation
      const existing = wageDataMap.get(w.onetSocCode);
      if (!existing || w.year > existing.year) {
        wageDataMap.set(w.onetSocCode, { year: w.year, createdAt: w.createdAt });
      }
    }

    // Split occupations into two groups: no data, and has data (sorted oldest first)
    const noData: typeof occupations = [];
    const hasData: { occ: (typeof occupations)[0]; createdAt: Date }[] = [];

    for (const occ of occupations) {
      const existing = wageDataMap.get(occ.id);
      if (!existing) {
        noData.push(occ);
      } else {
        hasData.push({ occ, createdAt: existing.createdAt });
      }
    }

    // Sort hasData by oldest createdAt first (prioritise stale data for refresh)
    hasData.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // Combine: no-data occupations first, then oldest-data occupations
    const prioritised = [
      ...noData,
      ...hasData.map((h) => h.occ),
    ];

    // Cap how many we process this run
    const maxOccupations = MAX_BLS_CALLS_PER_OEWS_SYNC * 7; // 7 occupations per BLS call
    const toProcess = prioritised.slice(0, maxOccupations);

    console.log(
      `[syncOEWS] Total: ${occupations.length} occupations. ` +
      `${noData.length} missing data, ${hasData.length} have data. ` +
      `Processing ${toProcess.length} this run (max ${maxOccupations}).`
    );

    if (toProcess.length === 0) {
      await prisma.dataSyncLog.update({
        where: { id: log.id },
        data: { status: "completed", recordsUpdated: 0, completedAt: new Date() },
      });
      return { synced: 0, errors: 0 };
    }

    // Data type codes we fetch for each occupation
    const dataTypes = ["01", "04", "11", "12", "13", "14", "15"] as const;

    // Batch occupations: 7 per BLS API call (7 × 7 = 49 series < 50 max)
    const batchSize = 7;
    let dailyLimitHit = false;
    let apiCallsMade = 0;

    for (let i = 0; i < toProcess.length; i += batchSize) {
      if (dailyLimitHit) break;
      if (apiCallsMade >= MAX_BLS_CALLS_PER_OEWS_SYNC) {
        console.log(
          `[syncOEWS] Reached daily budget of ${MAX_BLS_CALLS_PER_OEWS_SYNC} API calls. ` +
          `Remaining occupations will be synced in the next run.`
        );
        break;
      }

      const batch = toProcess.slice(i, i + batchSize);

      try {
        // Build all series IDs for this batch
        const seriesIds: string[] = [];
        const seriesOccMap: Record<string, { onetId: string; dataType: string }> = {};

        for (const occ of batch) {
          const socCode = occ.id.replace(/\.\d+$/, "");
          for (const dt of dataTypes) {
            const sid = buildOEWSSeriesId(socCode, dt);
            seriesIds.push(sid);
            seriesOccMap[sid] = { onetId: occ.id, dataType: dt };
          }
        }

        // Single BLS API call for the whole batch
        const response = await fetchBLSSeries(seriesIds);
        apiCallsMade++;

        if (response.status !== "REQUEST_SUCCEEDED" || !response.Results?.series?.length) {
          errors += batch.length;
          continue;
        }

        // Parse response and group by occupation
        const occData: Record<string, Record<string, number | null>> = {};

        for (const series of response.Results.series) {
          const mapping = seriesOccMap[series.seriesID];
          if (!mapping) continue;

          if (!occData[mapping.onetId]) occData[mapping.onetId] = {};

          const latestValue = series.data?.[0]?.value;
          const val = latestValue ? parseFloat(latestValue) : null;
          occData[mapping.onetId][mapping.dataType] = isNaN(val!) ? null : val;

          // Capture year from employment series
          if (mapping.dataType === "01" && series.data?.[0]?.year) {
            occData[mapping.onetId]["_year"] = parseInt(series.data[0].year);
          }
        }

        // Upsert each occupation's wage data
        for (const occ of batch) {
          const data = occData[occ.id];
          if (!data) continue;

          const year = (data["_year"] as number) || new Date().getFullYear();
          const employment = data["01"] !== null && data["01"] !== undefined ? Math.round(data["01"]) : null;

          try {
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
                meanWage: data["04"] ?? null,
                medianWage: data["13"] ?? null,
                pct10: data["11"] ?? null,
                pct25: data["12"] ?? null,
                pct75: data["14"] ?? null,
                pct90: data["15"] ?? null,
                year,
              },
              update: {
                areaName: "National",
                employment,
                meanWage: data["04"] ?? null,
                medianWage: data["13"] ?? null,
                pct10: data["11"] ?? null,
                pct25: data["12"] ?? null,
                pct75: data["14"] ?? null,
                pct90: data["15"] ?? null,
              },
            });
            synced++;
          } catch (e) {
            errors++;
            console.error(`[syncOEWS] Failed to upsert ${occ.id}:`, e);
          }
        }
      } catch (e) {
        const errMsg = String(e);
        if (errMsg.includes("daily") || errMsg.includes("threshold")) {
          console.log("[syncOEWS] BLS daily limit reached, stopping early. Will resume tomorrow.");
          dailyLimitHit = true;
        } else {
          errors += batch.length;
          console.error(`[syncOEWS] Batch failed:`, e);
        }
      }

      // BLS rate limit: conservative 1.5s between batches to avoid 429 errors
      await new Promise((r) => setTimeout(r, 1500));

      // Progress logging every 10 API calls (~70 occupations)
      if (apiCallsMade % 10 === 0 || i + batchSize >= toProcess.length) {
        console.log(
          `[syncOEWS] Progress: ${apiCallsMade}/${MAX_BLS_CALLS_PER_OEWS_SYNC} API calls, ` +
          `${synced} synced, ${errors} errors`
        );
      }
    }

    const remaining = prioritised.length - Math.min(toProcess.length, apiCallsMade * batchSize);
    if (remaining > 0) {
      console.log(
        `[syncOEWS] ${remaining} occupations remaining — will be synced in next daily run.`
      );
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
 * We fetch comprehensive physical, environmental, cognitive, and education demands
 * and store them for each cached occupation as a baseline.
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
    // Fetch aggregate ORS data (BLS API calls for all demand categories)
    console.log("[syncORS] Fetching comprehensive ORS data from BLS...");
    const orsData = await fetchORSData("all");

    if (Object.keys(orsData).length === 0) {
      console.log("[syncORS] No ORS data returned from BLS.");
      await prisma.dataSyncLog.update({
        where: { id: log.id },
        data: { status: "completed", recordsUpdated: 0, completedAt: new Date() },
      });
      return { synced: 0, errors: 0 };
    }

    console.log(`[syncORS] Received ${Object.keys(orsData).length} ORS data points`);

    // Separate data into physical, environmental, cognitive, and education categories
    const physicalDemands: Record<string, string | null> = {};
    const envConditions: Record<string, string | null> = {};
    const cogMental: Record<string, string | null> = {};
    const eduTrainExp: Record<string, string | null> = {};

    for (const [key, value] of Object.entries(orsData)) {
      if (key.startsWith("physical_")) physicalDemands[key.replace("physical_", "")] = value;
      else if (key.startsWith("env_")) envConditions[key.replace("env_", "")] = value;
      else if (key.startsWith("cog_")) cogMental[key.replace("cog_", "")] = value;
      else if (key.startsWith("edu_")) eduTrainExp[key.replace("edu_", "")] = value;
    }

    // Store ORS data for all cached occupations
    const occupations = await prisma.occupationONET.findMany({
      select: { id: true, title: true },
    });

    console.log(`[syncORS] Storing ORS data for ${occupations.length} occupations...`);

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
            eduTrainExp: toJson(eduTrainExp),
          },
          update: {
            title: occ.title,
            physicalDemands: toJson(physicalDemands),
            envConditions: toJson(envConditions),
            cogMental: toJson(cogMental),
            eduTrainExp: toJson(eduTrainExp),
          },
        });
        synced++;
      } catch (e) {
        errors++;
        console.error(`[syncORS] Failed to store ORS for ${occ.id}:`, e);
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
 * Run all syncs in order: ONET -> OEWS -> ORS -> PROJECTIONS.
 * OEWS/ORS/PROJECTIONS depend on ONET data being present.
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
  };

  try {
    // 1. Sync ONET first (others depend on it)
    console.log("[syncAll] Syncing O*NET data...");
    results.ONET = await syncONET();
    console.log(`[syncAll] O*NET: ${results.ONET.synced} synced, ${results.ONET.errors} errors`);

    // 2. Sync OEWS (wages/employment) — batched for efficiency
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

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`[syncAll] Full sync complete in ${elapsed} minutes.`);
  } finally {
    isSyncing = false;
  }

  return results;
}
