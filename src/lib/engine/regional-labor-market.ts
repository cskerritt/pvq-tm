/**
 * Regional Labor Market Analysis Engine
 *
 * Generates a narrative analysis of the regional labor market
 * for the evaluee's location, comparing metro/state data against
 * national benchmarks and highlighting opportunities/risks.
 */

// ─── Interfaces ──────────────────────────────────────────────────────

export interface RegionalLaborMarketInput {
  // Location
  stateName: string | null;
  metroAreaName: string | null;

  // Aggregate labor market data
  postViableCount: number;
  postTotalEmployment: number;
  preViableCount: number | null;
  preTotalEmployment: number | null;

  // Area-level data
  postAreaEmployment: number | null;
  preAreaEmployment: number | null;

  // State JOLTS
  stateJoltsCurrent: number | null;
  stateJoltsPreInjury: number | null;

  // ECLR factor
  eclrFactor: number;

  // Per-occupation data for narrative
  occupationDetails: OccupationRegionalDetail[];
}

export interface OccupationRegionalDetail {
  title: string;
  nationalEmployment: number | null;
  areaEmployment: number | null;
  nationalMedianWage: number | null;
  areaMedianWage: number | null;
  joltsCurrentOpenings: number | null;
  joltsTrendLabel: string | null;
  projectedGrowthPct: number | null;
}

export interface RegionalLaborMarketAnalysis {
  // Geographic context
  locationSummary: string;

  // Wage comparison
  wagePremiumPct: number | null;       // how much area wages differ from national
  wagePremiumLabel: string;             // "above average", "below average", etc.

  // Employment concentration
  employmentConcentration: string;      // how the area compares to national
  areaToNationalRatio: number | null;   // area employment / national * scaling

  // JOLTS state overview
  stateJoltsNarrative: string | null;
  stateJoltsChangePct: number | null;   // current vs pre-injury change

  // Industry trends
  growingOccupations: string[];
  decliningOccupations: string[];
  stableOccupations: string[];

  // Overall narrative
  fullNarrative: string;

  // Risk indicators
  risks: string[];
  opportunities: string[];
}

// ─── Main Function ───────────────────────────────────────────────────

/**
 * Generate a comprehensive regional labor market analysis narrative.
 */
