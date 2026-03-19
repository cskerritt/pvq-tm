/**
 * BLS Industry-Occupation Staffing Pattern Lookup
 *
 * Estimates ZIP-level occupation employment by combining:
 *   - Census ZBP employment-by-industry (at the ZIP level)
 *   - BLS National Employment Matrix staffing shares (national, industry × occupation)
 *
 * Formula:
 *   Estimated ZIP Occupation Employment =
 *     Σ [ Local_Employment(zip, naics) × Staffing_Share(naics, soc) ]
 *
 * This is a simplified version using 2-digit NAICS → SOC major group
 * staffing shares. The full BLS matrix has ~300 industries × 800 occupations.
 * This initial implementation covers the most common pairings and uses
 * conservative share estimates derived from the BLS Employment Projections
 * national employment matrix.
 */

import type { ZBPResult } from "@/lib/api/census";

// ─── Types ─────────────────────────────────────────────────────────────

export interface StaffingShare {
  naics: string; // 2-digit NAICS code
  socMajor: string; // 2-digit SOC major group
  share: number; // fraction of industry employment in this occupation group (0-1)
}

// ─── Simplified Staffing Shares ────────────────────────────────────────
//
// Each entry represents: "X% of workers in NAICS industry Y belong to
// SOC major group Z." These are approximate national shares derived from
// the BLS Employment Projections industry-occupation matrix.
//
// Key: `${naics2}:${socMajor2}` → share (0 to 1)
//
// Only the top occupation groups per industry are included; minor shares
// (<1%) are omitted to keep the lookup manageable.

const STAFFING_SHARES: Record<string, number> = {
  // Construction (23)
  "23:47": 0.45, // Construction and Extraction
  "23:49": 0.12, // Installation, Maintenance, Repair
  "23:11": 0.06, // Management
  "23:43": 0.06, // Office and Administrative Support
  "23:53": 0.05, // Transportation and Material Moving

  // Manufacturing (31-33, using "31" as key)
  "31:51": 0.48, // Production
  "31:53": 0.10, // Transportation and Material Moving
  "31:49": 0.07, // Installation, Maintenance, Repair
  "31:17": 0.05, // Architecture and Engineering
  "31:43": 0.05, // Office and Administrative Support
  "31:11": 0.04, // Management

  // Retail Trade (44-45, using "44")
  "44:41": 0.55, // Sales and Related
  "44:43": 0.12, // Office and Administrative Support
  "44:53": 0.08, // Transportation and Material Moving
  "44:11": 0.05, // Management
  "44:35": 0.04, // Food Preparation

  // Transportation and Warehousing (48-49, using "48")
  "48:53": 0.60, // Transportation and Material Moving
  "48:43": 0.10, // Office and Administrative Support
  "48:49": 0.05, // Installation, Maintenance, Repair
  "48:11": 0.04, // Management

  // Information (51)
  "51:15": 0.25, // Computer and Mathematical
  "51:27": 0.15, // Arts, Design, Entertainment, Media
  "51:43": 0.10, // Office and Administrative Support
  "51:41": 0.08, // Sales and Related
  "51:11": 0.08, // Management

  // Finance and Insurance (52)
  "52:13": 0.30, // Business and Financial Operations
  "52:43": 0.25, // Office and Administrative Support
  "52:41": 0.15, // Sales and Related
  "52:11": 0.08, // Management

  // Real Estate (53)
  "53:41": 0.25, // Sales and Related
  "53:43": 0.20, // Office and Administrative Support
  "53:37": 0.15, // Building and Grounds
  "53:11": 0.08, // Management
  "53:49": 0.06, // Installation, Maintenance, Repair

  // Professional, Scientific, and Technical Services (54)
  "54:15": 0.18, // Computer and Mathematical
  "54:13": 0.15, // Business and Financial Operations
  "54:17": 0.10, // Architecture and Engineering
  "54:23": 0.08, // Legal
  "54:43": 0.10, // Office and Administrative Support
  "54:11": 0.10, // Management

  // Administrative and Support (56)
  "56:37": 0.20, // Building and Grounds
  "56:43": 0.18, // Office and Administrative Support
  "56:53": 0.10, // Transportation and Material Moving
  "56:33": 0.08, // Protective Service
  "56:39": 0.06, // Personal Care
  "56:11": 0.04, // Management

  // Educational Services (61)
  "61:25": 0.55, // Educational Instruction
  "61:43": 0.10, // Office and Administrative Support
  "61:21": 0.05, // Community and Social Service
  "61:11": 0.06, // Management

  // Health Care and Social Assistance (62)
  "62:29": 0.30, // Healthcare Practitioners
  "62:31": 0.20, // Healthcare Support
  "62:43": 0.12, // Office and Administrative Support
  "62:21": 0.06, // Community and Social Service
  "62:39": 0.05, // Personal Care
  "62:11": 0.05, // Management

  // Accommodation and Food Services (72)
  "72:35": 0.55, // Food Preparation
  "72:43": 0.08, // Office and Administrative Support
  "72:41": 0.06, // Sales
  "72:37": 0.05, // Building and Grounds
  "72:11": 0.04, // Management

  // Other Services (81)
  "81:49": 0.25, // Installation, Maintenance, Repair
  "81:39": 0.15, // Personal Care
  "81:43": 0.10, // Office and Administrative Support
  "81:41": 0.08, // Sales
  "81:11": 0.05, // Management

  // Wholesale Trade (42)
  "42:41": 0.25, // Sales and Related
  "42:53": 0.20, // Transportation and Material Moving
  "42:43": 0.12, // Office and Administrative Support
  "42:11": 0.06, // Management

  // Utilities (22)
  "22:49": 0.25, // Installation, Maintenance, Repair
  "22:47": 0.10, // Construction and Extraction
  "22:43": 0.12, // Office and Administrative Support
  "22:17": 0.08, // Architecture and Engineering
  "22:11": 0.08, // Management

  // Mining (21)
  "21:47": 0.35, // Construction and Extraction
  "21:53": 0.12, // Transportation and Material Moving
  "21:49": 0.10, // Installation, Maintenance, Repair
  "21:17": 0.08, // Architecture and Engineering
  "21:11": 0.06, // Management

  // Arts, Entertainment, Recreation (71)
  "71:27": 0.20, // Arts, Design, Entertainment, Media
  "71:39": 0.15, // Personal Care
  "71:35": 0.12, // Food Preparation
  "71:41": 0.08, // Sales
  "71:43": 0.08, // Office and Administrative Support

  // Agriculture (11 — NAICS, not SOC)
  "11:45": 0.50, // Farming, Fishing, Forestry
  "11:53": 0.10, // Transportation and Material Moving
  "11:11": 0.05, // Management

  // Public Administration (92)
  "92:33": 0.20, // Protective Service
  "92:43": 0.20, // Office and Administrative Support
  "92:11": 0.10, // Management
  "92:13": 0.08, // Business and Financial Operations
  "92:21": 0.06, // Community and Social Service

  // Management of Companies (55 — NAICS)
  "55:11": 0.25, // Management
  "55:13": 0.20, // Business and Financial Operations
  "55:43": 0.15, // Office and Administrative Support
  "55:15": 0.10, // Computer and Mathematical
};

