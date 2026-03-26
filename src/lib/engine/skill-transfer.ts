/**
 * Skill Transfer Engine (STQ)
 *
 * Computes the Skill Transfer Quotient based on SSA policy:
 * - Only skills from skilled/semiskilled PRW (SVP >= 4)
 * - Must involve judgment or technique learned over >30 days
 * - Excludes raw aptitudes, inherent abilities, traits
 *
 * STQ = 0.35×taskOverlap + 0.25×wfMpsms + 0.20×toolsOverlap
 *     + 0.10×materialsOverlap + 0.10×credentialOverlap
 *
 * Hard gate: target SVP must be same or lower than source SVP.
 */

export interface SkillTransferInput {
  // Source (PRW) data
  sourceSvp: number;
  sourceTasks: string[];
  sourceDWAs: string[];
  sourceWorkFields: string[];
  sourceMPSMS: string[];
  sourceTools: string[];
  sourceMaterials: string[];
  sourceKnowledge: string[];

  // Target occupation data
  targetSvp: number;
  targetTasks: string[];
  targetDWAs: string[];
  targetWorkFields: string[];
  targetMPSMS: string[];
  targetTools: string[];
  targetMaterials: string[];
  targetKnowledge: string[];
}

export interface STQResult {
  stq: number;
  passesGate: boolean;
  gateReason?: string;
  components: {
    taskDwaOverlap: number;
    wfMpsmsOverlap: number;
    toolsOverlap: number;
    materialsOverlap: number;
    credentialOverlap: number;
  };
  details: {
    matchedTasks: string[];
    matchedDWAs: string[];
    matchedTools: string[];
    matchedMaterials: string[];
    matchedKnowledge: string[];
  };
}

/**
 * Compute Jaccard similarity between two string arrays.
 * Returns value between 0 and 1.
 */
function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;

  const setA = new Set(a.map((s) => s.toLowerCase().trim()));
  const setB = new Set(b.map((s) => s.toLowerCase().trim()));

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Find matching items between two arrays (case-insensitive).
 */
function findMatches(a: string[], b: string[]): string[] {
  const setB = new Set(b.map((s) => s.toLowerCase().trim()));
  return a.filter((s) => setB.has(s.toLowerCase().trim()));
}

/**
 * Simple English suffix stemmer.
 * Strips common suffixes so "operating"/"operations"/"operator" all
 * reduce to the same stem. Not a full Porter stemmer, but handles
 * the most frequent vocational vocabulary mismatches.
 */
function simpleStem(word: string): string {
  if (word.length <= 4) return word;
  return word
    .replace(/ying$/, "y")
    .replace(/(tion|sion|ment|ness|ence|ance|ible|able|ious|eous|ical|ally|ings|ated|ting|ling|ling)$/, "")
    .replace(/(ing|ies|ied|ers|est|ous|ful|ive|ize|ise|ant|ent|ism|ist|ity)$/, "")
    .replace(/(ed|er|ly|al|or|es|en)$/, "")
    .replace(/(s)$/, "");
}

/**
 * Compute fuzzy overlap using normalized token overlap with stemming.
 * More forgiving than strict Jaccard — tokenizes strings, stems them,
 * and compares. This catches vocabulary mismatches like
 * "customer service" vs "customer relations" (shared: "customer"),
 * "operating" vs "operations" (shared stem: "operat").
 */
