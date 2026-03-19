/**
 * Viable Set Analyzer
 *
 * Analyzes the set of viable (non-excluded) occupations to determine
 * coherence: are they a tightly clustered group of similar jobs, or a
 * scattered set of unrelated occupations?
 *
 * Used in narrative report generation and vocational opinion summaries
 * to characterize the evaluee's transferable-skills landscape.
 */

import { type PVQResult } from "./pvq";
import { TRAIT_KEYS, TRAIT_LABELS, type TraitKey } from "./traits";

// ─── SOC Major Group Labels ────────────────────────────────────────────

/** SOC 2-digit major group labels for cluster naming. */
const SOC_MAJOR_GROUPS: Record<string, string> = {
  "11": "Management",
  "13": "Business/Financial",
  "15": "Computer/Mathematical",
  "17": "Architecture/Engineering",
  "19": "Life/Physical/Social Science",
  "21": "Community/Social Service",
  "23": "Legal",
  "25": "Education/Training/Library",
  "27": "Arts/Design/Entertainment/Media",
  "29": "Healthcare Practitioners",
  "31": "Healthcare Support",
  "33": "Protective Service",
  "35": "Food Preparation/Serving",
  "37": "Building/Grounds Maintenance",
  "39": "Personal Care/Service",
  "41": "Sales",
  "43": "Office/Administrative Support",
  "45": "Farming/Fishing/Forestry",
  "47": "Construction/Extraction",
  "49": "Installation/Maintenance/Repair",
  "51": "Production",
  "53": "Transportation/Material Moving",
};

// ─── Interfaces ────────────────────────────────────────────────────────

export interface ViableSetAnalysis {
  totalViable: number;

  /** Coherence score (0-100). */
  coherenceScore: number;
  coherenceLabel:
    | "highly_coherent"
    | "moderately_coherent"
    | "diverse"
    | "scattered";

  /** Clusters of similar occupations. */
  clusters: OccupationCluster[];

  /** Occupations with strong skill transfer from PRW (STQ > 60). */
  coreOccupations: string[];
  /** Occupations with limited skill transfer / stretch placements (STQ < 40). */
  peripheralOccupations: string[];

  /** Trait demand range across the entire viable set. */
  traitDemandRange: TraitRange[];

  /** Auto-generated narrative summary of the viable set. */
  narrativeSummary: string;
}

export interface OccupationCluster {
  /** Auto-generated cluster name based on SOC group or common traits. */
  name: string;
  /** Occupation titles in this cluster. */
  occupations: string[];
  /** Average STQ across cluster members. */
  avgStq: number;
  /** Average PVQ across cluster members. */
  avgPvq: number;
  /** Traits that all cluster members require at similar levels. */
  commonTraitStrengths: string[];
}

export interface TraitRange {
  trait: string;
  label: string;
  minDemand: number;
  maxDemand: number;
  avgDemand: number;
  /** Range <= 1: all occupations need similar level. */
  isNarrow: boolean;
  /** Range > 2: very different demands across occupations. */
  isWide: boolean;
}

export interface ViableOccupationInput {
  title: string;
  pvqResult: PVQResult;
  /** The 24-trait demand vector for this occupation. */
  traitDemands?: Record<string, number | null>;
  socCode?: string;
  dotCode?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Extract the 2-digit SOC major group prefix from a SOC code.
 * Handles formats like "43-9061", "43-9061.00", or "439061".
 */
function socPrefix(socCode: string): string {
  const cleaned = socCode.replace(/[^0-9]/g, "");
  return cleaned.slice(0, 2);
}

/**
 * Round a number to two decimal places.
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Compute the average of a numeric array. Returns 0 for empty arrays.
 */
function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Compute cosine-like similarity between two trait demand vectors.
 * Both vectors are Record<string, number | null>; null values are skipped.
 * Returns a value between 0 and 100.
 */
function traitVectorSimilarity(
  a: Record<string, number | null>,
  b: Record<string, number | null>
): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  let pairsUsed = 0;

  for (const key of TRAIT_KEYS) {
    const va = a[key];
    const vb = b[key];
    if (va === null || va === undefined || vb === null || vb === undefined) {
      continue;
    }
    dotProduct += va * vb;
    normA += va * va;
    normB += vb * vb;
    pairsUsed++;
  }

  if (pairsUsed === 0 || normA === 0 || normB === 0) return 0;

