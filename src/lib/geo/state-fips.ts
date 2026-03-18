/**
 * State FIPS Code Utilities
 *
 * Maps between state abbreviations, FIPS codes, and ZIP code prefixes.
 * Used for state-level JOLTS data lookups.
 */

export interface StateInfo {
  fips: string;
  name: string;
  abbr: string;
}

/** All US states + DC with FIPS codes */
const STATES: StateInfo[] = [
  { fips: "01", name: "Alabama", abbr: "AL" },
  { fips: "02", name: "Alaska", abbr: "AK" },
  { fips: "04", name: "Arizona", abbr: "AZ" },
  { fips: "05", name: "Arkansas", abbr: "AR" },
  { fips: "06", name: "California", abbr: "CA" },
  { fips: "08", name: "Colorado", abbr: "CO" },
  { fips: "09", name: "Connecticut", abbr: "CT" },
  { fips: "10", name: "Delaware", abbr: "DE" },
  { fips: "11", name: "District of Columbia", abbr: "DC" },
  { fips: "12", name: "Florida", abbr: "FL" },
  { fips: "13", name: "Georgia", abbr: "GA" },
  { fips: "15", name: "Hawaii", abbr: "HI" },
  { fips: "16", name: "Idaho", abbr: "ID" },
  { fips: "17", name: "Illinois", abbr: "IL" },
  { fips: "18", name: "Indiana", abbr: "IN" },
  { fips: "19", name: "Iowa", abbr: "IA" },
  { fips: "20", name: "Kansas", abbr: "KS" },
  { fips: "21", name: "Kentucky", abbr: "KY" },
  { fips: "22", name: "Louisiana", abbr: "LA" },
  { fips: "23", name: "Maine", abbr: "ME" },
  { fips: "24", name: "Maryland", abbr: "MD" },
  { fips: "25", name: "Massachusetts", abbr: "MA" },
  { fips: "26", name: "Michigan", abbr: "MI" },
  { fips: "27", name: "Minnesota", abbr: "MN" },
  { fips: "28", name: "Mississippi", abbr: "MS" },
  { fips: "29", name: "Missouri", abbr: "MO" },
  { fips: "30", name: "Montana", abbr: "MT" },
  { fips: "31", name: "Nebraska", abbr: "NE" },
  { fips: "32", name: "Nevada", abbr: "NV" },
  { fips: "33", name: "New Hampshire", abbr: "NH" },
  { fips: "34", name: "New Jersey", abbr: "NJ" },
  { fips: "35", name: "New Mexico", abbr: "NM" },
  { fips: "36", name: "New York", abbr: "NY" },
  { fips: "37", name: "North Carolina", abbr: "NC" },
  { fips: "38", name: "North Dakota", abbr: "ND" },
  { fips: "39", name: "Ohio", abbr: "OH" },
  { fips: "40", name: "Oklahoma", abbr: "OK" },
  { fips: "41", name: "Oregon", abbr: "OR" },
  { fips: "42", name: "Pennsylvania", abbr: "PA" },
  { fips: "44", name: "Rhode Island", abbr: "RI" },
  { fips: "45", name: "South Carolina", abbr: "SC" },
  { fips: "46", name: "South Dakota", abbr: "SD" },
  { fips: "47", name: "Tennessee", abbr: "TN" },
  { fips: "48", name: "Texas", abbr: "TX" },
  { fips: "49", name: "Utah", abbr: "UT" },
  { fips: "50", name: "Vermont", abbr: "VT" },
  { fips: "51", name: "Virginia", abbr: "VA" },
  { fips: "53", name: "Washington", abbr: "WA" },
  { fips: "54", name: "West Virginia", abbr: "WV" },
  { fips: "55", name: "Wisconsin", abbr: "WI" },
  { fips: "56", name: "Wyoming", abbr: "WY" },
];

/** Map from FIPS code to state info */
const FIPS_TO_STATE = new Map<string, StateInfo>(
  STATES.map((s) => [s.fips, s])
);

