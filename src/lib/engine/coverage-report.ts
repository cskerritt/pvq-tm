/**
 * ORS Coverage Report Utility
 *
 * Generates statistics on how much of the O*NET occupation universe
 * has ORS data coverage, and what proxy strategies would fill gaps.
 *
 * Used for system diagnostics, Daubert disclosure, and identifying
 * which SOC groups would benefit most from additional ORS data.
 */

import type { ORSDataEntry } from "./ors-proxy";
import { getORSCoverageLevel, toSOC6 } from "./ors-proxy";

// ─── Types ───────────────────────────────────────────────────────────

export interface CoverageReport {
  /** Total O*NET occupations in the system */
  totalONET: number;
  /** Occupations with direct ORS data */
  withORS: number;
  /** Occupations that can inherit from SOC group ORS data */
  withORSGroup: number;
  /** Occupations with similar-occupation ORS transfer potential */
  withSimilarORS: number;
  /** Occupations that have O*NET Work Context data for trait derivation */
  withONETContext: number;
  /** Occupations that only have DOT data (no ORS or O*NET context) */
  withDOTOnly: number;
  /** Occupations with no physical demand data from any source */
  withNoData: number;
  /** Coverage breakdown by SOC major group (2-digit code) */
  coverageBySOCMajorGroup: Record<string, {
    total: number;
    covered: number;
    percentage: number;
    groupName: string;
  }>;
  /** Coverage breakdown by strategy */
  coverageByStrategy: {
    directORS: number;
    groupInheritance: number;
    similarTransfer: number;
    onetContext: number;
    dotOnly: number;
    noData: number;
  };
  /** Overall coverage percentage (direct + group) */
  primaryCoveragePct: number;
  /** Overall coverage percentage (all strategies) */
  totalCoveragePct: number;
}

// ─── SOC Major Group Labels ──────────────────────────────────────────

const SOC_MAJOR_GROUP_NAMES: Record<string, string> = {
  "11": "Management",
  "13": "Business and Financial Operations",
  "15": "Computer and Mathematical",
  "17": "Architecture and Engineering",
  "19": "Life, Physical, and Social Science",
  "21": "Community and Social Service",
  "23": "Legal",
  "25": "Educational Instruction and Library",
  "27": "Arts, Design, Entertainment, Sports, and Media",
  "29": "Healthcare Practitioners and Technical",
  "31": "Healthcare Support",
  "33": "Protective Service",
  "35": "Food Preparation and Serving Related",
  "37": "Building and Grounds Cleaning and Maintenance",
  "39": "Personal Care and Service",
  "41": "Sales and Related",
  "43": "Office and Administrative Support",
  "45": "Farming, Fishing, and Forestry",
  "47": "Construction and Extraction",
  "49": "Installation, Maintenance, and Repair",
  "51": "Production",
  "53": "Transportation and Material Moving",
  "55": "Military Specific",
};

// ─── Main Report Generator ──────────────────────────────────────────

/**
 * Generate a comprehensive ORS coverage report.
 *
 * @param allONETCodes - All O*NET-SOC codes in the system
 * @param orsData - Map of SOC6 codes to ORS data entries
 * @param onetContextCodes - Set of O*NET codes that have Work Context data
 * @param dotCrosswalkCodes - Set of O*NET codes that have DOT crosswalk mappings
 */