  const cosine = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  // Cosine similarity ranges from -1 to 1; clamp and scale to 0-100
  return round2(Math.max(0, Math.min(1, cosine)) * 100);
}

/**
 * Identify the dominant trait strengths for a set of trait demand vectors.
 * Returns traits whose average demand is >= 2 (moderate) and whose range
 * across the group is narrow (<= 1).
 */
function findCommonTraitStrengths(
  traitDemandSets: Record<string, number | null>[]
): string[] {
  if (traitDemandSets.length === 0) return [];

  const common: string[] = [];

  for (const key of TRAIT_KEYS) {
    const values: number[] = [];
    for (const demands of traitDemandSets) {
      const v = demands[key];
      if (v !== null && v !== undefined) values.push(v);
    }
    if (values.length === 0) continue;

    const avgVal = avg(values);
    const range = Math.max(...values) - Math.min(...values);

    // Trait is a "common strength" if avg demand is moderate+ and range is narrow
    if (avgVal >= 2 && range <= 1) {
      common.push(TRAIT_LABELS[key as TraitKey] ?? key);
    }
  }

  return common;
}

/**
 * Label a coherence score.
 */
function labelCoherence(
  score: number
): "highly_coherent" | "moderately_coherent" | "diverse" | "scattered" {
  if (score > 70) return "highly_coherent";
  if (score > 50) return "moderately_coherent";
  if (score > 30) return "diverse";
  return "scattered";
}

// ─── Clustering ────────────────────────────────────────────────────────

/**
 * Group occupations by SOC 2-digit prefix.
 * Returns a map from SOC prefix to indices in the input array.
 */
function clusterBySOC(
  occupations: ViableOccupationInput[]
): Map<string, number[]> {
  const groups = new Map<string, number[]>();

  for (let i = 0; i < occupations.length; i++) {
    const soc = occupations[i].socCode;
    if (!soc) continue;
    const prefix = socPrefix(soc);
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix)!.push(i);
  }

  return groups;
}

/**
 * Group occupations by PVQ score bands when SOC codes are unavailable.
 * High: PVQ >= 60, Medium: 30-59, Low: < 30.
 */
function clusterByPVQBand(
  occupations: ViableOccupationInput[]
): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  groups.set("High PVQ (60+)", []);
  groups.set("Medium PVQ (30-59)", []);
  groups.set("Low PVQ (<30)", []);

  for (let i = 0; i < occupations.length; i++) {
    const pvq = occupations[i].pvqResult.pvq;
    if (pvq >= 60) {
      groups.get("High PVQ (60+)")!.push(i);
    } else if (pvq >= 30) {
      groups.get("Medium PVQ (30-59)")!.push(i);
    } else {
      groups.get("Low PVQ (<30)")!.push(i);
    }
  }

  // Remove empty groups
  for (const [key, indices] of groups) {
    if (indices.length === 0) groups.delete(key);
  }

  return groups;
}

/**
 * Build OccupationCluster objects from index groups.
 */
function buildClusters(
  occupations: ViableOccupationInput[],
  groups: Map<string, number[]>
): OccupationCluster[] {
  const clusters: OccupationCluster[] = [];

  for (const [groupKey, indices] of groups) {
    if (indices.length === 0) continue;

    const members = indices.map((i) => occupations[i]);
    const titles = members.map((m) => m.title);
    const stqs = members.map((m) => m.pvqResult.stq);
    const pvqs = members.map((m) => m.pvqResult.pvq);

    // Determine cluster name
    let name: string;
    if (SOC_MAJOR_GROUPS[groupKey]) {
      name = SOC_MAJOR_GROUPS[groupKey];
    } else {
      name = groupKey;
    }

    // Find common trait strengths
    const traitSets = members
      .map((m) => m.traitDemands)
      .filter((d): d is Record<string, number | null> => d !== undefined);

    const commonTraits = findCommonTraitStrengths(traitSets);

    clusters.push({
      name,
      occupations: titles,
      avgStq: round2(avg(stqs)),
      avgPvq: round2(avg(pvqs)),
      commonTraitStrengths: commonTraits,
    });
  }

  // Sort clusters by size descending
  clusters.sort((a, b) => b.occupations.length - a.occupations.length);

  return clusters;
}

// ─── Trait Demand Range ────────────────────────────────────────────────

/**
 * Compute the min/max/avg demand for each trait across all viable occupations.
 */
