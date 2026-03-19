import { NextRequest, NextResponse } from "next/server";
import { getZBPEmployment } from "@/lib/api/census";
import {
  getFrequentlyHiredJobs,
  getFrequentlyHiredJobsForArea,
} from "@/lib/engine/hired-jobs";

/**
 * GET /api/hired-jobs?zip=90210
 *
 * Returns the most frequently hired occupations for a ZIP area.
 *
 * Uses FRED JOLTS industry-level hiring data combined with BLS staffing
 * patterns to estimate which SOC major occupation groups see the most
 * hiring activity. When a ZIP is provided, results are weighted by the
 * local industry mix from Census ZIP Business Patterns (ZBP).
 *
 * Query parameters:
 *   zip   - 5-digit US ZIP code (optional; omit for national data)
 *   topN  - Number of results to return (optional, default: 20, max: 50)
 *
 * Returns: Array of FrequentlyHiredJob objects with:
 *   - socCode: 2-digit SOC major group code
 *   - title: occupation group name
 *   - estimatedHires: estimated monthly hires (actual count)
 *   - primaryIndustry: NAICS code of top contributing industry
 *   - industryMix: breakdown of contributing industries
 */
export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get("zip");
  const topNParam = req.nextUrl.searchParams.get("topN");

  // Validate ZIP if provided
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
