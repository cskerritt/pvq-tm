/**
 * SOC Major Group → JOLTS Industry (NAICS) mapping.
 *
 * JOLTS data is published at the industry level (NAICS), not the
 * occupation level (SOC). This mapping assigns each SOC major group
 * to the primary JOLTS industry code that best represents where
 * those occupations are concentrated.
 *
 * Some SOC groups (like Management, 11) span many industries —
 * in those cases we use cross-industry aggregates.
 *
 * JOLTS industry codes are the 6-digit codes used in BLS JOLTS series IDs.
 */

interface IndustryMapping {
  naicsCode: string;
  name: string;
}

/**
 * Map from 2-digit SOC major group to primary JOLTS industry.
 * Covers all 23 SOC major groups (11 through 55).
 */
const SOC_TO_JOLTS_INDUSTRY: Record<string, IndustryMapping> = {
  // 11 - Management Occupations → cross-industry (Total private)
  "11": { naicsCode: "100000", name: "Total private" },

  // 13 - Business and Financial Operations → Financial activities
  "13": { naicsCode: "520000", name: "Financial activities" },

  // 15 - Computer and Mathematical → Information
  "15": { naicsCode: "510000", name: "Information" },

  // 17 - Architecture and Engineering → Construction
  "17": { naicsCode: "230000", name: "Construction" },

  // 19 - Life, Physical, and Social Science → Education and health services
  "19": { naicsCode: "600000", name: "Education and health services" },

  // 21 - Community and Social Service → Health care and social assistance
  "21": { naicsCode: "620000", name: "Health care and social assistance" },

  // 23 - Legal → Financial activities (legal services are part of professional services)
  "23": { naicsCode: "520000", name: "Financial activities" },

  // 25 - Educational Instruction and Library → Educational services
  "25": { naicsCode: "610000", name: "Educational services" },

  // 27 - Arts, Design, Entertainment, Sports, and Media → Arts, entertainment, and recreation
  "27": { naicsCode: "710000", name: "Arts, entertainment, and recreation" },

  // 29 - Healthcare Practitioners and Technical → Health care and social assistance
  "29": { naicsCode: "620000", name: "Health care and social assistance" },

  // 31 - Healthcare Support → Health care and social assistance
  "31": { naicsCode: "620000", name: "Health care and social assistance" },

  // 33 - Protective Service → Government
  "33": { naicsCode: "900000", name: "Government" },

  // 35 - Food Preparation and Serving Related → Accommodation and food services
  "35": { naicsCode: "720000", name: "Accommodation and food services" },

  // 37 - Building and Grounds Cleaning and Maintenance → Other services
  "37": { naicsCode: "810000", name: "Other services" },

  // 39 - Personal Care and Service → Other services
  "39": { naicsCode: "810000", name: "Other services" },

  // 41 - Sales and Related → Retail trade
  "41": { naicsCode: "440000", name: "Retail trade" },

  // 43 - Office and Administrative Support → Total private (cross-industry)
  "43": { naicsCode: "100000", name: "Total private" },

  // 45 - Farming, Fishing, and Forestry → Total nonfarm
  "45": { naicsCode: "000000", name: "Total nonfarm" },

  // 47 - Construction and Extraction → Construction
  "47": { naicsCode: "230000", name: "Construction" },

  // 49 - Installation, Maintenance, and Repair → Construction
  "49": { naicsCode: "230000", name: "Construction" },

  // 51 - Production → Manufacturing
  "51": { naicsCode: "300000", name: "Manufacturing" },

  // 53 - Transportation and Material Moving → Trade, transportation, and utilities
  "53": { naicsCode: "400000", name: "Trade, transportation, and utilities" },

  // 55 - Military Specific → Government
  "55": { naicsCode: "900000", name: "Government" },
};

/**
 * Get the primary JOLTS industry NAICS code for a given O*NET SOC code.
 *
 * @param onetSocCode - O*NET code like "29-1141.00" or base SOC like "29-1141"
 * @returns 6-digit NAICS code (e.g., "620000") or "000000" (Total nonfarm) as fallback
 */
export function getPrimaryIndustryForSOC(onetSocCode: string): string {
  const majorGroup = onetSocCode.substring(0, 2);
  return SOC_TO_JOLTS_INDUSTRY[majorGroup]?.naicsCode ?? "000000";
}

/**
 * Get the industry name for a given O*NET SOC code.
 *
 * @param onetSocCode - O*NET code like "29-1141.00"
 * @returns Human-readable industry name
 */
export function getIndustryNameForSOC(onetSocCode: string): string {
  const majorGroup = onetSocCode.substring(0, 2);
  return SOC_TO_JOLTS_INDUSTRY[majorGroup]?.name ?? "Total nonfarm";
}

/**
 * Get the full mapping entry for a SOC code.
 */
export function getIndustryMappingForSOC(
  onetSocCode: string
): IndustryMapping {
  const majorGroup = onetSocCode.substring(0, 2);
  return (
    SOC_TO_JOLTS_INDUSTRY[majorGroup] ?? {
      naicsCode: "000000",
      name: "Total nonfarm",
    }
  );
}
