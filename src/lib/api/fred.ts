const FRED_BASE = "https://api.stlouisfed.org/fred";

function getApiKey(): string {
  const key = process.env.FRED_API_KEY;
  if (!key) throw new Error("FRED_API_KEY not set");
  return key;
}

export interface FREDObservation {
  date: string;
  value: string;
}

export interface FREDSeriesResponse {
  observations: FREDObservation[];
}

async function fredFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${FRED_BASE}${path}`);
  url.searchParams.set("api_key", getApiKey());
  url.searchParams.set("file_type", "json");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    next: { revalidate: 86400 },
  });
  if (!res.ok) {
    throw new Error(`FRED API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/** Get unemployment rate for a state (FIPS code) */
export async function getStateUnemploymentRate(stateAbbr: string): Promise<FREDObservation[]> {
  const seriesId = `${stateAbbr}UR`;
  const data = await fredFetch<FREDSeriesResponse>("/series/observations", {
    series_id: seriesId,
    sort_order: "desc",
    limit: "12",
  });
  return data.observations;
}

/** Get national unemployment rate */
export async function getNationalUnemploymentRate(): Promise<FREDObservation[]> {
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
export async function getMetroUnemployment(cbsaCode: string): Promise<FREDObservation[]> {
  const seriesId = `LAUMT${cbsaCode}000000003`;
  const data = await fredFetch<FREDSeriesResponse>("/series/observations", {
    series_id: seriesId,
    sort_order: "desc",
    limit: "12",
  });
  return data.observations;
}
