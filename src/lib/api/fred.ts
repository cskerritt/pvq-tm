/**
 * FRED (Federal Reserve Economic Data) API Client
 *
 * Provides access to:
 * - Unemployment rates (state, national, metro)
 * - CPI data
 * - JOLTS (Job Openings and Labor Turnover Survey) data by industry
 *
 * JOLTS data is national, published monthly at the industry (NAICS) level.
 * Values are in THOUSANDS -- callers should multiply by 1000 for actual numbers.
 *
 * API docs: https://fred.stlouisfed.org/docs/api/fred/
 * Auth: requires FRED_API_KEY env var.
 */

const FRED_BASE = "https://api.stlouisfed.org/fred";

function getApiKey(): string {
  const key = process.env.FRED_API_KEY;
  if (!key) throw new Error("FRED_API_KEY not set");
  return key;
}

// ─── Core Types ──────────────────────────────────────────────────────────

export interface FREDObservation {
  date: string;
  value: string;
}

export interface FREDSeriesResponse {
  observations: FREDObservation[];
}

export interface JoltsIndustryData {
  naicsCode: string;
  industryName: string;
  hires: number | null; // actual number (already multiplied by 1000)
  openings: number | null; // actual number (already multiplied by 1000)
  period: string; // date string of the observation
}

export interface JoltsIndustryMapping {
  naicsCode: string;
  industryName: string;
  hiresSeries: string;
  openingsSeries: string;
}

// ─── JOLTS Series Mapping ────────────────────────────────────────────────
//
// Each industry sector tracked by JOLTS has a hires (HIL) and openings (JOL)
// series. These are seasonally adjusted, national-level, in thousands.

const JOLTS_INDUSTRY_SERIES: JoltsIndustryMapping[] = [
  {
    naicsCode: "23",
    industryName: "Construction",
    hiresSeries: "JTS2300HIL",
    openingsSeries: "JTS2300JOL",
  },
  {
    naicsCode: "31-33",
    industryName: "Manufacturing",
    hiresSeries: "JTS3000HIL",
    openingsSeries: "JTS3000JOL",
  },
  {
    naicsCode: "54-56",
    industryName: "Professional and Business Services",
    hiresSeries: "JTS540099HIL",
    openingsSeries: "JTS540099JOL",
  },
  {
    naicsCode: "61-62",
    industryName: "Education and Health Services",
    hiresSeries: "JTS6000HIL",
    openingsSeries: "JTS6000JOL",
  },
  {
    naicsCode: "71-72",
    industryName: "Leisure and Hospitality",
    hiresSeries: "JTS7000HIL",
    openingsSeries: "JTS7000JOL",
  },
  {
    naicsCode: "42-49",
    industryName: "Trade, Transportation, and Utilities",
    hiresSeries: "JTS4000HIL",
    openingsSeries: "JTS4000JOL",
  },
  {
    naicsCode: "52-53",
    industryName: "Financial Activities",
    hiresSeries: "JTS5200HIL",
    openingsSeries: "JTS5200JOL",
  },
  {
    naicsCode: "51",
    industryName: "Information",
    hiresSeries: "JTS5100HIL",
    openingsSeries: "JTS5100JOL",
  },
  {
    naicsCode: "92",
    industryName: "Government",
    hiresSeries: "JTS9000HIL",
    openingsSeries: "JTS9000JOL",
  },
];

// Aggregate series (not industry-specific)
const JOLTS_AGGREGATE_SERIES = {
  totalPrivateHires: "JTS1000HIL",
  totalNonfarmOpenings: "JTSJOL",
  totalNonfarmHires: "JTSHIL",
  layoffsDischarges: "JTSLDL",
  quits: "JTSQUL",
  totalSeparations: "JTSTSL",
} as const;

// ─── Internal Fetch ──────────────────────────────────────────────────────

async function fredFetch<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${FRED_BASE}${path}`);
  url.searchParams.set("api_key", getApiKey());
  url.searchParams.set("file_type", "json");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    next: { revalidate: 86400 }, // cache for 24 hours
  });
  if (!res.ok) {
    throw new Error(`FRED API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// ─── Generic Series Fetch ────────────────────────────────────────────────

/**
 * Fetch observations for any FRED series.
 *
 * @param seriesId - FRED series ID (e.g., "JTSHIL", "UNRATE")
 * @param startDate - Optional start date (YYYY-MM-DD)
 * @param endDate - Optional end date (YYYY-MM-DD)
 * @returns Array of observations with date and string value
 */
export async function fetchFredSeries(
  seriesId: string,
  startDate?: string,
  endDate?: string
): Promise<FREDObservation[]> {
  const params: Record<string, string> = {
    series_id: seriesId,
    sort_order: "desc",
    limit: "120", // up to 10 years of monthly data
  };

  if (startDate) params.observation_start = startDate;
  if (endDate) params.observation_end = endDate;

  const data = await fredFetch<FREDSeriesResponse>(
    "/series/observations",
    params
  );
  return data.observations;
}

// ─── JOLTS Industry Hires ────────────────────────────────────────────────

/**
 * Parse a FRED observation value. JOLTS values are in thousands.
 * Returns the actual number (multiplied by 1000), or null if unavailable.
 */