function computeTraitDemandRanges(
  occupations: ViableOccupationInput[]
): TraitRange[] {
  const ranges: TraitRange[] = [];

  for (const key of TRAIT_KEYS) {
    const values: number[] = [];

    for (const occ of occupations) {
      if (!occ.traitDemands) continue;
      const v = occ.traitDemands[key];
      if (v !== null && v !== undefined) values.push(v);
    }

    if (values.length === 0) {
      ranges.push({
        trait: key,
        label: TRAIT_LABELS[key],
        minDemand: 0,
        maxDemand: 0,
        avgDemand: 0,
        isNarrow: true,
        isWide: false,
      });
      continue;
    }

    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const avgVal = round2(avg(values));
    const range = maxVal - minVal;

    ranges.push({
      trait: key,
      label: TRAIT_LABELS[key],
      minDemand: round2(minVal),
      maxDemand: round2(maxVal),
      avgDemand: avgVal,
      isNarrow: range <= 1,
      isWide: range > 2,
    });
  }

  return ranges;
}

// ─── Coherence Score ───────────────────────────────────────────────────

/**
 * Compute coherence score based on pairwise trait vector similarity.
 * Falls back to STQ-based scoring when trait demands are unavailable.
 */
function computeCoherenceScore(
  occupations: ViableOccupationInput[]
): number {
  if (occupations.length <= 1) return 100;

  // Try trait-demand-based pairwise similarity first
  const withTraits = occupations.filter(
    (o) => o.traitDemands && Object.keys(o.traitDemands).length > 0
  );

  if (withTraits.length >= 2) {
    let totalSim = 0;
    let pairs = 0;

    for (let i = 0; i < withTraits.length; i++) {
      for (let j = i + 1; j < withTraits.length; j++) {
        totalSim += traitVectorSimilarity(
          withTraits[i].traitDemands!,
          withTraits[j].traitDemands!
        );
        pairs++;
      }
    }

    if (pairs > 0) return round2(totalSim / pairs);
  }

  // Fallback: use average STQ as a proxy for coherence
  const stqs = occupations.map((o) => o.pvqResult.stq);
  return round2(avg(stqs));
}

// ─── Narrative Generation ──────────────────────────────────────────────

/**
 * Generate a plain-English narrative summary of the viable set analysis.
 */
function generateNarrative(
  occupations: ViableOccupationInput[],
  coherenceLabel: string,
  clusters: OccupationCluster[],
  coreCount: number,
  peripheralCount: number
): string {
  const n = occupations.length;

  if (n === 0) {
    return "No viable occupations were identified in the analysis.";
  }

  if (n === 1) {
    return `Only 1 viable occupation was identified: ${occupations[0].title}. The viable set is too small to assess coherence or clustering.`;
  }

  // Describe the cluster landscape
  const clusterNames = clusters.map((c) => c.name);
  let clusterPhrase: string;
  if (clusterNames.length === 1) {
    clusterPhrase = `centered on ${clusterNames[0]}`;
  } else if (clusterNames.length === 2) {
    clusterPhrase = `spanning ${clusterNames[0]} and ${clusterNames[1]}`;
  } else {
    const last = clusterNames[clusterNames.length - 1];
    const rest = clusterNames.slice(0, -1).join(", ");
    clusterPhrase = `spanning ${rest}, and ${last}`;
  }

  // Describe coherence
  let coherencePhrase: string;
  switch (coherenceLabel) {
    case "highly_coherent":
      coherencePhrase = "form a highly coherent set";
      break;
    case "moderately_coherent":
      coherencePhrase = "form a moderately coherent set";
      break;
    case "diverse":
      coherencePhrase = "are diverse";
      break;
    case "scattered":
      coherencePhrase = "are scattered across unrelated fields";
      break;
    default:
      coherencePhrase = "were identified";
  }

  // Describe skill transfer strength
  let transferPhrase: string;
  if (coreCount > 0 && peripheralCount === 0) {
    transferPhrase =
      "with strong skill transfer from the evaluee's past relevant work";
  } else if (coreCount > 0 && peripheralCount > 0) {
    transferPhrase = `with ${coreCount} showing strong skill transfer and ${peripheralCount} representing stretch placements`;
  } else if (coreCount === 0 && peripheralCount > 0) {
    transferPhrase =
      "suggesting broad but shallow transferability from past relevant work";
  } else {
    transferPhrase =
      "with moderate skill transfer from the evaluee's past relevant work";
  }

  return `The ${n} viable occupation${n > 1 ? "s" : ""} ${coherencePhrase} ${clusterPhrase}, ${transferPhrase}.`;
}

