/**
 * Census Bureau API Clients — ZBP and QWI
 *
 * Provides access to:
 * - ZIP Code Business Patterns (ZBP): employment counts by industry at the ZIP level
 * - Quarterly Workforce Indicators (QWI): hire-flow data at the county/MSA level
 *
 * Census API is free and does not require authentication, but an API key
 * (CENSUS_API_KEY env var) is supported for higher rate limits.
 *
 * IMPORTANT: Census ZCTAs (ZIP Code Tabulation Areas) and USPS ZIP codes
 * are not interchangeable. ZCTAs are Census-defined statistical areas that
 * approximate USPS ZIP code delivery areas. Most 5-digit codes overlap,
 * but edge cases exist — especially for P.O. box ZIPs, military ZIPs,
 * and ZIPs that straddle county/state boundaries.
 */

const CENSUS_BASE = "https://api.census.gov/data";

// Rate limiter: Census API has no strict published limit, but be respectful
let lastCensusRequest = 0;
const MIN_CENSUS_INTERVAL_MS = 200;

function getApiKeyParam(): string {
  const key = process.env.CENSUS_API_KEY;
  return key ? `&key=${key}` : "";
}

async function censusFetch(url: string): Promise<string[][]> {
  const now = Date.now();
  const elapsed = now - lastCensusRequest;
  if (elapsed < MIN_CENSUS_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_CENSUS_INTERVAL_MS - elapsed));
  }
  lastCensusRequest = Date.now();

  const fullUrl = `${url}${getApiKeyParam()}`;

  const res = await fetch(fullUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000), // 20s timeout
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Census API error ${res.status}: ${text}`);
  }

  // Census API returns a 2D array: first row is headers, rest is data
  return res.json() as Promise<string[][]>;
}

// ─── Types ─────────────────────────────────────────────────────────────

export interface ZBPResult {
  zip: string;
  naics: string;
  naicsDescription: string;
  employment: number | null;
  establishments: number | null;
  annualPayroll: number | null;
}

export interface QWIResult {
  geography: string;
  geographyType: "county" | "msa";
  naics: string;
  period: string; // "YYYY-Q" format
  hires: number | null;
  hireSteady: number | null; // seasonally adjusted
  separations: number | null;
  employment: number | null;
}

// ─── NAICS descriptions for common 2-digit codes ──────────────────────

const NAICS_NAMES: Record<string, string> = {
  "11": "Agriculture, Forestry, Fishing and Hunting",
  "21": "Mining, Quarrying, and Oil and Gas Extraction",
  "22": "Utilities",
  "23": "Construction",
  "31-33": "Manufacturing",
  "42": "Wholesale Trade",
  "44-45": "Retail Trade",
  "48-49": "Transportation and Warehousing",
  "51": "Information",
  "52": "Finance and Insurance",
  "53": "Real Estate and Rental and Leasing",
  "54": "Professional, Scientific, and Technical Services",
  "55": "Management of Companies and Enterprises",
  "56": "Administrative and Support and Waste Management",
  "61": "Educational Services",
  "62": "Health Care and Social Assistance",
  "71": "Arts, Entertainment, and Recreation",
  "72": "Accommodation and Food Services",
  "81": "Other Services (except Public Administration)",
  "92": "Public Administration",
};

/**
 * Get ZIP Code Business Patterns employment by industry.
 *
 * Census ZBP API endpoint:
 *   https://api.census.gov/data/{year}/zbp?get=EMPSZES,EMP,PAYANN,ESTAB&for=zipcode:{zip}&NAICS2017={naics}
 *
 * Fetches employment data for all 2-digit NAICS sectors within a ZIP code.
 * Uses the most recent available ZBP year (typically 2-3 years behind current).
 *
 * @param zip - 5-digit ZIP code (used as ZCTA proxy)
 * @param year - Data year (default: most recent available, currently 2021)
 * @returns Array of ZBP results by industry sector
 */
export async function getZBPEmployment(
  zip: string,
  year?: number
): Promise<ZBPResult[]> {
  // ZBP latest available year is typically 2-3 years behind
  const dataYear = year ?? 2021;

  // Fetch all 2-digit NAICS sectors for this ZIP
  // Use NAICS2017=** to get all industries, or omit for all
  const url =
    `${CENSUS_BASE}/${dataYear}/zbp?get=NAICS2017,NAICS2017_LABEL,EMP,ESTAB,PAYANN` +
    `&for=zipcode:${zip}`;

  try {
    const rows = await censusFetch(url);

    if (rows.length < 2) return [];

    const headers = rows[0];
    const naicsIdx = headers.indexOf("NAICS2017");
    const labelIdx = headers.indexOf("NAICS2017_LABEL");
    const empIdx = headers.indexOf("EMP");
    const estabIdx = headers.indexOf("ESTAB");
    const payIdx = headers.indexOf("PAYANN");

    const results: ZBPResult[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const naics = row[naicsIdx] ?? "";

      // Only keep 2-digit NAICS sectors (skip total and sub-sectors)
      // 2-digit codes are 2 characters, or ranges like "31-33"
      if (naics.length > 5 || naics === "00") continue;

      const emp = parseInt(row[empIdx], 10);
      const estab = parseInt(row[estabIdx], 10);
      const pay = parseInt(row[payIdx], 10);

      results.push({
        zip,
        naics,
        naicsDescription: row[labelIdx] ?? NAICS_NAMES[naics] ?? naics,
        employment: isNaN(emp) ? null : emp,
        establishments: isNaN(estab) ? null : estab,
        annualPayroll: isNaN(pay) ? null : pay,
      });
    }

    return results;
  } catch (err) {
    console.error(`[Census ZBP] Failed to fetch employment for ZIP ${zip}:`, err);
    return [];
  }
}

/**
 * Get Quarterly Workforce Indicators (QWI) hire-flow data.
 *
 * Census QWI API endpoint:
 *   https://api.census.gov/data/timeseries/qwi/sa?get=HirN,HirNS,Sep,Emp&for=county:{fips}&in=state:{state}
 *
 * Fetches hire counts, separations, and employment for the most recent
 * available quarters. Used to compute hiring momentum scores.
 *
 * @param params.countyFips - 3-digit county FIPS code (within state)
 * @param params.msaCode - Alternative: MSA code for metro-level data
 * @param params.stateFips - 2-digit state FIPS code (required for county queries)
 * @param params.naics - Optional NAICS code to filter by industry
 * @returns Array of QWI results by quarter
 */
export async function getQWIHires(params: {
  countyFips?: string;
  msaCode?: string;
  stateFips: string;
  naics?: string;
}): Promise<QWIResult[]> {
  const { countyFips, msaCode, stateFips, naics } = params;

  // Build the geography portion of the URL
  let geoClause: string;
  let geoType: "county" | "msa";

  if (countyFips) {
    // County-level query: county FIPS is the 3-digit portion, state is separate
    geoClause = `&for=county:${countyFips}&in=state:${stateFips}`;
    geoType = "county";
  } else if (msaCode) {
    // MSA-level query
    geoClause = `&for=metropolitan%20statistical%20area/micropolitan%20statistical%20area:${msaCode}`;
    geoType = "msa";
  } else {
    // State-level fallback
    geoClause = `&for=state:${stateFips}`;
    geoType = "county"; // label as county since it's state-level fallback
  }

  // Industry filter
  const industryClause = naics ? `&industry=${naics}` : "";

  // Get last 4 quarters of data for momentum calculation
  const url =
    `${CENSUS_BASE}/timeseries/qwi/sa?get=HirN,HirNS,Sep,Emp` +
    `${geoClause}${industryClause}` +
    `&year=2022,2023&quarter=1,2,3,4`;

  try {
    const rows = await censusFetch(url);

    if (rows.length < 2) return [];

    const headers = rows[0];
    const hirNIdx = headers.indexOf("HirN");
    const hirNSIdx = headers.indexOf("HirNS");
    const sepIdx = headers.indexOf("Sep");
    const empIdx = headers.indexOf("Emp");
    const yearIdx = headers.indexOf("year");
    const qtrIdx = headers.indexOf("quarter");

    const results: QWIResult[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const year = row[yearIdx];
      const quarter = row[qtrIdx];

      const hirN = parseInt(row[hirNIdx], 10);
      const hirNS = parseInt(row[hirNSIdx], 10);
      const sep = parseInt(row[sepIdx], 10);
      const emp = parseInt(row[empIdx], 10);

      results.push({
        geography: countyFips ?? msaCode ?? stateFips,
        geographyType: geoType,
        naics: naics ?? "00",
        period: `${year}-Q${quarter}`,
        hires: isNaN(hirN) ? null : hirN,
        hireSteady: isNaN(hirNS) ? null : hirNS,
        separations: isNaN(sep) ? null : sep,
        employment: isNaN(emp) ? null : emp,
      });
    }

    // Sort by period descending (most recent first)
    results.sort((a, b) => b.period.localeCompare(a.period));

    return results;
  } catch (err) {
    console.error("[Census QWI] Failed to fetch hire data:", err);
    return [];
  }
}
