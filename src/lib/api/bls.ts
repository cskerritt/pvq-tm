const BLS_BASE = "https://api.bls.gov/publicAPI/v2";

function getApiKey(): string {
  const key = process.env.BLS_API_KEY;
  if (!key) throw new Error("BLS_API_KEY not set");
  return key;
}

export interface BLSSeriesData {
  seriesID: string;
  data: {
    year: string;
    period: string;
    periodName: string;
    value: string;
    footnotes: { code: string; text: string }[];
  }[];
}

export interface BLSResponse {
  status: string;
  responseTime: number;
  message: string[];
  Results: {
    series: BLSSeriesData[];
  };
}

export interface OEWSData {
  onetSocCode: string;
  areaType: string;
  areaCode: string;
  areaName: string;
  employment: number | null;
  meanWage: number | null;
  medianWage: number | null;
  pct10: number | null;
  pct25: number | null;
  pct75: number | null;
  pct90: number | null;
  year: number;
}

/** Fetch BLS time series data with automatic retry on rate limit (429) */
export async function fetchBLSSeries(
  seriesIds: string[],
  startYear?: number,
  endYear?: number
): Promise<BLSResponse> {
  const currentYear = new Date().getFullYear();
  // OEWS/ORS data is typically 1-2 years behind, so search from 2 years ago
  const body: Record<string, unknown> = {
    seriesid: seriesIds,
    registrationkey: getApiKey(),
    startyear: String(startYear ?? currentYear - 2),
    endyear: String(endYear ?? currentYear),
  };

  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(`${BLS_BASE}/timeseries/data/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      // Rate limited — wait with exponential backoff and retry
      const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
      console.log(`[BLS] Rate limited (429), retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    if (!res.ok) {
      throw new Error(`BLS API error ${res.status}: ${await res.text()}`);
    }

    const json: BLSResponse = await res.json();

    // Check for daily limit exhaustion in response body
    if (json.status === "REQUEST_NOT_PROCESSED") {
      const msg = json.message?.join(" ") ?? "";
      if (msg.includes("daily threshold")) {
        throw new Error("BLS daily request limit reached. Sync will resume after midnight ET.");
      }
    }

    return json;
  }

  throw new Error("BLS API rate limit exceeded after retries");
}

/**
 * Build BLS OEWS series ID for a given SOC code and data type.
 * Format: OEU + area_type + area_code + industry_code + SOC_code + data_type
 * Area types: N=National, S=State, M=Metropolitan
 */
export function buildOEWSSeriesId(
  socCode: string,
  dataType: "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12" | "13" | "14" | "15",
  areaCode = "0000000",
  industryCode = "000000"
): string {
  // SOC code needs to be 6 digits (e.g., "13-2011" -> "132011")
  const soc = socCode.replace("-", "").replace(".", "").slice(0, 6);
  const areaType = areaCode === "0000000" ? "N" : "M";
  return `OEU${areaType}${areaCode}${industryCode}${soc}${dataType}`;
}

// OEWS data type codes:
// 01 = Employment
// 02 = Employment percent relative standard error
// 03 = Hourly mean wage
// 04 = Annual mean wage
// 05 = Wage percent relative standard error
// 06 = Hourly 10th percentile wage
// 07 = Hourly 25th percentile wage
// 08 = Hourly median wage
// 09 = Hourly 75th percentile wage
// 10 = Hourly 90th percentile wage
// 11 = Annual 10th percentile wage
// 12 = Annual 25th percentile wage
// 13 = Annual median wage
// 14 = Annual 75th percentile wage
// 15 = Annual 90th percentile wage

/**
 * Fetch OEWS wage and employment data for an occupation.
 * Uses the 6-digit SOC code (e.g., "13-2011").
 */
export async function fetchOEWSData(
  socCode: string,
  areaCode = "0000000"
): Promise<OEWSData | null> {
  const seriesIds = [
    buildOEWSSeriesId(socCode, "01", areaCode), // employment
    buildOEWSSeriesId(socCode, "04", areaCode), // annual mean wage
    buildOEWSSeriesId(socCode, "11", areaCode), // annual 10th percentile wage
    buildOEWSSeriesId(socCode, "12", areaCode), // annual 25th percentile wage
    buildOEWSSeriesId(socCode, "13", areaCode), // annual median wage (50th pctl)
    buildOEWSSeriesId(socCode, "14", areaCode), // annual 75th percentile wage
    buildOEWSSeriesId(socCode, "15", areaCode), // annual 90th percentile wage
  ];

  const response = await fetchBLSSeries(seriesIds);

  if (response.status !== "REQUEST_SUCCEEDED" || !response.Results?.series?.length) {
    return null;
  }

  const getLatestValue = (series: BLSSeriesData | undefined): number | null => {
    if (!series?.data?.length) return null;
    const val = parseFloat(series.data[0].value);
    return isNaN(val) ? null : val;
  };

  const employment = response.Results.series.find((s) => s.seriesID.endsWith("01"));
  const meanWage = response.Results.series.find((s) => s.seriesID.endsWith("04"));
  const pct10Series = response.Results.series.find((s) => s.seriesID.endsWith("11"));
  const pct25Series = response.Results.series.find((s) => s.seriesID.endsWith("12"));
  const medianWage = response.Results.series.find((s) => s.seriesID.endsWith("13"));
  const pct75Series = response.Results.series.find((s) => s.seriesID.endsWith("14"));
  const pct90Series = response.Results.series.find((s) => s.seriesID.endsWith("15"));

  const year = employment?.data?.[0]?.year
    ? parseInt(employment.data[0].year)
    : new Date().getFullYear();

  const empVal = getLatestValue(employment);

  return {
    onetSocCode: socCode,
    areaType: areaCode === "0000000" ? "national" : "metro",
    areaCode,
    areaName: areaCode === "0000000" ? "National" : areaCode,
    employment: empVal !== null ? Math.round(empVal) : null,
    meanWage: getLatestValue(meanWage),
    medianWage: getLatestValue(medianWage),
    pct10: getLatestValue(pct10Series),
    pct25: getLatestValue(pct25Series),
    pct75: getLatestValue(pct75Series),
    pct90: getLatestValue(pct90Series),
    year,
  };
}

