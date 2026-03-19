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

// ─── Comprehensive JOLTS Series Catalog ──────────────────────────────────
//
// Full coverage of JOLTS series by industry and measure.
// Prefix JTS = Seasonally Adjusted, JTU = Not Seasonally Adjusted.
// Suffixes: HIL=Hires Level, HIR=Hires Rate, JOL=Openings Level,
//   JOR=Openings Rate, LDL=Layoffs Level, LDR=Layoffs Rate,
//   OSL=Other Seps Level, OSR=Other Seps Rate, QUL=Quits Level,
//   QUR=Quits Rate, TSL=Total Seps Level, TSR=Total Seps Rate

/** Measures tracked for JOLTS series */
export type JoltsMeasure =
  | "openingsLevel"
  | "openingsRate"
  | "hiresLevel"
  | "hiresRate"
  | "quitsLevel"
  | "quitsRate"
  | "layoffsLevel"
  | "layoffsRate"
  | "otherSepsLevel"
  | "otherSepsRate"
  | "totalSepsLevel"
  | "totalSepsRate";

interface JoltsSeriesDefinition {
  seasonallyAdjusted: string;
  notSeasonallyAdjusted: string;
}

interface JoltsIndustrySeriesFull {
  naicsCode: string;
  industryName: string;
  series: Partial<Record<JoltsMeasure, JoltsSeriesDefinition>>;
}

const JOLTS_FULL_SERIES: JoltsIndustrySeriesFull[] = [
  {
    naicsCode: "00",
    industryName: "Total Nonfarm",
    series: {
      openingsLevel: { seasonallyAdjusted: "JTSJOL", notSeasonallyAdjusted: "JTUJOL" },
      openingsRate: { seasonallyAdjusted: "JTSJOR", notSeasonallyAdjusted: "JTUJOR" },
      hiresLevel: { seasonallyAdjusted: "JTSHIL", notSeasonallyAdjusted: "JTUHIL" },
      hiresRate: { seasonallyAdjusted: "JTSHIR", notSeasonallyAdjusted: "JTUHIR" },
      quitsLevel: { seasonallyAdjusted: "JTSQUL", notSeasonallyAdjusted: "JTUQUL" },
      quitsRate: { seasonallyAdjusted: "JTSQUR", notSeasonallyAdjusted: "JTUQUR" },
      layoffsLevel: { seasonallyAdjusted: "JTSLDL", notSeasonallyAdjusted: "JTULDL" },
      layoffsRate: { seasonallyAdjusted: "JTSLDR", notSeasonallyAdjusted: "JTULDR" },
      otherSepsLevel: { seasonallyAdjusted: "JTSOSL", notSeasonallyAdjusted: "JTUOSL" },
      otherSepsRate: { seasonallyAdjusted: "JTSOSR", notSeasonallyAdjusted: "JTUOSR" },
      totalSepsLevel: { seasonallyAdjusted: "JTSTSL", notSeasonallyAdjusted: "JTUTSL" },
      totalSepsRate: { seasonallyAdjusted: "JTSTSR", notSeasonallyAdjusted: "JTUTSR" },
    },
  },
  {
    naicsCode: "1000",
    industryName: "Total Private",
    series: {
      hiresLevel: { seasonallyAdjusted: "JTS1000HIL", notSeasonallyAdjusted: "JTU1000HIL" },
      hiresRate: { seasonallyAdjusted: "JTS1000HIR", notSeasonallyAdjusted: "JTU1000HIR" },
      openingsLevel: { seasonallyAdjusted: "JTS1000JOL", notSeasonallyAdjusted: "JTU1000JOL" },
      openingsRate: { seasonallyAdjusted: "JTS1000JOR", notSeasonallyAdjusted: "JTU1000JOR" },
    },
  },
  {
    naicsCode: "23",
    industryName: "Construction",
    series: {
      openingsLevel: { seasonallyAdjusted: "JTS2300JOL", notSeasonallyAdjusted: "JTU2300JOL" },
      openingsRate: { seasonallyAdjusted: "JTS2300JOR", notSeasonallyAdjusted: "JTU2300JOR" },
      hiresLevel: { seasonallyAdjusted: "JTS2300HIL", notSeasonallyAdjusted: "JTU2300HIL" },
      hiresRate: { seasonallyAdjusted: "JTS2300HIR", notSeasonallyAdjusted: "JTU2300HIR" },
    },
  },
  {
    naicsCode: "31-33",
    industryName: "Manufacturing",
    series: {
      openingsLevel: { seasonallyAdjusted: "JTS3000JOL", notSeasonallyAdjusted: "JTU3000JOL" },
      openingsRate: { seasonallyAdjusted: "JTS3000JOR", notSeasonallyAdjusted: "JTU3000JOR" },
      hiresLevel: { seasonallyAdjusted: "JTS3000HIL", notSeasonallyAdjusted: "JTU3000HIL" },
      hiresRate: { seasonallyAdjusted: "JTS3000HIR", notSeasonallyAdjusted: "JTU3000HIR" },
    },
  },
  {
    naicsCode: "54-56",
    industryName: "Professional and Business Services",
    series: {
      openingsLevel: { seasonallyAdjusted: "JTS540099JOL", notSeasonallyAdjusted: "JTU540099JOL" },
      openingsRate: { seasonallyAdjusted: "JTS540099JOR", notSeasonallyAdjusted: "JTU540099JOR" },
      hiresLevel: { seasonallyAdjusted: "JTS540099HIL", notSeasonallyAdjusted: "JTU540099HIL" },
      hiresRate: { seasonallyAdjusted: "JTS540099HIR", notSeasonallyAdjusted: "JTU540099HIR" },
    },
  },
  {
    naicsCode: "51",
    industryName: "Information",
    series: {
      openingsLevel: { seasonallyAdjusted: "JTS5100JOL", notSeasonallyAdjusted: "JTU5100JOL" },
      openingsRate: { seasonallyAdjusted: "JTS5100JOR", notSeasonallyAdjusted: "JTU5100JOR" },
      hiresLevel: { seasonallyAdjusted: "JTS5100HIL", notSeasonallyAdjusted: "JTU5100HIL" },
      hiresRate: { seasonallyAdjusted: "JTS5100HIR", notSeasonallyAdjusted: "JTU5100HIR" },
    },
  },
  {
    naicsCode: "52",
    industryName: "Finance and Insurance",
    series: {
      openingsLevel: { seasonallyAdjusted: "JTS5200JOL", notSeasonallyAdjusted: "JTU5200JOL" },
      openingsRate: { seasonallyAdjusted: "JTS5200JOR", notSeasonallyAdjusted: "JTU5200JOR" },
      hiresLevel: { seasonallyAdjusted: "JTS5200HIL", notSeasonallyAdjusted: "JTU5200HIL" },
      hiresRate: { seasonallyAdjusted: "JTS5200HIR", notSeasonallyAdjusted: "JTU5200HIR" },
    },
  },
];