function parseJoltsValue(obs: FREDObservation | undefined): number | null {
  if (!obs) return null;
  const raw = obs.value;
  if (!raw || raw === "." || raw === "N/A") return null;
  const num = parseFloat(raw);
  if (isNaN(num)) return null;
  return Math.round(num * 1000); // JOLTS values are in thousands
}

/**
 * Fetch the latest hiring data across all tracked JOLTS industry sectors.
 *
 * For each industry, fetches the most recent hires and openings observation.
 * Returns actual numbers (JOLTS thousands multiplied by 1000).
 *
 * @returns Array of industry-level hiring data sorted by hires descending
 */
export async function fetchJoltsIndustryHires(): Promise<JoltsIndustryData[]> {
  // Fetch all hires and openings series in parallel (2 calls per industry)
  const fetches = JOLTS_INDUSTRY_SERIES.flatMap((ind) => [
    fetchFredSeries(ind.hiresSeries, undefined, undefined)
      .then((obs) => ({
        key: `${ind.naicsCode}:hires`,
        obs: obs[0], // most recent (sorted desc)
      }))
      .catch(() => ({ key: `${ind.naicsCode}:hires`, obs: undefined })),
    fetchFredSeries(ind.openingsSeries, undefined, undefined)
      .then((obs) => ({
        key: `${ind.naicsCode}:openings`,
        obs: obs[0],
      }))
      .catch(() => ({ key: `${ind.naicsCode}:openings`, obs: undefined })),
  ]);

  const results = await Promise.all(fetches);

  // Build a lookup from the results
  const lookup = new Map<string, FREDObservation | undefined>();
  for (const r of results) {
    lookup.set(r.key, r.obs);
  }

  // Assemble industry data
  const industries: JoltsIndustryData[] = [];
  for (const ind of JOLTS_INDUSTRY_SERIES) {
    const hiresObs = lookup.get(`${ind.naicsCode}:hires`);
    const openingsObs = lookup.get(`${ind.naicsCode}:openings`);

    const hires = parseJoltsValue(hiresObs);
    const openings = parseJoltsValue(openingsObs);
    const period = hiresObs?.date ?? openingsObs?.date ?? "unknown";

    industries.push({
      naicsCode: ind.naicsCode,
      industryName: ind.industryName,
      hires,
      openings,
      period,
    });
  }

  // Sort by hires descending (null last)
  industries.sort((a, b) => (b.hires ?? 0) - (a.hires ?? 0));

  return industries;
}

// ─── JOLTS Trend ─────────────────────────────────────────────────────────

/**
 * Fetch a time series of JOLTS observations for trend analysis.
 *
 * @param seriesId - FRED series ID (e.g., "JTSHIL" for total nonfarm hires)
 * @param months - Number of months of data to fetch (default: 60 = 5 years)
 * @returns Array of observations sorted from oldest to newest
 */
export async function fetchJoltsTrend(
  seriesId: string,
  months: number = 60
): Promise<FREDObservation[]> {
  // Calculate start date
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  const startDate = start.toISOString().split("T")[0];

  const params: Record<string, string> = {
    series_id: seriesId,
    sort_order: "asc", // oldest first for trend analysis
    observation_start: startDate,
  };

  const data = await fredFetch<FREDSeriesResponse>(
    "/series/observations",
    params
  );
  return data.observations;
}

// ─── Industry Mapping Accessor ──────────────────────────────────────────

/**
 * Returns the mapping of FRED JOLTS series IDs to NAICS codes and industry names.
 *
 * Useful for consumers that need to understand which series map to which industries.
 */
export function getJoltsIndustryMapping(): JoltsIndustryMapping[] {
  return [...JOLTS_INDUSTRY_SERIES];
}

/**
 * Returns the aggregate JOLTS series IDs (total nonfarm hires, openings, etc.)
 */
export function getJoltsAggregateSeries(): typeof JOLTS_AGGREGATE_SERIES {
  return JOLTS_AGGREGATE_SERIES;
}

// ─── Existing Functions (Unemployment, CPI) ─────────────────────────────

/** Get unemployment rate for a state (abbreviation, e.g. "CA") */
export async function getStateUnemploymentRate(
  stateAbbr: string
): Promise<FREDObservation[]> {
  const seriesId = `${stateAbbr}UR`;
  const data = await fredFetch<FREDSeriesResponse>("/series/observations", {
    series_id: seriesId,
    sort_order: "desc",
    limit: "12",
  });
  return data.observations;
}

/** Get national unemployment rate */
export async function getNationalUnemploymentRate(): Promise<
  FREDObservation[]
> {
  const data = await fredFetch<FREDSeriesResponse>("/series/observations", {
    series_id: "UNRATE",
    sort_order: "desc",
    limit: "12",
  });
  return data.observations;
}

/** Get CPI (Consumer Price Index) */
export async function getCPI(): Promise<FREDObservation[]> {
  const data = await fredFetch<FREDSeriesResponse>("/series/observations", {
    series_id: "CPIAUCSL",
    sort_order: "desc",
    limit: "12",
  });
  return data.observations;
}

/** Get metro area unemployment by CBSA code */
export async function getMetroUnemployment(
  cbsaCode: string
): Promise<FREDObservation[]> {
  const seriesId = `LAUMT${cbsaCode}000000003`;
  const data = await fredFetch<FREDSeriesResponse>("/series/observations", {
    series_id: seriesId,
    sort_order: "desc",
    limit: "12",
  });
  return data.observations;
}