export function generateCoverageReport(
  allONETCodes: string[],
  orsData: Map<string, ORSDataEntry>,
  onetContextCodes?: Set<string>,
  dotCrosswalkCodes?: Set<string>
): CoverageReport {
  const majorGroupCounts: Record<string, { total: number; covered: number }> = {};
  const coverageByStrategy = {
    directORS: 0,
    groupInheritance: 0,
    similarTransfer: 0,
    onetContext: 0,
    dotOnly: 0,
    noData: 0,
  };

  let withORS = 0;
  let withORSGroup = 0;
  let withONETContext = 0;
  let withDOTOnly = 0;
  let withNoData = 0;

  for (const code of allONETCodes) {
    const soc6 = toSOC6(code);
    const majorGroup = soc6.slice(0, 2);

    // Initialize major group counters
    if (!majorGroupCounts[majorGroup]) {
      majorGroupCounts[majorGroup] = { total: 0, covered: 0 };
    }
    majorGroupCounts[majorGroup].total++;

    // Check ORS coverage level
    const level = getORSCoverageLevel(code, orsData);

    if (level === "direct") {
      withORS++;
      coverageByStrategy.directORS++;
      majorGroupCounts[majorGroup].covered++;
    } else if (level === "group") {
      withORSGroup++;
      coverageByStrategy.groupInheritance++;
      majorGroupCounts[majorGroup].covered++;
    } else {
      // No ORS — check other sources
      const hasContext = onetContextCodes?.has(soc6) ?? false;
      const hasDOT = dotCrosswalkCodes?.has(soc6) ?? false;

      if (hasContext) {
        withONETContext++;
        coverageByStrategy.onetContext++;
      } else if (hasDOT) {
        withDOTOnly++;
        coverageByStrategy.dotOnly++;
      } else {
        withNoData++;
        coverageByStrategy.noData++;
      }
    }
  }

  const totalONET = allONETCodes.length;
  const primaryCoverage = withORS + withORSGroup;
  const totalCoverage = totalONET - withNoData;

  // Build major group breakdown
  const coverageBySOCMajorGroup: CoverageReport["coverageBySOCMajorGroup"] = {};
  for (const [group, counts] of Object.entries(majorGroupCounts)) {
    coverageBySOCMajorGroup[group] = {
      ...counts,
      percentage: counts.total > 0 ? Math.round((counts.covered / counts.total) * 100) : 0,
      groupName: SOC_MAJOR_GROUP_NAMES[group] ?? `Unknown (${group})`,
    };
  }

  return {
    totalONET,
    withORS,
    withORSGroup,
    withSimilarORS: 0, // Requires CPC similarity data (runtime-only)
    withONETContext,
    withDOTOnly,
    withNoData,
    coverageBySOCMajorGroup,
    coverageByStrategy,
    primaryCoveragePct: totalONET > 0 ? Math.round((primaryCoverage / totalONET) * 100) : 0,
    totalCoveragePct: totalONET > 0 ? Math.round((totalCoverage / totalONET) * 100) : 0,
  };
}

/**
 * Generate a human-readable summary of the coverage report.
 * Suitable for inclusion in Daubert disclosures or system documentation.
 */
export function formatCoverageReport(report: CoverageReport): string {
  const lines: string[] = [];

  lines.push("=== ORS Coverage Report ===");
  lines.push("");
  lines.push(`Total O*NET occupations: ${report.totalONET}`);
  lines.push(`Direct ORS coverage: ${report.withORS} (${Math.round((report.withORS / report.totalONET) * 100)}%)`);
  lines.push(`SOC group inheritance: ${report.withORSGroup} additional`);
  lines.push(`Primary coverage (ORS + group): ${report.withORS + report.withORSGroup} (${report.primaryCoveragePct}%)`);
  lines.push("");
  lines.push("--- Fallback Strategy Distribution ---");
  lines.push(`O*NET Work Context: ${report.withONETContext}`);
  lines.push(`DOT only: ${report.withDOTOnly}`);
  lines.push(`No data: ${report.withNoData}`);
  lines.push(`Total coverage (all strategies): ${report.totalCoveragePct}%`);
  lines.push("");
  lines.push("--- Coverage by SOC Major Group ---");

  // Sort by coverage percentage ascending (worst first)
  const sortedGroups = Object.entries(report.coverageBySOCMajorGroup)
    .sort(([, a], [, b]) => a.percentage - b.percentage);

  for (const [code, data] of sortedGroups) {
    lines.push(
      `  ${code} ${data.groupName}: ${data.covered}/${data.total} (${data.percentage}%)`
    );
  }

  return lines.join("\n");
}