/**
 * Build ORS series ID (20 digits).
 * Format: OR(2) + U(1) + Req(1) + Own(1) + Ind(4) + Occ(3) + Char(3) + Est(5)
 * Requirement codes: P=physical, E=environmental, C=cognitive, V=education
 * Ownership: 1=all civilian workers
 */
export function buildORSSeriesId(
  requirementType: "P" | "E" | "C" | "V",
  estimateCode: string,
  ownership = "1",
  industry = "0000",
  occupation = "000",
  characteristic = "000"
): string {
  return `ORU${requirementType}${ownership}${industry}${occupation}${characteristic}${estimateCode}`;
}

/**
 * Fetch comprehensive ORS data for all civilian workers (aggregate level).
 * ORS publishes aggregate-level physical, environmental, cognitive, and
 * education/training demand data. Returns demand percentages that apply
 * as benchmarks for occupational analysis.
 *
 * Expanded to include all available ORS characteristics:
 * - Physical: standing, walking, sitting, lifting, carrying, pushing/pulling,
 *   reaching, climbing, kneeling, crouching, crawling, grasping, fine manipulation
 * - Environmental: indoors, outdoors, extreme temp, noise, vibration, hazards,
 *   fumes/dust, wet/humid
 * - Cognitive: reading, writing, math, verbal, problem solving, decision making
 * - Education/Training: education level, training, experience
 */
export async function fetchORSData(_socCode: string): Promise<Record<string, string | null>> {
  // Physical demand estimate codes (all workers aggregate)
  const physicalEstimates: Record<string, string> = {
    standing: "01001",
    walking: "01002",
    sitting: "01003",
    lifting: "01005",
    carrying: "01006",
    pushing_pulling: "01007",
    reaching: "01008",
    climbing: "01009",
    kneeling: "01010",
    crouching: "01011",
    crawling: "01012",
    grasping: "01013",
    fine_manipulation: "01014",
  };

  // Environmental condition estimate codes
  const envEstimates: Record<string, string> = {
    indoors: "01001",
    outdoors: "01002",
    extreme_temp: "01003",
    noise: "01005",
    vibration: "01006",
    hazards: "01007",
    fumes_dust: "01008",
    wet_humid: "01009",
  };

  // Cognitive demand estimate codes
  const cogEstimates: Record<string, string> = {
    reading: "01001",
    writing: "01002",
    math: "01003",
    verbal: "01005",
    problem_solving: "01006",
    decision_making: "01007",
  };

  // Education, training, experience estimate codes
  const eduEstimates: Record<string, string> = {
    education_level: "01001",
    training: "01002",
    experience: "01003",
  };

  // Build series IDs — BLS allows up to 50 per request.
  // Total: 13 + 8 + 6 + 3 = 30 series, well under the limit.
  const seriesIds: string[] = [];
  const seriesMap: Record<string, string> = {};

  for (const [name, code] of Object.entries(physicalEstimates)) {
    const sid = buildORSSeriesId("P", code);
    seriesIds.push(sid);
    seriesMap[sid] = `physical_${name}`;
  }

  for (const [name, code] of Object.entries(envEstimates)) {
    const sid = buildORSSeriesId("E", code);
    seriesIds.push(sid);
    seriesMap[sid] = `env_${name}`;
  }

  for (const [name, code] of Object.entries(cogEstimates)) {
    const sid = buildORSSeriesId("C", code);
    seriesIds.push(sid);
    seriesMap[sid] = `cog_${name}`;
  }

  for (const [name, code] of Object.entries(eduEstimates)) {
    const sid = buildORSSeriesId("V", code);
    seriesIds.push(sid);
    seriesMap[sid] = `edu_${name}`;
  }

  try {
    const response = await fetchBLSSeries(seriesIds);
    const result: Record<string, string | null> = {};

    for (const series of response.Results?.series ?? []) {
      const name = seriesMap[series.seriesID];
      if (name && series.data?.[0]?.value && series.data[0].value !== "-") {
        result[name] = series.data[0].value;
      }
    }

    return result;
  } catch {
    return {};
  }
}
