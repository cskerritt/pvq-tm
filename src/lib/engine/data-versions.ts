/**
 * Data Version Manifest
 *
 * Documents the exact versions of all external data sources used by PVQ-TM.
 * This manifest enables reproducibility by ensuring analyses can be tied
 * to specific data vintages.
 *
 * Updated: 2026-03-27
 */

export const DATA_VERSIONS = {
  /** Dictionary of Occupational Titles - analyst-rated trait data */
  dot: {
    version: "4th Edition, Revised (1991)",
    publisher: "U.S. Department of Labor",
    traitsCovered: [
      "GED (R/M/L)",
      "SVP",
      "Aptitudes (G/V/N/S/P/Q/K/F/M/E/C)",
      "Physical Demands",
      "Environmental Conditions",
      "Temperaments",
    ],
    notes:
      "Last revised 1991; no longer updated but remains standard in vocational testimony",
  },

  /** O*NET OnLine - incumbent survey data */
  onet: {
    version: "29.1",
    releaseDate: "November 2024",
    publisher: "U.S. Department of Labor/ETA",
    url: "https://www.onetcenter.org/database.html",
    dataElements: [
      "Tasks",
      "DWAs",
      "Knowledge",
      "Skills",
      "Abilities",
      "Work Activities",
      "Work Context",
      "Work Styles",
      "Job Zones",
    ],
  },

  /** Occupational Employment and Wage Statistics */
  oews: {
    version: "May 2024",
    publisher: "Bureau of Labor Statistics",
    url: "https://www.bls.gov/oes/",
    dataElements: [
      "Employment",
      "Median/Mean wages",
      "Percentile wages (10/25/75/90)",
    ],
  },

  /** Employment Projections */
  blsProjections: {
    version: "2022-2032",
    publisher: "Bureau of Labor Statistics",
    url: "https://www.bls.gov/emp/",
    dataElements: ["Projected employment change", "Annual openings"],
  },

  /** Job Openings and Labor Turnover Survey */
  jolts: {
    version: "Current through February 2025",
    publisher: "Bureau of Labor Statistics",
    url: "https://www.bls.gov/jlt/",
    dataElements: [
      "Industry-level job openings",
      "State-level job openings",
    ],
  },

  /** Occupational Requirements Survey */
  ors: {
    version: "2023",
    publisher: "Bureau of Labor Statistics",
    url: "https://www.bls.gov/ors/",
    dataElements: [
      "Physical demands",
      "Cognitive demands",
      "Environmental conditions",
    ],
  },

  /** VQS Regression Coefficients */
  vqsRegression: {
    source:
      "McCroskey, B.J., Dennis, M.C., Wilkinson, L., et al. (2011 draft)",
    year: 2007,
    description: "Year 2007 SOC data curvilinear regression results",
    intercept: 34.56707,
    numberOfTraits: 24,
    bandCount: 4,
  },
} as const;

/** Returns a summary string for inclusion in reports */
export function getDataVersionSummary(): string {
  return [
    `DOT: ${DATA_VERSIONS.dot.version}`,
    `O*NET: ${DATA_VERSIONS.onet.version} (${DATA_VERSIONS.onet.releaseDate})`,
    `OEWS: ${DATA_VERSIONS.oews.version}`,
    `BLS Projections: ${DATA_VERSIONS.blsProjections.version}`,
    `JOLTS: ${DATA_VERSIONS.jolts.version}`,
    `ORS: ${DATA_VERSIONS.ors.version}`,
    `VQS Regression: ${DATA_VERSIONS.vqsRegression.source}`,
  ].join("\n");
}

export type DataVersions = typeof DATA_VERSIONS;