function tokenOverlap(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;

  const tokenize = (arr: string[]) => {
    const tokens = new Set<string>();
    for (const s of arr) {
      for (const word of s.toLowerCase().split(/\s+/)) {
        if (word.length > 2) {
          tokens.add(word);           // exact token
          tokens.add(simpleStem(word)); // stemmed token
        }
      }
    }
    return tokens;
  };

  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  const intersection = new Set([...tokensA].filter((t) => tokensB.has(t)));
  const union = new Set([...tokensA, ...tokensB]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Compute Dice coefficient — more generous than Jaccard for partial overlap.
 * Dice = 2×|A∩B| / (|A| + |B|), always ≥ Jaccard for the same sets.
 */
function diceSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;

  const setA = new Set(a.map((s) => simpleStem(s.toLowerCase().trim())));
  const setB = new Set(b.map((s) => simpleStem(s.toLowerCase().trim())));

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const denominator = setA.size + setB.size;

  if (denominator === 0) return 0;
  return (2 * intersection.size) / denominator;
}

/**
 * Check if the SVP gate passes (target must be same or lower SVP).
 */
export function checkSvpGate(
  sourceSvp: number,
  targetSvp: number
): { passes: boolean; reason?: string } {
  if (targetSvp > sourceSvp) {
    return {
      passes: false,
      reason: `Target SVP (${targetSvp}) exceeds source SVP (${sourceSvp})`,
    };
  }
  return { passes: true };
}

/**
 * Validate that a skill meets SSA's definition of a transferable skill:
 * - From SVP 4+ work (semiskilled or skilled)
 * - Requires >30 days learning
 * - Involves meaningful judgment or technique
 */
export function isValidTransferableSkill(svp: number): boolean {
  return svp >= 4; // SVP 4 = 3-6 months, semiskilled minimum
}

/**
 * Compute the Skill Transfer Quotient (STQ).
 *
 * Weights:
 * - 35% task/DWA overlap
 * - 25% Work Field / MPSMS similarity
 * - 20% tools/software overlap
 * - 10% materials/services similarity
 * - 10% credential/knowledge overlap
 */
export function computeSTQ(input: SkillTransferInput): STQResult {
  // Check SVP gate first
  const gate = checkSvpGate(input.sourceSvp, input.targetSvp);
  if (!gate.passes) {
    return {
      stq: 0,
      passesGate: false,
      gateReason: gate.reason,
      components: {
        taskDwaOverlap: 0,
        wfMpsmsOverlap: 0,
        toolsOverlap: 0,
        materialsOverlap: 0,
        credentialOverlap: 0,
      },
      details: {
        matchedTasks: [],
        matchedDWAs: [],
        matchedTools: [],
        matchedMaterials: [],
        matchedKnowledge: [],
      },
    };
  }

  // Combine tasks and DWAs for the task component
  const allSourceTasks = [...input.sourceTasks, ...input.sourceDWAs];
  const allTargetTasks = [...input.targetTasks, ...input.targetDWAs];

  // Use best-of-three: Jaccard, token overlap (with stemming), and Dice coefficient
  // This catches exact matches, partial-word matches, and vocabulary mismatches
  const taskJaccard = jaccardSimilarity(allSourceTasks, allTargetTasks);
  const taskToken = tokenOverlap(allSourceTasks, allTargetTasks);
  const taskDice = diceSimilarity(allSourceTasks, allTargetTasks);
  const taskDwaOverlap = Math.max(taskJaccard, taskToken, taskDice) * 100;

  // Work Field / MPSMS similarity
  const wfSimilarity = jaccardSimilarity(
    input.sourceWorkFields,
    input.targetWorkFields
  );
  const mpsmsSimilarity = jaccardSimilarity(
    input.sourceMPSMS,
    input.targetMPSMS
  );
  const wfMpsmsOverlap = ((wfSimilarity + mpsmsSimilarity) / 2) * 100;

  // Tools overlap — use all three methods
  const toolsJaccard = jaccardSimilarity(input.sourceTools, input.targetTools);
  const toolsToken = tokenOverlap(input.sourceTools, input.targetTools);
  const toolsDice = diceSimilarity(input.sourceTools, input.targetTools);
  const toolsOverlap = Math.max(toolsJaccard, toolsToken, toolsDice) * 100;

  // Materials/services overlap
  const matJaccard = jaccardSimilarity(
    input.sourceMaterials,
    input.targetMaterials
  );
  const matToken = tokenOverlap(input.sourceMaterials, input.targetMaterials);
  const matDice = diceSimilarity(input.sourceMaterials, input.targetMaterials);
  const materialsOverlap = Math.max(matJaccard, matToken, matDice) * 100;

  // Credential/knowledge overlap
  const credJaccard = jaccardSimilarity(
    input.sourceKnowledge,
    input.targetKnowledge
  );
  const credToken = tokenOverlap(input.sourceKnowledge, input.targetKnowledge);
  const credDice = diceSimilarity(input.sourceKnowledge, input.targetKnowledge);
  const credentialOverlap = Math.max(credJaccard, credToken, credDice) * 100;

  // Weighted composite
  const stq =
    0.35 * taskDwaOverlap +
    0.25 * wfMpsmsOverlap +
    0.2 * toolsOverlap +
    0.1 * materialsOverlap +
    0.1 * credentialOverlap;

  return {
    stq: Math.round(stq * 100) / 100,
    passesGate: true,
    components: {
      taskDwaOverlap: Math.round(taskDwaOverlap * 100) / 100,
      wfMpsmsOverlap: Math.round(wfMpsmsOverlap * 100) / 100,
      toolsOverlap: Math.round(toolsOverlap * 100) / 100,
      materialsOverlap: Math.round(materialsOverlap * 100) / 100,
      credentialOverlap: Math.round(credentialOverlap * 100) / 100,
    },
    details: {
      matchedTasks: findMatches(input.sourceTasks, input.targetTasks),
      matchedDWAs: findMatches(input.sourceDWAs, input.targetDWAs),
      matchedTools: findMatches(input.sourceTools, input.targetTools),
      matchedMaterials: findMatches(
        input.sourceMaterials,
        input.targetMaterials
      ),
      matchedKnowledge: findMatches(
        input.sourceKnowledge,
        input.targetKnowledge
      ),
    },
  };
}

/**
 * Compute task/DWA overlap for unskilled workers (SVP < 4).
 * Instead of skill transfer (which requires SVP 4+), this scores
 * based on task familiarity — the degree to which prior work
 * activities overlap with the target occupation.
 *
 * Uses the same similarity methods but with adjusted weights:
 * 50% task/DWA overlap, 30% tools, 20% work field similarity.
 * Gate always passes for unskilled targets (SVP ≤ 3).
 */
function computeUnskilledSTQ(
  prwEntries: SkillTransferInput[],
  targetData: {
    targetSvp: number;
    targetTasks: string[];
    targetDWAs: string[];
    targetWorkFields: string[];
    targetMPSMS: string[];
    targetTools: string[];
    targetMaterials: string[];
    targetKnowledge: string[];
  }
): STQResult {
  // Unskilled pathway only applies to unskilled targets
  if (targetData.targetSvp > 3) {
    return {
      stq: 0,
      passesGate: false,
      gateReason: "Unskilled pathway only applies to SVP 1-3 targets",
      components: { taskDwaOverlap: 0, wfMpsmsOverlap: 0, toolsOverlap: 0, materialsOverlap: 0, credentialOverlap: 0 },
      details: { matchedTasks: [], matchedDWAs: [], matchedTools: [], matchedMaterials: [], matchedKnowledge: [] },
    };
  }

  let bestTaskOverlap = 0;
  let bestToolsOverlap = 0;
  let bestWfOverlap = 0;
  let bestMatchedTasks: string[] = [];
  let bestMatchedDWAs: string[] = [];
  let bestMatchedTools: string[] = [];

  for (const prw of prwEntries) {
    const allSourceTasks = [...prw.sourceTasks, ...prw.sourceDWAs];
    const allTargetTasks = [...targetData.targetTasks, ...targetData.targetDWAs];

    const taskScore = Math.max(
      jaccardSimilarity(allSourceTasks, allTargetTasks),
      tokenOverlap(allSourceTasks, allTargetTasks),
      diceSimilarity(allSourceTasks, allTargetTasks)
    ) * 100;

    const toolsScore = Math.max(
      jaccardSimilarity(prw.sourceTools, targetData.targetTools),
      tokenOverlap(prw.sourceTools, targetData.targetTools),
      diceSimilarity(prw.sourceTools, targetData.targetTools)
    ) * 100;

    const wfScore = ((
      jaccardSimilarity(prw.sourceWorkFields, targetData.targetWorkFields) +
      jaccardSimilarity(prw.sourceMPSMS, targetData.targetMPSMS)
    ) / 2) * 100;

    const combined = 0.50 * taskScore + 0.30 * toolsScore + 0.20 * wfScore;
    if (combined > (0.50 * bestTaskOverlap + 0.30 * bestToolsOverlap + 0.20 * bestWfOverlap)) {
      bestTaskOverlap = taskScore;
      bestToolsOverlap = toolsScore;
      bestWfOverlap = wfScore;
      bestMatchedTasks = findMatches(prw.sourceTasks, targetData.targetTasks);
      bestMatchedDWAs = findMatches(prw.sourceDWAs, targetData.targetDWAs);
      bestMatchedTools = findMatches(prw.sourceTools, targetData.targetTools);
    }
  }

  const stq = 0.50 * bestTaskOverlap + 0.30 * bestToolsOverlap + 0.20 * bestWfOverlap;

  return {
    stq: Math.round(stq * 100) / 100,
    passesGate: true, // unskilled targets always pass the SVP gate
    components: {
      taskDwaOverlap: Math.round(bestTaskOverlap * 100) / 100,
      wfMpsmsOverlap: Math.round(bestWfOverlap * 100) / 100,
      toolsOverlap: Math.round(bestToolsOverlap * 100) / 100,
      materialsOverlap: 0,
      credentialOverlap: 0,
    },
    details: {
      matchedTasks: bestMatchedTasks,
      matchedDWAs: bestMatchedDWAs,
      matchedTools: bestMatchedTools,
      matchedMaterials: [],
      matchedKnowledge: [],
    },
  };
}

/**
 * Compute aggregate STQ across multiple PRW entries.
 * Uses the best match from any PRW entry.
 *
 * If all PRW is unskilled (SVP < 4) and the target is also unskilled,
 * falls back to the unskilled worker pathway which scores task
 * familiarity instead of formal skill transfer.
 */
export function computeAggregateSTQ(
  prwEntries: SkillTransferInput[],
  targetData: Omit<
    SkillTransferInput,
    | "sourceSvp"
    | "sourceTasks"
    | "sourceDWAs"
    | "sourceWorkFields"
    | "sourceMPSMS"
    | "sourceTools"
    | "sourceMaterials"
    | "sourceKnowledge"
  > & {
    targetSvp: number;
    targetTasks: string[];
    targetDWAs: string[];
    targetWorkFields: string[];
    targetMPSMS: string[];
    targetTools: string[];
    targetMaterials: string[];
    targetKnowledge: string[];
  }
): STQResult {
  const skilledPRW = prwEntries.filter((prw) => isValidTransferableSkill(prw.sourceSvp));

  // Standard pathway: try skilled PRW entries first
  let bestResult: STQResult | null = null;
  for (const prw of skilledPRW) {
    const result = computeSTQ({
      ...prw,
      ...targetData,
    });
    if (!bestResult || result.stq > bestResult.stq) {
      bestResult = result;
    }
  }

  // If we got a result from skilled PRW, use it
  if (bestResult && (bestResult.passesGate || bestResult.stq > 0)) {
    return bestResult;
  }

  // Unskilled worker pathway: if no skilled PRW exists and target is unskilled,
  // compute task familiarity instead of formal skill transfer
  if (skilledPRW.length === 0 && prwEntries.length > 0 && targetData.targetSvp <= 3) {
    return computeUnskilledSTQ(prwEntries, targetData);
  }

  return (
    bestResult ?? {
      stq: 0,
      passesGate: false,
      gateReason: "No valid transferable skills found in PRW",
      components: {
        taskDwaOverlap: 0,
        wfMpsmsOverlap: 0,
        toolsOverlap: 0,
        materialsOverlap: 0,
        credentialOverlap: 0,
      },
      details: {
        matchedTasks: [],
        matchedDWAs: [],
        matchedTools: [],
        matchedMaterials: [],
        matchedKnowledge: [],
      },
    }
  );
}
