import { NextRequest, NextResponse } from "next/server";
import { getZBPEmployment } from "@/lib/api/census";
import {
  getFrequentlyHiredJobs,
  getFrequentlyHiredJobsForArea,
} from "@/lib/engine/hired-jobs";
import { analyzeHiredJobs } from "@/lib/engine/hired-jobs-analysis";
import { TRAIT_KEYS } from "@/lib/engine/traits";

/**
 * GET /api/hired-jobs
 *
 * Supports two modes:
 *
 * 1. ZIP-based (legacy): ?zip=90210
 *    Returns most frequently hired SOC major groups for a ZIP area.
 *    Uses FRED JOLTS + BLS staffing patterns + Census ZBP.
 *
 * 2. County/MSA analysis: ?countyFips=06037&preProfile=...&postProfile=...
 *    Or: ?msaCode=31080&preProfile=...&postProfile=...
 *    Returns full HiredJobAnalysis with pre/post injury trait comparison
 *    using Census QWI hire data.
 *
 * Profile format: JSON-encoded object with trait keys mapping to 0-4 values.
 *   Example: {"reasoning":3,"math":3,"strength":2,...}
 *
 * Query parameters:
 *   zip        - 5-digit US ZIP code (mode 1)
 *   countyFips - 5-digit county FIPS code (mode 2, e.g., "06037")
 *   msaCode    - MSA/CBSA code (mode 2, e.g., "31080")
 *   preProfile - JSON string of pre-injury 24-trait profile (mode 2)
 *   postProfile - JSON string of post-injury 24-trait profile (mode 2)
 *   topN       - Number of results (mode 1 only, default: 20, max: 50)
 */
export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get("zip");
  const countyFips = req.nextUrl.searchParams.get("countyFips");
  const msaCode = req.nextUrl.searchParams.get("msaCode");
  const preProfileStr = req.nextUrl.searchParams.get("preProfile");
  const postProfileStr = req.nextUrl.searchParams.get("postProfile");
  const topNParam = req.nextUrl.searchParams.get("topN");

  // ─── Mode 2: County/MSA analysis with trait profiles ────────────────
  if (countyFips || msaCode) {
    // Validate geography
    if (countyFips && !/^\d{5}$/.test(countyFips)) {
      return NextResponse.json(
        { error: "countyFips must be a 5-digit FIPS code (e.g., 06037)" },
        { status: 400 }
      );
    }
    if (msaCode && !/^\d{4,5}$/.test(msaCode)) {
      return NextResponse.json(
        { error: "msaCode must be a 4-5 digit CBSA code (e.g., 31080)" },
        { status: 400 }
      );
    }

    // Parse trait profiles
    let preProfile: Record<string, number>;
    let postProfile: Record<string, number>;

    try {
      preProfile = preProfileStr
        ? JSON.parse(preProfileStr)
        : buildDefaultProfile();
      postProfile = postProfileStr
        ? JSON.parse(postProfileStr)
        : buildDefaultProfile();
    } catch {
      return NextResponse.json(
        { error: "preProfile and postProfile must be valid JSON objects" },
        { status: 400 }
      );
    }

    // Validate profiles have numeric values
    for (const key of TRAIT_KEYS) {
      if (preProfile[key] !== undefined && typeof preProfile[key] !== "number") {
        return NextResponse.json(
          { error: `preProfile.${key} must be a number (0-4)` },
          { status: 400 }
        );
      }
      if (postProfile[key] !== undefined && typeof postProfile[key] !== "number") {
        return NextResponse.json(
          { error: `postProfile.${key} must be a number (0-4)` },
          { status: 400 }
        );
      }
    }

    try {
      const analysis = await analyzeHiredJobs(
        countyFips,
        msaCode,
        preProfile,
        postProfile
      );

      return NextResponse.json(analysis);
    } catch (err) {
      console.error("[hired-jobs] Analysis error:", err);
      return NextResponse.json(
        {
          error: "Failed to analyze hired jobs",
          message: err instanceof Error ? err.message : String(err),
        },
        { status: 500 }
      );
    }
  }

  // ─── Mode 1: ZIP-based frequently hired jobs (legacy) ───────────────

  if (zip && !/^\d{5}$/.test(zip)) {
    return NextResponse.json(
      { error: "Valid 5-digit zip code required (e.g., ?zip=90210)" },
      { status: 400 }
    );
  }

  const topN = Math.min(
    Math.max(parseInt(topNParam ?? "20", 10) || 20, 1),
    50
  );

  try {
    let jobs;

    if (zip) {
      // Get local industry employment from Census ZBP
      const zbpResult = await getZBPEmployment(zip).catch(() => []);

      const areaEmployment = zbpResult
        .filter((z) => z.employment !== null && z.employment > 0)
        .map((z) => ({ naicsCode: z.naics, employment: z.employment! }));

      if (areaEmployment.length > 0) {
        jobs = await getFrequentlyHiredJobsForArea(areaEmployment, topN);
      } else {
        // No local ZBP data -- fall back to national
        jobs = await getFrequentlyHiredJobs(topN);
      }
    } else {
      // No ZIP -- return national data
      jobs = await getFrequentlyHiredJobs(topN);
    }

    return NextResponse.json({
      zip: zip ?? null,
      scope: zip ? "local" : "national",
      count: jobs.length,
      jobs,
    });
  } catch (err) {
    console.error("[hired-jobs] Unexpected error:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch frequently hired jobs",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

/**
 * Build a default "healthy worker" profile with mid-range capacities.
 * All traits set to 3 (frequently/heavy/high) to represent an
 * uninjured worker with broad capacity.
 */
function buildDefaultProfile(): Record<string, number> {
  const profile: Record<string, number> = {};
  for (const key of TRAIT_KEYS) {
    profile[key] = 3;
  }
  return profile;
}