// ─── Comprehensive JOLTS Types ──────────────────────────────────────────

export interface JoltsSeriesValue {
  value: number | null;
  date: string;
}

export interface JoltsYoyChange {
  current: number | null;
  priorYear: number | null;
  change: number | null;
  changePct: number | null;
}

export interface ComprehensiveJoltsIndustry {
  naicsCode: string;
  industryName: string;
  openings: JoltsSeriesValue & { yoy: JoltsYoyChange };
  hires: JoltsSeriesValue & { yoy: JoltsYoyChange };
  quits: JoltsSeriesValue & { yoy: JoltsYoyChange };
  layoffs: JoltsSeriesValue & { yoy: JoltsYoyChange };
  totalSeparations: JoltsSeriesValue & { yoy: JoltsYoyChange };
}

export interface ComprehensiveJoltsResult {
  totalNonfarm: ComprehensiveJoltsIndustry;
  byIndustry: ComprehensiveJoltsIndustry[];
  fetchedAt: string;
}

export interface IndustryJoltsProfile {
  naicsPrefix: string;
  matchedIndustry: string | null;
  openings: JoltsSeriesValue | null;
  hires: JoltsSeriesValue | null;
  openingsRate: JoltsSeriesValue | null;
  hiresRate: JoltsSeriesValue | null;
}

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

// ─── Comprehensive JOLTS Fetch ───────────────────────────────────────────

/**
 * Fetch the latest value and the value from 12 months prior for a JOLTS series.
 * Returns current value with YoY change computation.
 */
