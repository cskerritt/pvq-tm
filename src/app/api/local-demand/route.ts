import { NextRequest, NextResponse } from "next/server";
import { fetchJoltsIndustryHires } from "@/lib/api/fred";
import { getZBPEmployment, getQWIHires } from "@/lib/api/census";
import { estimateZipOccupationEmployment } from "@/lib/engine/staffing-patterns";
import { getFrequentlyHiredJobsForArea } from "@/lib/engine/hired-jobs";
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
 * Orchestrates FRED JOLTS, Census ZBP, Census QWI, and the local
 * demand engine to produce a composite Local Demand score for a
 * target occupation in a ZIP market.
 *
 * Data sources (replacing CareerOneStop):
 *   - FRED JOLTS: national industry-level hiring data (posting-like signal)
 *   - Census ZBP: ZIP-level industry employment (structural base)
 *   - Census QWI: county/MSA hire-flow data (hiring momentum)
 *   - BLS Staffing Patterns: distribute industry data to occupations
 *
 * Query parameters:
 *   zip       - 5-digit US ZIP code (required)
 *   onetCode  - O*NET SOC code like "47-2061.00" (required)
 *   radius    - Search radius in miles (optional, auto-detected)
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
    // ─── Step 1: Resolve geography from ZIP ────────────────────────
    // We no longer depend on CareerOneStop for location validation.
    // Use a simple approach: extract state FIPS from ZIP prefix range,
    // and rely on Census ZBP data (which uses ZCTAs) as the primary
    // geographic anchor.
    const stateFips = getStateFipsFromZip(zip);
    const isMetro = true; // default assumption; ZBP data covers the ZIP regardless
    const geoName = `ZIP ${zip}`;

    const radius = radiusParam ? parseInt(radiusParam, 10) : getDefaultRadius(isMetro);

    // ─── Step 2: Fetch data in parallel ───────────────────────────
    const [zbpResult, qwiResult, joltsResult] = await Promise.all([
      // ZIP Business Patterns from Census
      getZBPEmployment(zip).catch(() => []),

      // QWI hire-flow from Census (need state FIPS)
      stateFips
        ? getQWIHires({ stateFips }).catch(() => [])
        : Promise.resolve([]),

      // FRED JOLTS industry-level hires (national)
      fetchJoltsIndustryHires().catch(() => []),
    ]);

    // ─── Step 3: Transform to engine inputs ───────────────────────

    // Posting-like signal from JOLTS + staffing patterns
    // Instead of CareerOneStop job postings, we use JOLTS national hires
    // distributed to SOC groups via staffing patterns, then weighted by
    // local industry mix from ZBP.
    let postingData: PostingData | null = null;
    if (joltsResult.length > 0 && zbpResult.length > 0) {
      // Get local industry employment for weighting
      const areaEmployment = zbpResult
        .filter((z) => z.employment !== null && z.employment > 0)
        .map((z) => ({ naicsCode: z.naics, employment: z.employment! }));

      // Get frequently hired jobs for this area
      const hiredJobs = await getFrequentlyHiredJobsForArea(
        areaEmployment,
        20
      );

      // Find the target occupation's SOC major group in the hired jobs list
      const targetSocMajor = onetCode.substring(0, 2);
      const targetHiredJob = hiredJobs.find((j) => j.socCode === targetSocMajor);

      // Use the estimated hires as a posting-like count
      // Scale down to approximate a "90-day posting count" from monthly JOLTS hires
      // JOLTS monthly hires / 4 ~= quarterly, but for a single ZIP market we
      // scale proportionally to the ZIP's share of national employment
      const nationalTotalHires = joltsResult.reduce(
        (s, j) => s + (j.hires ?? 0),
        0
      );
      const localTotalEmployment = zbpResult.reduce(
        (s, z) => s + (z.employment ?? 0),
        0
      );

      // Rough local share of national activity (national employment ~150M)
      const NATIONAL_EMPLOYMENT_APPROX = 150_000_000;
      const localShare =
        NATIONAL_EMPLOYMENT_APPROX > 0
          ? localTotalEmployment / NATIONAL_EMPLOYMENT_APPROX
          : 0;

      const estimatedLocalHires = targetHiredJob
        ? Math.round(targetHiredJob.estimatedHires * localShare * 3) // 3 months
        : 0;

      postingData = {
        totalCount: estimatedLocalHires,
        dedupedCount: estimatedLocalHires, // no dedup needed for estimates
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
      const validQuarters = qwiResult.filter(
        (q) => q.hires !== null && q.employment !== null && q.employment > 0
      );

      if (validQuarters.length > 0) {
        const totalHires = validQuarters.reduce(
          (sum, q) => sum + (q.hires ?? 0),
          0
        );
        const avgHires = totalHires / validQuarters.length;
        const avgEmployment =
          validQuarters.reduce((sum, q) => sum + (q.employment ?? 0), 0) /
          validQuarters.length;
        const hireRate =
          avgEmployment > 0 ? avgHires / avgEmployment : null;

        hiringData = {
          totalHires,
          avgQuarterlyHires: Math.round(avgHires),
          avgQuarterlyEmployment: Math.round(avgEmployment),
          hireRate:
            hireRate !== null
              ? Math.round(hireRate * 10000) / 10000
              : null,
          geography: "state",
          geographyName: geoName,
        };
      }
    }

    // No local wage from CareerOneStop anymore; omit or add BLS OEWS later
    const localWage = null;

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

// ─── ZIP to State FIPS Lookup ──────────────────────────────────────────
//
// Simple mapping from ZIP code prefix ranges to 2-digit state FIPS codes.
// This replaces CareerOneStop's location validation for determining state.

function getStateFipsFromZip(zip: string): string | undefined {
  const z = parseInt(zip.substring(0, 3), 10);

  // Major ZIP prefix ranges → state FIPS codes
  // Source: USPS ZIP code prefix assignments
  if (z >= 10 && z <= 27) return "25"; // MA
  if (z >= 28 && z <= 29) return "44"; // RI
  if (z >= 30 && z <= 38) return "36"; // NH (30-38 overlap, simplified)
  if (z >= 39 && z <= 49) return "25"; // MA (some overlap)
  if (z >= 50 && z <= 59) return "50"; // VT
  if (z >= 60 && z <= 69) return "09"; // CT
  if (z >= 70 && z <= 89) return "34"; // NJ
  if (z >= 90 && z <= 99) return "36"; // NY (military/gov)
  if (z >= 100 && z <= 149) return "36"; // NY
  if (z >= 150 && z <= 196) return "42"; // PA
  if (z >= 197 && z <= 199) return "10"; // DE
  if (z >= 200 && z <= 205) return "11"; // DC
  if (z >= 206 && z <= 219) return "24"; // MD
  if (z >= 220 && z <= 246) return "51"; // VA
  if (z >= 247 && z <= 268) return "54"; // WV
  if (z >= 270 && z <= 289) return "37"; // NC
  if (z >= 290 && z <= 299) return "45"; // SC
  if (z >= 300 && z <= 319) return "13"; // GA
  if (z >= 320 && z <= 349) return "12"; // FL
  if (z >= 350 && z <= 369) return "01"; // AL
  if (z >= 370 && z <= 385) return "47"; // TN
  if (z >= 386 && z <= 397) return "28"; // MS
  if (z >= 400 && z <= 427) return "21"; // KY
  if (z >= 430 && z <= 459) return "39"; // OH
  if (z >= 460 && z <= 479) return "18"; // IN
  if (z >= 480 && z <= 499) return "26"; // MI
  if (z >= 500 && z <= 528) return "19"; // IA
  if (z >= 530 && z <= 549) return "55"; // WI
  if (z >= 550 && z <= 567) return "27"; // MN
  if (z >= 570 && z <= 577) return "46"; // SD
  if (z >= 580 && z <= 588) return "38"; // ND
  if (z >= 590 && z <= 599) return "30"; // MT
  if (z >= 600 && z <= 629) return "17"; // IL
  if (z >= 630 && z <= 658) return "29"; // MO
  if (z >= 660 && z <= 679) return "20"; // KS
  if (z >= 680 && z <= 693) return "31"; // NE
  if (z >= 700 && z <= 714) return "22"; // LA
  if (z >= 716 && z <= 729) return "05"; // AR
  if (z >= 730 && z <= 749) return "40"; // OK
  if (z >= 750 && z <= 799) return "48"; // TX
  if (z >= 800 && z <= 816) return "08"; // CO
  if (z >= 820 && z <= 831) return "56"; // WY
  if (z >= 832 && z <= 838) return "16"; // ID
  if (z >= 840 && z <= 847) return "49"; // UT
  if (z >= 850 && z <= 865) return "04"; // AZ
  if (z >= 870 && z <= 884) return "35"; // NM
  if (z >= 889 && z <= 898) return "32"; // NV
  if (z >= 900 && z <= 966) return "06"; // CA
  if (z >= 967 && z <= 968) return "15"; // HI
  if (z >= 970 && z <= 979) return "41"; // OR
  if (z >= 980 && z <= 994) return "53"; // WA
  if (z >= 995 && z <= 999) return "02"; // AK

  return undefined;
}