/**
 * Normalize a NAICS code from ZBP data to a 2-digit key for staffing lookup.
 *
 * ZBP NAICS codes can be "23", "31-33", "44-45", "48-49", etc.
 * We map range codes to their first component for lookup.
 */
function normalizeNaics2(naics: string): string {
  // Handle range codes like "31-33" → "31", "44-45" → "44", "48-49" → "48"
  const dashIdx = naics.indexOf("-");
  if (dashIdx > 0) {
    return naics.substring(0, dashIdx);
  }
  // Take first 2 digits
  return naics.substring(0, 2);
}

/**
 * Extract the SOC major group (2-digit) from an O*NET SOC code.
 *
 * @param onetSocCode - e.g., "47-2061.00" or "29-1141"
 * @returns 2-digit SOC major group, e.g., "47"
 */
function getSocMajorGroup(onetSocCode: string): string {
  return onetSocCode.substring(0, 2);
}

/**
 * Estimate ZIP-level occupation employment using staffing patterns.
 *
 * Combines ZBP local industry employment with BLS national staffing
 * shares to produce an estimated count of workers in the target
 * occupation within the ZIP market.
 *
 * @param zbpData - ZIP Business Patterns employment by industry
 * @param targetSocCode - O*NET SOC code (e.g., "47-2061.00")
 * @returns Estimated number of workers in this occupation in the ZIP
 */
export function estimateZipOccupationEmployment(
  zbpData: ZBPResult[],
  targetSocCode: string
): { estimate: number; topIndustries: Array<{ naics: string; name: string; employment: number }> } {
  const socMajor = getSocMajorGroup(targetSocCode);
  let totalEstimate = 0;
  const industries: Array<{ naics: string; name: string; employment: number }> = [];

  for (const zbp of zbpData) {
    if (zbp.employment === null || zbp.employment <= 0) continue;

    const naics2 = normalizeNaics2(zbp.naics);
    const key = `${naics2}:${socMajor}`;
    const share = STAFFING_SHARES[key];

    if (share && share > 0) {
      const occEmployment = Math.round(zbp.employment * share);
      if (occEmployment > 0) {
        totalEstimate += occEmployment;
        industries.push({
          naics: zbp.naics,
          name: zbp.naicsDescription,
          employment: occEmployment,
        });
      }
    }
  }

  // Sort industries by estimated occupation employment descending
  industries.sort((a, b) => b.employment - a.employment);

  return {
    estimate: totalEstimate,
    topIndustries: industries.slice(0, 5), // top 5
  };
}