export function analyzeRegionalLaborMarket(
  input: RegionalLaborMarketInput
): RegionalLaborMarketAnalysis {
  const location = input.metroAreaName ?? input.stateName ?? "the evaluee's area";

  // ─── Location Summary ───────────────────────────────────────

  let locationSummary: string;
  if (input.metroAreaName && input.stateName) {
    locationSummary = `Analysis based on the ${input.metroAreaName} metropolitan area in ${input.stateName}.`;
  } else if (input.stateName) {
    locationSummary = `Analysis based on statewide data for ${input.stateName} (no metro area specified).`;
  } else {
    locationSummary = "No geographic area specified. Analysis uses national-level data only.";
  }

  // ─── Wage Premium ───────────────────────────────────────────

  let wagePremiumPct: number | null = null;
  let wagePremiumLabel: string;

  if (input.eclrFactor !== 1.0) {
    wagePremiumPct = Math.round((input.eclrFactor - 1.0) * 10000) / 100;
    if (wagePremiumPct > 15) {
      wagePremiumLabel = `significantly above average (+${wagePremiumPct.toFixed(1)}%)`;
    } else if (wagePremiumPct > 5) {
      wagePremiumLabel = `above average (+${wagePremiumPct.toFixed(1)}%)`;
    } else if (wagePremiumPct > -5) {
      wagePremiumLabel = `near the national average (${wagePremiumPct >= 0 ? "+" : ""}${wagePremiumPct.toFixed(1)}%)`;
    } else if (wagePremiumPct > -15) {
      wagePremiumLabel = `below average (${wagePremiumPct.toFixed(1)}%)`;
    } else {
      wagePremiumLabel = `significantly below average (${wagePremiumPct.toFixed(1)}%)`;
    }
  } else {
    wagePremiumLabel = "at the national average (no geographic adjustment)";
  }

  // ─── Employment Concentration ────────────────────────────────

  let employmentConcentration: string;
  let areaToNationalRatio: number | null = null;

  if (input.postAreaEmployment !== null && input.postTotalEmployment > 0) {
    // Compare area employment sum to national employment sum
    areaToNationalRatio = input.postAreaEmployment / input.postTotalEmployment;
    const pctOfNational = Math.round(areaToNationalRatio * 10000) / 100;

    if (pctOfNational > 5) {
      employmentConcentration = `${location} has strong employment concentration (${pctOfNational.toFixed(1)}% of national total for viable occupations)`;
    } else if (pctOfNational > 2) {
      employmentConcentration = `${location} has moderate employment concentration (${pctOfNational.toFixed(1)}% of national total)`;
    } else if (pctOfNational > 0.5) {
      employmentConcentration = `${location} has typical employment levels (${pctOfNational.toFixed(1)}% of national total)`;
    } else {
      employmentConcentration = `${location} has limited local employment for viable occupations (${pctOfNational.toFixed(2)}% of national total)`;
    }
  } else {
    employmentConcentration = "Area-level employment data is not available for comparison.";
  }

  // ─── State JOLTS Narrative ──────────────────────────────────

  let stateJoltsNarrative: string | null = null;
  let stateJoltsChangePct: number | null = null;

  if (input.stateJoltsCurrent !== null && input.stateName) {
    const current = input.stateJoltsCurrent;
    stateJoltsNarrative = `${input.stateName} currently has approximately ${formatThousands(current)} job openings across all industries.`;

    if (input.stateJoltsPreInjury !== null && input.stateJoltsPreInjury > 0) {
      stateJoltsChangePct = Math.round(
        ((current - input.stateJoltsPreInjury) / input.stateJoltsPreInjury) * 10000
      ) / 100;

      if (Math.abs(stateJoltsChangePct) < 5) {
        stateJoltsNarrative += ` This is roughly unchanged from the date of injury (${formatThousands(input.stateJoltsPreInjury)}).`;
      } else if (stateJoltsChangePct > 0) {
        stateJoltsNarrative += ` This represents a ${stateJoltsChangePct.toFixed(1)}% increase from the date of injury (${formatThousands(input.stateJoltsPreInjury)}).`;
      } else {
        stateJoltsNarrative += ` This represents a ${Math.abs(stateJoltsChangePct).toFixed(1)}% decrease from the date of injury (${formatThousands(input.stateJoltsPreInjury)}).`;
      }
    }
  }

  // ─── Industry Trends ────────────────────────────────────────

  const growingOccupations: string[] = [];
  const decliningOccupations: string[] = [];
  const stableOccupations: string[] = [];

  for (const occ of input.occupationDetails) {
    const label = occ.joltsTrendLabel;
    if (label === "strongly_growing" || label === "growing") {
      growingOccupations.push(occ.title);
    } else if (label === "strongly_declining" || label === "declining") {
      decliningOccupations.push(occ.title);
    } else {
      stableOccupations.push(occ.title);
    }
  }

  // ─── Risks and Opportunities ────────────────────────────────

  const risks: string[] = [];
  const opportunities: string[] = [];

  if (decliningOccupations.length > 0) {
    risks.push(
      `${decliningOccupations.length} viable occupation(s) are in declining industries: ${decliningOccupations.slice(0, 3).join(", ")}${decliningOccupations.length > 3 ? `, and ${decliningOccupations.length - 3} more` : ""}`
    );
  }

  if (wagePremiumPct !== null && wagePremiumPct < -10) {
    risks.push(
      `Area wages are ${Math.abs(wagePremiumPct).toFixed(1)}% below national average, reducing earning capacity`
    );
  }

  if (input.postAreaEmployment !== null && input.postAreaEmployment < 500) {
    risks.push(
      `Limited local employment opportunities (only ${input.postAreaEmployment.toLocaleString()} positions across viable occupations in the metro area)`
    );
  }

  if (stateJoltsChangePct !== null && stateJoltsChangePct < -15) {
    risks.push(
      `State job openings have decreased ${Math.abs(stateJoltsChangePct).toFixed(1)}% since date of injury`
    );
  }

  if (growingOccupations.length > 0) {
    opportunities.push(
      `${growingOccupations.length} viable occupation(s) are in growing industries: ${growingOccupations.slice(0, 3).join(", ")}${growingOccupations.length > 3 ? `, and ${growingOccupations.length - 3} more` : ""}`
    );
  }

  if (wagePremiumPct !== null && wagePremiumPct > 10) {
    opportunities.push(
      `Area wages are ${wagePremiumPct.toFixed(1)}% above national average, enhancing earning potential`
    );
  }

  if (stateJoltsChangePct !== null && stateJoltsChangePct > 15) {
    opportunities.push(
      `State job openings have increased ${stateJoltsChangePct.toFixed(1)}% since date of injury`
    );
  }

  if (input.postAreaEmployment !== null && input.postAreaEmployment > 5000) {
    opportunities.push(
      `Strong local employment base (${input.postAreaEmployment.toLocaleString()} positions across viable occupations in the metro area)`
    );
  }

  // ─── Full Narrative ─────────────────────────────────────────

  const paragraphs: string[] = [];

  // Paragraph 1: Location and wage context
  paragraphs.push(
    `${locationSummary} Wages in ${location} are ${wagePremiumLabel} compared to national benchmarks.`
  );

  // Paragraph 2: Employment landscape
  if (input.postViableCount > 0) {
    let empParagraph = `Of the ${input.postViableCount} viable post-injury occupation(s), `;
    if (growingOccupations.length > 0 && decliningOccupations.length > 0) {
      empParagraph += `${growingOccupations.length} are in growing industries and ${decliningOccupations.length} are in declining industries. `;
    } else if (growingOccupations.length > 0) {
      empParagraph += `${growingOccupations.length} are in growing industries. `;
    } else if (decliningOccupations.length > 0) {
      empParagraph += `${decliningOccupations.length} are in declining industries. `;
    } else {
      empParagraph += `most are in stable industries. `;
    }
    empParagraph += employmentConcentration;
    paragraphs.push(empParagraph);
  }

  // Paragraph 3: State JOLTS
  if (stateJoltsNarrative) {
    paragraphs.push(stateJoltsNarrative);
  }

  // Paragraph 4: Pre/post comparison
  if (input.preViableCount !== null && input.preViableCount > 0) {
    const lostCount = input.preViableCount - input.postViableCount;
    const lossPct = Math.round((lostCount / input.preViableCount) * 100);
    if (lostCount > 0) {
      paragraphs.push(
        `The evaluee lost access to ${lostCount} of ${input.preViableCount} previously viable occupations (${lossPct}% reduction) due to post-injury functional limitations.`
      );
    } else {
      paragraphs.push(
        `The evaluee retains access to all ${input.preViableCount} previously viable occupations despite post-injury limitations.`
      );
    }
  }

  return {
    locationSummary,
    wagePremiumPct,
    wagePremiumLabel,
    employmentConcentration,
    areaToNationalRatio,
    stateJoltsNarrative,
    stateJoltsChangePct,
    growingOccupations,
    decliningOccupations,
    stableOccupations,
    fullNarrative: paragraphs.join("\n\n"),
    risks,
    opportunities,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────

/** Format thousands value (JOLTS data is in thousands) */
function formatThousands(valueInThousands: number): string {
  const actual = valueInThousands * 1000;
  return `${Math.round(actual).toLocaleString()}`;
}