async function fetchJoltsWithYoy(
  seriesId: string
): Promise<JoltsSeriesValue & { yoy: JoltsYoyChange }> {
  try {
    const obs = await fetchFredSeries(seriesId);
    const latestObs = obs[0];
    const latestVal = parseJoltsValue(latestObs);
    const latestDate = latestObs?.date ?? "unknown";

    // Find observation from ~12 months ago
    let priorYearVal: number | null = null;
    if (latestObs?.date) {
      const latestDt = new Date(latestObs.date);
      const targetDt = new Date(latestDt);
      targetDt.setFullYear(targetDt.getFullYear() - 1);

      // Find closest observation to 12 months ago
      for (const o of obs) {
        const dt = new Date(o.date);
        const diffMs = Math.abs(dt.getTime() - targetDt.getTime());
        if (diffMs < 45 * 24 * 60 * 60 * 1000) {
          // within 45 days
          priorYearVal = parseJoltsValue(o);
          break;
        }
      }
    }

    let change: number | null = null;
    let changePct: number | null = null;
    if (latestVal !== null && priorYearVal !== null) {
      change = latestVal - priorYearVal;
      changePct =
        priorYearVal !== 0
          ? Math.round((change / priorYearVal) * 10000) / 100
          : null;
    }

    return {
      value: latestVal,
      date: latestDate,
      yoy: { current: latestVal, priorYear: priorYearVal, change, changePct },
    };
  } catch {
    return {
      value: null,
      date: "unknown",
      yoy: { current: null, priorYear: null, change: null, changePct: null },
    };
  }
}

/** Null YoY placeholder for industries that lack certain measures */
const NULL_SERIES_YOY: JoltsSeriesValue & { yoy: JoltsYoyChange } = {
  value: null,
  date: "unknown",
  yoy: { current: null, priorYear: null, change: null, changePct: null },
};

/**
 * Fetch comprehensive JOLTS data across all key series.
 *
 * Returns:
 * - Total nonfarm: openings, hires, quits, layoffs, total separations (level)
 * - By industry: construction, manufacturing, professional/business, information, finance
 * - Each with latest values and year-over-year changes
 */
export async function fetchComprehensiveJolts(): Promise<ComprehensiveJoltsResult> {
  // Define the industries and their series to fetch
  const industriesToFetch: Array<{
    naicsCode: string;
    name: string;
    openings?: string;
    hires?: string;
    quits?: string;
    layoffs?: string;
    totalSeps?: string;
  }> = [
    {
      naicsCode: "00",
      name: "Total Nonfarm",
      openings: "JTSJOL",
      hires: "JTSHIL",
      quits: "JTSQUL",
      layoffs: "JTSLDL",
      totalSeps: "JTSTSL",
    },
    {
      naicsCode: "23",
      name: "Construction",
      openings: "JTS2300JOL",
      hires: "JTS2300HIL",
    },
    {
      naicsCode: "31-33",
      name: "Manufacturing",
      openings: "JTS3000JOL",
      hires: "JTS3000HIL",
    },
    {
      naicsCode: "54-56",
      name: "Professional and Business Services",
      openings: "JTS540099JOL",
      hires: "JTS540099HIL",
    },
    {
      naicsCode: "51",
      name: "Information",
      openings: "JTS5100JOL",
      hires: "JTS5100HIL",
    },
    {
      naicsCode: "52",
      name: "Finance and Insurance",
      openings: "JTS5200JOL",
      hires: "JTS5200HIL",
    },
  ];

  // Fetch all series in parallel
  const fetchPromises: Array<
    Promise<{ key: string; result: JoltsSeriesValue & { yoy: JoltsYoyChange } }>
  > = [];

  for (const ind of industriesToFetch) {
    const measures = [
      { key: `${ind.naicsCode}:openings`, series: ind.openings },
      { key: `${ind.naicsCode}:hires`, series: ind.hires },
      { key: `${ind.naicsCode}:quits`, series: ind.quits },
      { key: `${ind.naicsCode}:layoffs`, series: ind.layoffs },
      { key: `${ind.naicsCode}:totalSeps`, series: ind.totalSeps },
    ];

    for (const m of measures) {
      if (m.series) {
        fetchPromises.push(
          fetchJoltsWithYoy(m.series).then((result) => ({
            key: m.key,
            result,
          }))
        );
      }
    }
  }

  const results = await Promise.all(fetchPromises);
  const lookup = new Map<
    string,
    JoltsSeriesValue & { yoy: JoltsYoyChange }
  >();
  for (const r of results) {
    lookup.set(r.key, r.result);
  }

  function buildIndustry(
    naicsCode: string,
    name: string
  ): ComprehensiveJoltsIndustry {
    return {
      naicsCode,
      industryName: name,
      openings: lookup.get(`${naicsCode}:openings`) ?? { ...NULL_SERIES_YOY },
      hires: lookup.get(`${naicsCode}:hires`) ?? { ...NULL_SERIES_YOY },
      quits: lookup.get(`${naicsCode}:quits`) ?? { ...NULL_SERIES_YOY },
      layoffs: lookup.get(`${naicsCode}:layoffs`) ?? { ...NULL_SERIES_YOY },
      totalSeparations:
        lookup.get(`${naicsCode}:totalSeps`) ?? { ...NULL_SERIES_YOY },
    };
  }

  const totalNonfarm = buildIndustry("00", "Total Nonfarm");
  const byIndustry = industriesToFetch
    .filter((i) => i.naicsCode !== "00")
    .map((i) => buildIndustry(i.naicsCode, i.name));

  return {
    totalNonfarm,
    byIndustry,
    fetchedAt: new Date().toISOString(),
  };
}