// ─── Main Export ───────────────────────────────────────────────────────

/**
 * Analyze the set of viable (non-excluded) occupations for coherence,
 * clustering, trait demand ranges, and skill transfer distribution.
 *
 * @param viableOccupations - Array of occupation inputs (should be pre-filtered
 *   to only include non-excluded occupations)
 * @returns Full viable set analysis with coherence score, clusters, and narrative
 */
export function analyzeViableSet(
  viableOccupations: ViableOccupationInput[]
): ViableSetAnalysis {
  // ── Edge case: empty set ──────────────────────────────────────────
  if (viableOccupations.length === 0) {
    return {
      totalViable: 0,
      coherenceScore: 0,
      coherenceLabel: "scattered",
      clusters: [],
      coreOccupations: [],
      peripheralOccupations: [],
      traitDemandRange: computeTraitDemandRanges([]),
      narrativeSummary: "No viable occupations were identified in the analysis.",
    };
  }

  // ── Edge case: single occupation ──────────────────────────────────
  if (viableOccupations.length === 1) {
    const occ = viableOccupations[0];
    const isCore = occ.pvqResult.stq > 60;
    const isPeripheral = occ.pvqResult.stq < 40;

    return {
      totalViable: 1,
      coherenceScore: 100,
      coherenceLabel: "highly_coherent",
      clusters: [
        {
          name: occ.socCode
            ? SOC_MAJOR_GROUPS[socPrefix(occ.socCode)] ?? occ.title
            : occ.title,
          occupations: [occ.title],
          avgStq: round2(occ.pvqResult.stq),
          avgPvq: round2(occ.pvqResult.pvq),
          commonTraitStrengths: findCommonTraitStrengths(
            occ.traitDemands ? [occ.traitDemands] : []
          ),
        },
      ],
      coreOccupations: isCore ? [occ.title] : [],
      peripheralOccupations: isPeripheral ? [occ.title] : [],
      traitDemandRange: computeTraitDemandRanges(viableOccupations),
      narrativeSummary: `Only 1 viable occupation was identified: ${occ.title}. The viable set is too small to assess coherence or clustering.`,
    };
  }

  // ── Coherence ─────────────────────────────────────────────────────
  const coherenceScore = computeCoherenceScore(viableOccupations);
  const coherenceLabel = labelCoherence(coherenceScore);

  // ── Clustering ────────────────────────────────────────────────────
  // Prefer SOC-based clustering; fall back to PVQ bands
  const hasSOC = viableOccupations.some((o) => o.socCode);
  const groups = hasSOC
    ? clusterBySOC(viableOccupations)
    : clusterByPVQBand(viableOccupations);

  // If SOC clustering was used, any occupations without SOC codes
  // need to go into an "Uncategorized" group
  if (hasSOC) {
    const assignedIndices = new Set<number>();
    for (const indices of groups.values()) {
      for (const i of indices) assignedIndices.add(i);
    }
    const unassigned: number[] = [];
    for (let i = 0; i < viableOccupations.length; i++) {
      if (!assignedIndices.has(i)) unassigned.push(i);
    }
    if (unassigned.length > 0) {
      groups.set("Other", unassigned);
    }
  }

  const clusters = buildClusters(viableOccupations, groups);

  // ── Core vs Peripheral ────────────────────────────────────────────
  const coreOccupations: string[] = [];
  const peripheralOccupations: string[] = [];

  for (const occ of viableOccupations) {
    if (occ.pvqResult.stq > 60) {
      coreOccupations.push(occ.title);
    } else if (occ.pvqResult.stq < 40) {
      peripheralOccupations.push(occ.title);
    }
  }

  // ── Trait Demand Ranges ───────────────────────────────────────────
  const traitDemandRange = computeTraitDemandRanges(viableOccupations);

  // ── Narrative ─────────────────────────────────────────────────────
  const narrativeSummary = generateNarrative(
    viableOccupations,
    coherenceLabel,
    clusters,
    coreOccupations.length,
    peripheralOccupations.length
  );

  return {
    totalViable: viableOccupations.length,
    coherenceScore,
    coherenceLabel,
    clusters,
    coreOccupations,
    peripheralOccupations,
    traitDemandRange,
    narrativeSummary,
  };
}
