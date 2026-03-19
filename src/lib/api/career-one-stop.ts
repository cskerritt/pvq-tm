/**
 * CareerOneStop Jobs API Client
 *
 * @deprecated This module is deprecated in favor of FRED JOLTS, Census ZBP,
 * and Census QWI data sources. The local-demand route no longer uses
 * CareerOneStop. Kept for reference only; do not add new callers.
 *
 * Provides access to CareerOneStop's job search, location validation,
 * and occupation wage endpoints. Previously used by the Local Demand
 * engine to fetch deduplicated 90-day posting counts for a ZIP market.
 *
 * Auth: Bearer token via CAREER_ONE_STOP_API_KEY env var.
 * Docs: https://api.careeronestop.org/
 */

const COS_BASE = "https://api.careeronestop.org";

// Simple in-memory rate limiter: minimum ms between requests
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 250; // max ~4 req/s

function getUserId(): string {
  const id = process.env.CAREER_ONE_STOP_USER_ID;
  if (!id) throw new Error("CAREER_ONE_STOP_USER_ID not set");
  return id;
}

function getApiKey(): string {
  const key = process.env.CAREER_ONE_STOP_API_KEY;
  if (!key) throw new Error("CAREER_ONE_STOP_API_KEY not set");
  return key;
}

async function rateLimitedFetch(url: string, options: RequestInit): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url, options);
}