// ─── NAICS prefix to JOLTS industry mapping ─────────────────────────────

/**
 * Map from 2-digit NAICS prefix to the best-matching JOLTS industry entry
 * in JOLTS_FULL_SERIES.
 */
const NAICS_TO_JOLTS_MAP: Record<
  string,
  { naicsCode: string; industryName: string }
> = {
  "23": { naicsCode: "23", industryName: "Construction" },
  "31": { naicsCode: "31-33", industryName: "Manufacturing" },
  "32": { naicsCode: "31-33", industryName: "Manufacturing" },
  "33": { naicsCode: "31-33", industryName: "Manufacturing" },
  "54": { naicsCode: "54-56", industryName: "Professional and Business Services" },
  "55": { naicsCode: "54-56", industryName: "Professional and Business Services" },
  "56": { naicsCode: "54-56", industryName: "Professional and Business Services" },
  "51": { naicsCode: "51", industryName: "Information" },
  "52": { naicsCode: "52", industryName: "Finance and Insurance" },
  "53": { naicsCode: "52", industryName: "Finance and Insurance" },
  "61": { naicsCode: "00", industryName: "Total Nonfarm" },
  "62": { naicsCode: "00", industryName: "Total Nonfarm" },
  "71": { naicsCode: "00", industryName: "Total Nonfarm" },
  "72": { naicsCode: "00", industryName: "Total Nonfarm" },
  "42": { naicsCode: "00", industryName: "Total Nonfarm" },
  "44": { naicsCode: "00", industryName: "Total Nonfarm" },
  "45": { naicsCode: "00", industryName: "Total Nonfarm" },
  "48": { naicsCode: "00", industryName: "Total Nonfarm" },
  "49": { naicsCode: "00", industryName: "Total Nonfarm" },
  "92": { naicsCode: "00", industryName: "Total Nonfarm" },
};

/**
 * Get the most relevant JOLTS data for an industry identified by its
 * 2-digit NAICS prefix.
 *
 * Falls back to total nonfarm if the specific industry is not directly
 * tracked in JOLTS at the published detail level.
 *
 * @param naicsPrefix - 2-digit NAICS code (e.g., "23" for construction)
 * @returns Openings and hires levels and rates for the matched industry
 */
export async function getIndustryJoltsProfile(
  naicsPrefix: string
): Promise<IndustryJoltsProfile> {
  const prefix = naicsPrefix.substring(0, 2);
  const mapping = NAICS_TO_JOLTS_MAP[prefix];

  if (!mapping) {
    return {
      naicsPrefix: prefix,
      matchedIndustry: null,
      openings: null,
      hires: null,
      openingsRate: null,
      hiresRate: null,
    };
  }

  // Find the matching full series entry
  const seriesEntry = JOLTS_FULL_SERIES.find(
    (s) => s.naicsCode === mapping.naicsCode
  );

  if (!seriesEntry) {
    return {
      naicsPrefix: prefix,
      matchedIndustry: mapping.industryName,
      openings: null,
      hires: null,
      openingsRate: null,
      hiresRate: null,
    };
  }

  // Fetch all available measures in parallel
  const fetchMeasure = async (
    measure: JoltsMeasure
  ): Promise<JoltsSeriesValue | null> => {
    const def = seriesEntry.series[measure];
    if (!def) return null;
    try {
      const obs = await fetchFredSeries(def.seasonallyAdjusted);
      const latestObs = obs[0];
      return {
        value: parseJoltsValue(latestObs),
        date: latestObs?.date ?? "unknown",
      };
    } catch {
      return null;
    }
  };

  const [openings, hires, openingsRate, hiresRate] = await Promise.all([
    fetchMeasure("openingsLevel"),
    fetchMeasure("hiresLevel"),
    fetchMeasure("openingsRate"),
    fetchMeasure("hiresRate"),
  ]);

  return {
    naicsPrefix: prefix,
    matchedIndustry: mapping.industryName,
    openings,
    hires,
    openingsRate,
    hiresRate,
  };
}

/**
 * Returns the full JOLTS series catalog for programmatic access.
 */
export function getJoltsFullSeriesCatalog(): JoltsIndustrySeriesFull[] {
  return [...JOLTS_FULL_SERIES];
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
