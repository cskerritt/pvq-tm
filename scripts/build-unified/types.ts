/**
 * Unified Occupation record type.
 * One record per O*NET-SOC code, bundling data from all sources.
 */

export interface TraitDemand {
  value: number;       // normalized 0-4
  source: "ors" | "dot" | "onet" | "proxy";
  rawValue?: string;   // original value before normalization
}

export interface DOTTitleEntry {
  code: string;        // DOT 9-digit code
  title: string;
  svp: number;
  strength: string;
}

export interface UnifiedOccupation {
  // Identity
  onetCode: string;        // e.g., "11-1021.00"
  socCode: string;         // e.g., "11-1021" (6-digit base)
  title: string;           // O*NET title
  description: string;     // O*NET description

  // 24-trait demand profile (each with source provenance)
  traits: {
    // Cognitive (from GED/O*NET)
    reasoning: TraitDemand;
    math: TraitDemand;
    language: TraitDemand;
    // Perception (from O*NET abilities or DOT aptitudes)
    spatialPerception: TraitDemand;
    formPerception: TraitDemand;
    clericalPerception: TraitDemand;
    // Motor (from O*NET abilities)
    motorCoordination: TraitDemand;
    fingerDexterity: TraitDemand;
    manualDexterity: TraitDemand;
    eyeHandFoot: TraitDemand;
    colorDiscrimination: TraitDemand;
    // Physical (from ORS > DOT > O*NET)
    strength: TraitDemand;
    climbing: TraitDemand;
    stooping: TraitDemand;
    reaching: TraitDemand;
    talking: TraitDemand;
    hearing: TraitDemand;
    seeing: TraitDemand;
    // Environmental (from ORS > O*NET)
    workLocation: TraitDemand;
    cold: TraitDemand;
    heat: TraitDemand;
    wetness: TraitDemand;
    noise: TraitDemand;
    hazards: TraitDemand;
  };

  // VQ (McCroskey regression)
  vqScore: number;         // 68-158
  vqBand: number;          // 1-4

  // SVP (most conservative from DOT titles)
  svp: number;
  svpRange: [number, number];  // min, max across DOT titles
  jobZone: number | null;      // O*NET job zone (1-5)

  // Strength (most conservative from DOT titles)
  strengthLevel: string;       // S, L, M, H, V
  strengthRange: string[];     // all levels found

  // Wages (OEWS)
  wages: {
    median: number | null;
    mean: number | null;
    p10: number | null;
    p25: number | null;
    p75: number | null;
    p90: number | null;
  };

  // Employment & projections
  employment: number | null;
  projections: {
    growthPercent: number | null;
    annualOpenings: number | null;
  } | null;

  // DOT drill-down
  dotTitles: DOTTitleEntry[];
  dotTitleCount: number;

  // O*NET content (for skill transfer)
  tasks: string[];       // top task descriptions
  dwas: string[];        // detailed work activities
  tools: string[];       // tool/technology names

  // Data quality
  dataSources: string[];         // which sources contributed
  traitCoverage: number;         // 0-24, how many traits have data
  hasORS: boolean;
  hasDOT: boolean;
  hasOEWS: boolean;
  hasBLSProjections: boolean;
}