/** Map from abbreviation to state info */
const ABBR_TO_STATE = new Map<string, StateInfo>(
  STATES.map((s) => [s.abbr, s])
);

/**
 * ZIP code first-3-digits to state abbreviation mapping.
 * Covers all US ZIP code ranges.
 */
const ZIP3_TO_STATE: Record<string, string> = {};
function addZipRange(start: number, end: number, abbr: string) {
  for (let i = start; i <= end; i++) {
    ZIP3_TO_STATE[String(i).padStart(3, "0")] = abbr;
  }
}

// Populate ZIP3 ranges
addZipRange(35, 36, "AL");
addZipRange(995, 999, "AK");
addZipRange(85, 86, "AZ");
addZipRange(71, 72, "AR");
addZipRange(900, 961, "CA");
addZipRange(80, 81, "CO");
addZipRange(60, 69, "CT"); // 06xxx
addZipRange(197, 199, "DE");
addZipRange(200, 205, "DC");
addZipRange(320, 349, "FL");
addZipRange(300, 319, "GA");
addZipRange(967, 968, "HI");
addZipRange(832, 838, "ID");
addZipRange(600, 629, "IL");
addZipRange(460, 479, "IN");
addZipRange(500, 528, "IA");
addZipRange(660, 679, "KS");
addZipRange(400, 427, "KY");
addZipRange(700, 714, "LA");
addZipRange(39, 49, "ME"); // 039-049
addZipRange(206, 219, "MD");
addZipRange(10, 27, "MA"); // 010-027
addZipRange(480, 499, "MI");
addZipRange(550, 567, "MN");
addZipRange(386, 397, "MS");
addZipRange(630, 658, "MO");
addZipRange(590, 599, "MT");
addZipRange(680, 693, "NE");
addZipRange(889, 898, "NV");
addZipRange(30, 38, "NH"); // 030-038
addZipRange(70, 89, "NJ"); // 070-089
addZipRange(870, 884, "NM");
addZipRange(100, 149, "NY");
addZipRange(270, 289, "NC");
addZipRange(580, 588, "ND");
addZipRange(430, 459, "OH");
addZipRange(730, 749, "OK");
addZipRange(970, 979, "OR");
addZipRange(150, 196, "PA");
addZipRange(28, 29, "RI"); // 028-029
addZipRange(290, 299, "SC");
addZipRange(570, 577, "SD");
addZipRange(370, 385, "TN");
addZipRange(750, 799, "TX");
addZipRange(840, 847, "UT");
addZipRange(50, 59, "VT"); // 050-059
addZipRange(220, 246, "VA");
addZipRange(980, 994, "WA");
addZipRange(247, 268, "WV");
addZipRange(530, 549, "WI");
addZipRange(820, 831, "WY");

/**
 * Get state FIPS code from a ZIP code.
 */
export function getStateFipsFromZip(zipCode: string): string | null {
  const zip3 = zipCode.substring(0, 3);
  const abbr = ZIP3_TO_STATE[zip3];
  if (!abbr) return null;
  return ABBR_TO_STATE.get(abbr)?.fips ?? null;
}

/**
 * Get state name from a ZIP code.
 */
export function getStateNameFromZip(zipCode: string): string | null {
  const zip3 = zipCode.substring(0, 3);
  const abbr = ZIP3_TO_STATE[zip3];
  if (!abbr) return null;
  return ABBR_TO_STATE.get(abbr)?.name ?? null;
}

/**
 * Get state info from FIPS code.
 */
export function getStateByFips(fips: string): StateInfo | null {
  return FIPS_TO_STATE.get(fips) ?? null;
}

/**
 * Get all state FIPS codes (for fetching JOLTS data).
 */
export function getAllStateFips(): string[] {
  return STATES.map((s) => s.fips);
}

/**
 * Get all states with their info.
 */
export function getAllStates(): StateInfo[] {
  return [...STATES];
}