async function cosFetch<T>(path: string): Promise<T> {
  const url = `${COS_BASE}${path}`;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await rateLimitedFetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000), // 15s timeout
    });

    if (res.status === 429) {
      const delay = Math.pow(2, attempt + 1) * 1000;
      console.log(
        `[CareerOneStop] Rate limited (429), retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})`
      );
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`CareerOneStop API error ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  throw new Error("CareerOneStop API rate limit exceeded after retries");
}

// ─── Types ─────────────────────────────────────────────────────────────

export interface JobSearchResult {
  totalJobs: number;
  jobs: Array<{
    title: string;
    company: string;
    onetCode?: string;
    location: string;
    datePosted?: string;
    url?: string;
  }>;
}

export interface LocationResult {
  zip: string;
  city: string;
  state: string;
  stateCode: string;
  countyFips?: string;
  countyName?: string;
  msaCode?: string;
  msaName?: string;
  isMetro: boolean;
}

export interface LocalWageResult {
  onetCode: string;
  location: string;
  medianWage: number | null;
  meanWage: number | null;
  pct10: number | null;
  pct25: number | null;
  pct75: number | null;
  pct90: number | null;
}

// ─── Raw API response shapes ───────────────────────────────────────────

interface CosJobSearchResponse {
  Jobs?: Array<{
    JvId?: string;
    JobTitle?: string;
    Company?: string;
    OnetCode?: string;
    Location?: string;
    DatePosted?: string;
    URL?: string;
  }>;
  RecordCount?: number;
}

interface CosLocationResponse {
  ZipList?: Array<{
    Zip?: string;
    CityName?: string;
    StateName?: string;
    StateCode?: string;
    CountyFips?: string;
    CountyName?: string;
    MsaCode?: string;
    MsaName?: string;
    MetroStatus?: string;
  }>;
}

interface CosWageResponse {
  OccupationDetail?: Array<{
    OnetCode?: string;
    OnetTitle?: string;
    Wages?: {
      NationalWagesList?: Array<{
        RateType?: string;
        Median?: string;
        Mean?: string;
        Pct10?: string;
        Pct25?: string;
        Pct75?: string;
        Pct90?: string;
      }>;
      StateWagesList?: Array<{
        RateType?: string;
        Median?: string;
        Mean?: string;
        Pct10?: string;
        Pct25?: string;
        Pct75?: string;
        Pct90?: string;
      }>;
    };
  }>;
}

// ─── API Functions ─────────────────────────────────────────────────────

/**
 * Search jobs by O*NET code or keyword near a ZIP.
 *
 * Uses the CareerOneStop Job Search API.
 * GET /v2/jobsearch/{userId}/{keyword}/{location}/{radius}/0/0/{startRecord}/{pageSize}/{days}
 *
 * @returns Job search results with total count and individual postings.
 *          Returns empty result on API failure (graceful degradation).
 */
export async function searchJobsByZip(params: {
  onetCode?: string;
  keyword?: string;
  zip: string;
  radius: number;
  days: number;
  maxResults?: number;
}): Promise<JobSearchResult | null> {
  const { onetCode, keyword, zip, radius, days, maxResults = 500 } = params;

  // Use O*NET code as keyword if provided, otherwise use keyword
  const searchTerm = onetCode ?? keyword;
  if (!searchTerm) {
    return { totalJobs: 0, jobs: [] };
  }

  const userId = getUserId();
  const pageSize = Math.min(maxResults, 500);
  // Path: /v2/jobsearch/{userId}/{keyword}/{location}/{radius}/{sortColumns}/{sortOrder}/{startRecord}/{pageSize}/{days}
  const path = `/v2/jobsearch/${userId}/${encodeURIComponent(searchTerm)}/${zip}/${radius}/0/0/0/${pageSize}/${days}`;

  try {
    const raw = await cosFetch<CosJobSearchResponse>(path);

    const jobs =
      raw.Jobs?.map((j) => ({
        title: j.JobTitle ?? "",
        company: j.Company ?? "",
        onetCode: j.OnetCode,
        location: j.Location ?? "",
        datePosted: j.DatePosted,
        url: j.URL,
      })) ?? [];

    return {
      totalJobs: raw.RecordCount ?? jobs.length,
      jobs,
    };
  } catch (err) {
    console.error("[CareerOneStop] Job search failed:", err);
    return null;
  }
}

/**
 * Validate a ZIP and get associated county/MSA geography.
 *
 * GET /v2/location/{userId}/{location}
 *
 * @returns Location details including county FIPS and MSA code.
 *          Returns null on API failure.
 */
export async function validateLocation(zip: string): Promise<LocationResult | null> {
  const userId = getUserId();
  const path = `/v2/location/${userId}/${zip}`;

  try {
    const raw = await cosFetch<CosLocationResponse>(path);
    const loc = raw.ZipList?.[0];
    if (!loc) return null;

    return {
      zip: loc.Zip ?? zip,
      city: loc.CityName ?? "",
      state: loc.StateName ?? "",
      stateCode: loc.StateCode ?? "",
      countyFips: loc.CountyFips,
      countyName: loc.CountyName,
      msaCode: loc.MsaCode,
      msaName: loc.MsaName,
      isMetro: loc.MetroStatus === "Metro",
    };
  } catch (err) {
    console.error("[CareerOneStop] Location validation failed:", err);
    return null;
  }
}

/**
 * Get local wage data by O*NET code and location.
 *
 * GET /v2/occupationwages/{userId}/{onetCode}/{location}/{radius}
 *
 * @returns Local wage percentiles. Returns null on failure.
 */
export async function getLocalWages(
  onetCode: string,
  zip: string
): Promise<LocalWageResult | null> {
  const userId = getUserId();
  // The wages endpoint uses a slightly different path structure
  const path = `/v2/occupationwages/${userId}/${onetCode}/${zip}/0`;

  try {
    const raw = await cosFetch<CosWageResponse>(path);
    const detail = raw.OccupationDetail?.[0];
    if (!detail) return null;

    // Prefer state wages over national; look for annual rate type
    const wageList =
      detail.Wages?.StateWagesList ?? detail.Wages?.NationalWagesList ?? [];
    const annualWages = wageList.find((w) => w.RateType === "Annual");
    const hourlyWages = wageList.find((w) => w.RateType === "Hourly");

    // Use annual if available; otherwise convert hourly (×2080)
    const wages = annualWages ?? hourlyWages;
    const multiplier = annualWages ? 1 : hourlyWages ? 2080 : 0;

    const parseWage = (val?: string): number | null => {
      if (!val || val === "N/A") return null;
      const n = parseFloat(val.replace(/[,$]/g, ""));
      return isNaN(n) ? null : n * multiplier;
    };

    return {
      onetCode: detail.OnetCode ?? onetCode,
      location: zip,
      medianWage: parseWage(wages?.Median),
      meanWage: parseWage(wages?.Mean),
      pct10: parseWage(wages?.Pct10),
      pct25: parseWage(wages?.Pct25),
      pct75: parseWage(wages?.Pct75),
      pct90: parseWage(wages?.Pct90),
    };
  } catch (err) {
    console.error("[CareerOneStop] Wage lookup failed:", err);
    return null;
  }
}
