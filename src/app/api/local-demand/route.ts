import { NextRequest, NextResponse } from "next/server";
import {
  searchJobsByZip,
  validateLocation,
  getLocalWages,
} from "@/lib/api/career-one-stop";
import { getZBPEmployment, getQWIHires } from "@/lib/api/census";
import { estimateZipOccupationEmployment } from "@/lib/engine/staffing-patterns";
import {
  computeLocalDemand,
  getDefaultRadius,
  type PostingData,
  type StructuralData,
  type HiringData,
} from "@/lib/engine/local-demand";

/**
 * GET /api/local-demand?zip=90210&onetCode=47-2061.00
 *
 * Orchestrates CareerOneStop, Census ZBP, Census QWI, and the local
 * demand engine to produce a composite Local Demand score for a
 * target occupation in a ZIP market.
 *
 * Query parameters:
 *   zip       — 5-digit US ZIP code (required)
 *   onetCode  — O*NET SOC code like "47-2061.00" (required)
 *   radius    — Search radius in miles (optional, auto-detected)
 *
 * Returns: LocalDemandResult JSON
 */
export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get("zip");
  const onetCode = req.nextUrl.searchParams.get("onetCode");
  const radiusParam = req.nextUrl.searchParams.get("radius");

  // ─── Validate inputs ──────────────────────────────────────────────
  if (!zip || !/^\d{5}$/.test(zip)) {
    return NextResponse.json(
      { error: "Valid 5-digit zip code required (e.g., ?zip=90210)" },
      { status: 400 }
    );
  }

  if (!onetCode || !/^\d{2}-\d{4}(\.\d{2})?$/.test(onetCode)) {
    return NextResponse.json(
      {
        error:
          'Valid O*NET SOC code required (e.g., ?onetCode=47-2061.00)',
      },
      { status: 400 }
    );
  }

  try {
    // ─── Step 1: Resolve geography ────────────────────────────────
    // Try CareerOneStop location validation first; fall back to defaults
    let countyFips: string | undefined;
    let msaCode: string | undefined;
    let stateFips: string | undefined;
    let isMetro = true; // default assumption
    let geoName = zip;

    let locationResult;
    try {
      locationResult = await validateLocation(zip);
    } catch {
      // CareerOneStop may not be configured — continue without it
      locationResult = null;
    }

    if (locationResult) {
      countyFips = locationResult.countyFips;
      msaCode = locationResult.msaCode;
      // County FIPS from COS is typically the full 5-digit code; extract state + county
      if (countyFips && countyFips.length >= 5) {
        stateFips = countyFips.substring(0, 2);
        countyFips = countyFips.substring(2); // 3-digit county portion
      }
      isMetro = locationResult.isMetro;
      geoName = locationResult.msaName ?? locationResult.countyName ?? locationResult.city ?? zip;
    }

    const radius = radiusParam ? parseInt(radiusParam, 10) : getDefaultRadius(isMetro);

    // ─── Step 2: Fetch data in parallel ───────────────────────────
    // Run all API calls concurrently for performance.
    // Each call handles its own errors and returns null on failure.
    const [jobSearchResult, zbpResult, qwiResult, wageResult] =
      await Promise.all([
        // Posting data from CareerOneStop
        searchJobsByZip({
          onetCode,
          zip,
          radius,
          days: 90,
          maxResults: 500,
        }).catch(() => null),

        // ZIP Business Patterns from Census
        getZBPEmployment(zip).catch(() => []),

        // QWI hire-flow from Census (need state FIPS)
        stateFips
          ? getQWIHires({
              countyFips,
              msaCode,
              stateFips,
            }).catch(() => [])
          : Promise.resolve([]),

        // Local wages from CareerOneStop
        getLocalWages(onetCode, zip).catch(() => null),
      ]);

    // ─── Step 3: Transform to engine inputs ───────────────────────

    // Posting data
    let postingData: PostingData | null = null;
    if (jobSearchResult) {
      // Deduplicate by title + company (rough dedup for same job posted multiple times)
      const seen = new Set<string>();
      let dedupedCount = 0;
      for (const job of jobSearchResult.jobs) {
        const key = `${job.title.toLowerCase().trim()}|${job.company.toLowerCase().trim()}`;
        if (!seen.has(key)) {
          seen.add(key);
          dedupedCount++;
        }
      }

      postingData = {
        totalCount: jobSearchResult.totalJobs,
        dedupedCount,
        radiusMiles: radius,
        windowDays: 90,
      };
    }

    // Structural data from ZBP + staffing patterns
    let structuralData: StructuralData | null = null;
    if (zbpResult.length > 0) {
      const { estimate, topIndustries } = estimateZipOccupationEmployment(
        zbpResult,
        onetCode
      );
      structuralData = {
        estimatedEmployment: estimate,
        topIndustries,
      };
    }

    // Hiring momentum from QWI
    let hiringData: HiringData | null = null;
    if (qwiResult.length > 0) {
      // Compute average quarterly hires and employment from available quarters
      const validQuarters = qwiResult.filter(
        (q) => q.hires !== null && q.employment !== null && q.employment > 0
      );

      if (validQuarters.length > 0) {
        const totalHires = validQuarters.reduce((sum, q) => sum + (q.hires ?? 0), 0);
        const avgHires = totalHires / validQuarters.length;
        const avgEmployment =
          validQuarters.reduce((sum, q) => sum + (q.employment ?? 0), 0) /
          validQuarters.length;
        const hireRate = avgEmployment > 0 ? avgHires / avgEmployment : null;

        hiringData = {
          totalHires,
          avgQuarterlyHires: Math.round(avgHires),
          avgQuarterlyEmployment: Math.round(avgEmployment),
          hireRate: hireRate !== null ? Math.round(hireRate * 10000) / 10000 : null,
          geography: countyFips ? "county" : msaCode ? "msa" : "state",
          geographyName: geoName,
        };
      }
    }

    // Local wage check
    const localWage = wageResult
      ? { medianWage: wageResult.medianWage, source: "CareerOneStop" }
      : null;

    // ─── Step 4: Compute Local Demand score ───────────────────────
    const result = computeLocalDemand(
      postingData,
      structuralData,
      hiringData,
      zip,
      radius,
      localWage
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("[local-demand] Unexpected error:", err);
    return NextResponse.json(
      {
        error: "Failed to compute local demand",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
