const BEA_BASE = "https://apps.bea.gov/api/data";

function getApiKey(): string {
  const key = process.env.BEA_API_KEY;
  if (!key) throw new Error("BEA_API_KEY not set");
  return key;
}

export interface BEAResult {
  Data: BEADataRow[];
}

export interface BEADataRow {
  GeoFips: string;
  GeoName: string;
  TimePeriod: string;
  DataValue: string;
  CL_UNIT: string;
  UNIT_MULT: string;
  LineDescription?: string;
}

async function beaFetch(params: Record<string, string>): Promise<BEAResult> {
  const url = new URL(BEA_BASE);
  url.searchParams.set("UserID", getApiKey());
  url.searchParams.set("ResultFormat", "JSON");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    next: { revalidate: 86400 },
  });
  if (!res.ok) {
    throw new Error(`BEA API error ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  return json.BEAAPI?.Results ?? { Data: [] };
}

/** Get regional GDP for a state or metro area (FIPS code) */
export async function getRegionalGDP(
  geoFips: string,
  year?: number
): Promise<BEADataRow[]> {
  const result = await beaFetch({
    method: "GetData",
    datasetname: "Regional",
    TableName: "CAGDP1",
    GeoFips: geoFips,
    LineCode: "1",
    Year: year ? String(year) : "LAST5",
  });
  return result.Data ?? [];
}

/** Get per-capita personal income for a region */
export async function getPerCapitaIncome(
  geoFips: string,
  year?: number
): Promise<BEADataRow[]> {
  const result = await beaFetch({
    method: "GetData",
    datasetname: "Regional",
    TableName: "CAINC1",
    GeoFips: geoFips,
    LineCode: "3",
    Year: year ? String(year) : "LAST5",
  });
  return result.Data ?? [];
}
