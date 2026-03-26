/**
 * PVQ-TM Accuracy Validation Engine
 *
 * Checks every computation step for correctness after an analysis run.
 * Catches edge cases like zero STQ when skills exist, missing CPC data,
 * incorrect trait gate behavior, and mathematical inconsistencies.
 */

export interface ValidationCheck {
  category: string;
  check: string;
  passed: boolean;
  severity: "error" | "warning" | "info";
  message: string;
  details?: unknown;
}

export interface ValidationReport {
  timestamp: string;
  totalChecks: number;
  passed: number;
  errors: number;
  warnings: number;
  checks: ValidationCheck[];
}

interface AnalysisData {
  analysis: Record<string, unknown>;
  targets: Array<Record<string, unknown>>;
  prw: Array<Record<string, unknown>>;
  skills: Array<Record<string, unknown>>;
  postProfile: Record<string, unknown>;
  preProfile: Record<string, unknown> | null;
  analysisConfig: { ageRule?: string; priorEarnings?: number; analysisMode?: string };
}

export function validateAnalysis(data: AnalysisData): ValidationReport {
  const checks: ValidationCheck[] = [];

  validateSTQ(data, checks);
  validateTFQ(data, checks);
  validateVAQ(data, checks);
  validateLMQ(data, checks);
  validatePVQ(data, checks);
  validateCPC(data, checks);
  validateCrossComponent(data, checks);
  validateDataIntegrity(data, checks);

  return {
    timestamp: new Date().toISOString(),
    totalChecks: checks.length,
    passed: checks.filter((c) => c.passed).length,
    errors: checks.filter((c) => !c.passed && c.severity === "error").length,
    warnings: checks.filter((c) => !c.passed && c.severity === "warning").length,
    checks,
  };
}

// ─── STQ Validation ──────────────────────────────────────────────────

function validateSTQ(data: AnalysisData, checks: ValidationCheck[]) {
  const targets = data.targets;
  const hasSkills = data.skills.length > 0;
  const viableTargets = targets.filter((t) => !t.excluded);

  // STQ should be > 0 for at least some targets when skills exist
  if (hasSkills && viableTargets.length > 0) {
    const anyStqPositive = viableTargets.some((t) => (t.stq as number) > 0);
    checks.push({
      category: "STQ",
      check: "STQ positive when skills exist",
      passed: anyStqPositive,
      severity: "error",
      message: anyStqPositive
        ? `${viableTargets.filter((t) => (t.stq as number) > 0).length}/${viableTargets.length} viable targets have STQ > 0`
        : "All viable targets have STQ = 0 despite acquired skills existing",
    });
  }

  // No STQ should exceed 100
  const overMaxStq = targets.filter((t) => (t.stq as number) > 100);
  checks.push({
    category: "STQ",
    check: "STQ within 0-100 range",
    passed: overMaxStq.length === 0,
    severity: "error",
    message: overMaxStq.length === 0
      ? "All STQ scores within valid range"
      : `${overMaxStq.length} targets have STQ > 100`,
    details: overMaxStq.length > 0 ? overMaxStq.map((t) => ({ title: t.title, stq: t.stq })) : undefined,
  });

  // STQ components should sum to expected weights
  for (const t of viableTargets.slice(0, 3)) {
    const details = t.stqDetails as Record<string, unknown> | null;
    if (details?.components) {
      const components = details.components as Record<string, number>;
      const weights = {
        taskDwaOverlap: 0.35,
        wfMpsmsOverlap: 0.25,
        toolsOverlap: 0.20,
        materialsOverlap: 0.10,
        credentialOverlap: 0.10,
      };
      const expectedStq = Object.entries(weights).reduce(
        (sum, [key, weight]) => sum + (components[key] ?? 0) * weight,
        0
      );
      const actualStq = t.stq as number;
      const diff = Math.abs(expectedStq - actualStq);
      checks.push({
        category: "STQ",
        check: `STQ formula verification (${t.title})`,
        passed: diff < 1.0,
        severity: diff < 1.0 ? "info" : "error",
        message: diff < 1.0
          ? `STQ=${actualStq}, computed=${expectedStq.toFixed(1)} (diff ${diff.toFixed(2)})`
          : `STQ mismatch: reported=${actualStq}, computed=${expectedStq.toFixed(1)}`,
      });
    }
  }
}

// ─── TFQ Validation ──────────────────────────────────────────────────

function validateTFQ(data: AnalysisData, checks: ValidationCheck[]) {
  const targets = data.targets;
  const postStrength = data.postProfile.strength as number | null;

  // If POST strength = 0 (Sedentary), Medium+ occupations must be excluded
  if (postStrength === 0) {
    const mediumPlusViable = targets.filter(
      (t) => !t.excluded && t.tfqDetails
    ).filter((t) => {
      const details = t.tfqDetails as Record<string, unknown> | null;
      const demands = details?.demands as Record<string, number | null> | undefined;
      return demands?.strength != null && demands.strength >= 2;
    });

    checks.push({
      category: "TFQ",
      check: "Sedentary worker excludes Medium+ occupations",
      passed: mediumPlusViable.length === 0,
      severity: "error",
      message: mediumPlusViable.length === 0
        ? "All Medium+ occupations correctly excluded for Sedentary worker"
        : `${mediumPlusViable.length} Medium+ occupations incorrectly marked viable for Sedentary worker`,
      details: mediumPlusViable.length > 0
        ? mediumPlusViable.map((t) => ({ title: t.title, onetCode: t.onetSocCode }))
        : undefined,
    });
  }

  // If POST strength = 4 (Very Heavy), no occupation should fail on strength alone
  if (postStrength === 4) {
    const strengthFailed = targets.filter(
      (t) => t.excluded && (t.exclusionReason as string)?.includes("Strength")
    );
    checks.push({
      category: "TFQ",
      check: "Very Heavy worker not excluded on strength",
      passed: strengthFailed.length === 0,
      severity: "error",
      message: strengthFailed.length === 0
        ? "No occupations excluded on strength for Very Heavy capacity"
        : `${strengthFailed.length} occupations excluded on strength despite Very Heavy capacity`,
    });
  }

  // No TFQ should exceed 100
  const overMaxTfq = targets.filter((t) => (t.tfq as number) > 100);
  checks.push({
    category: "TFQ",
    check: "TFQ within 0-100 range",
    passed: overMaxTfq.length === 0,
    severity: "error",
    message: overMaxTfq.length === 0
      ? "All TFQ scores within valid range"
      : `${overMaxTfq.length} targets have TFQ > 100`,
  });

  // Excluded + viable = total
  const excluded = targets.filter((t) => t.excluded).length;
  const viable = targets.filter((t) => !t.excluded).length;
  checks.push({
    category: "TFQ",
    check: "Excluded + viable = total targets",
    passed: excluded + viable === targets.length,
    severity: "error",
    message: `Excluded (${excluded}) + Viable (${viable}) = ${excluded + viable}, Total = ${targets.length}`,
  });

  // Clinical mode: report tolerated failures
  const analysisMode = data.analysisConfig.analysisMode;
  if (analysisMode === "clinical") {
    const withTolerations = targets.filter((t) => t.hasTolerations);
    if (withTolerations.length > 0) {
      checks.push({
        category: "TFQ",
        check: "Clinical mode tolerated failures",
        passed: true,
        severity: "info",
        message: `${withTolerations.length} occupations have marginal trait failures tolerated in clinical mode`,
      });
    }
  }
}

// ─── VAQ Validation ──────────────────────────────────────────────────

function validateVAQ(data: AnalysisData, checks: ValidationCheck[]) {
  const targets = data.targets;
  const ageRule = data.analysisConfig.ageRule;
  const viableTargets = targets.filter((t) => !t.excluded);

  // If advanced age, check VAQ enforcement — but allow pending-review targets
  if (ageRule === "advanced_age" || ageRule === "closely_approaching") {
    const badVaq = viableTargets.filter((t) => {
      const vaq = t.vaq as number | null;
      const pendingReview = t.pendingEvaluatorReview as boolean | undefined;
      // Auto-estimated targets with pending review are allowed through
      return vaq != null && vaq < 100 && !pendingReview;
    });
    const pendingReviewCount = viableTargets.filter(
      (t) => t.pendingEvaluatorReview
    ).length;

    checks.push({
      category: "VAQ",
      check: "Advanced age VAQ enforcement",
      passed: badVaq.length === 0,
      severity: badVaq.length === 0 ? "info" : "error",
      message: badVaq.length === 0
        ? `All viable targets meet advanced age VAQ requirement${pendingReviewCount > 0 ? ` (${pendingReviewCount} pending evaluator review)` : ""}`
        : `${badVaq.length} viable targets have VAQ < 100 despite advanced age rule (not auto-estimated)`,
    });

    // Warn about pending review targets
    if (pendingReviewCount > 0) {
      checks.push({
        category: "VAQ",
        check: "Auto-estimated VAQ pending evaluator review",
        passed: true,
        severity: "warning",
        message: `${pendingReviewCount} viable targets have auto-estimated VAQ that needs evaluator confirmation for advanced age rule`,
      });
    }
  }

  // VAQ should be 0-100
  const outOfRange = targets.filter((t) => {
    const vaq = t.vaq as number | null;
    return vaq != null && (vaq < 0 || vaq > 100);
  });
  checks.push({
    category: "VAQ",
    check: "VAQ within 0-100 range",
    passed: outOfRange.length === 0,
    severity: "error",
    message: outOfRange.length === 0
      ? "All VAQ scores within valid range"
      : `${outOfRange.length} targets have VAQ outside 0-100`,
  });
}

// ─── LMQ Validation ──────────────────────────────────────────────────

function validateLMQ(data: AnalysisData, checks: ValidationCheck[]) {
  const targets = data.targets;

  // LMQ should be 0-100
  const outOfRange = targets.filter((t) => {
    const lmq = t.lmq as number | null;
    return lmq != null && (lmq < 0 || lmq > 100);
  });
  checks.push({
    category: "LMQ",
    check: "LMQ within 0-100 range",
    passed: outOfRange.length === 0,
    severity: "error",
    message: outOfRange.length === 0
      ? "All LMQ scores within valid range"
      : `${outOfRange.length} targets have LMQ outside 0-100`,
  });

  // Viable targets should have employment data for most
  const viableTargets = targets.filter((t) => !t.excluded);
  if (viableTargets.length > 0) {
    const withLmqDetails = viableTargets.filter((t) => t.lmqDetails != null);
    checks.push({
      category: "LMQ",
      check: "LMQ details populated for viable targets",
      passed: withLmqDetails.length === viableTargets.length,
      severity: "warning",
      message: `${withLmqDetails.length}/${viableTargets.length} viable targets have LMQ details`,
    });
  }
}

// ─── PVQ Validation ──────────────────────────────────────────────────

function validatePVQ(data: AnalysisData, checks: ValidationCheck[]) {
  const targets = data.targets;

  // All excluded should have PVQ = 0
  const excludedWithPvq = targets.filter(
    (t) => t.excluded && (t.pvq as number) > 0
  );
  checks.push({
    category: "PVQ",
    check: "Excluded occupations have PVQ = 0",
    passed: excludedWithPvq.length === 0,
    severity: "error",
    message: excludedWithPvq.length === 0
      ? "All excluded occupations correctly have PVQ = 0"
      : `${excludedWithPvq.length} excluded occupations have PVQ > 0`,
  });

  // PVQ formula: 0.45*STQ + 0.25*TFQ + 0.15*VAQ + 0.15*LMQ
  const viableTargets = targets.filter((t) => !t.excluded);
  for (const t of viableTargets.slice(0, 5)) {
    const stq = (t.stq as number) ?? 0;
    const tfq = (t.tfq as number) ?? 0;
    const vaq = (t.vaq as number) ?? 0;
    const lmq = (t.lmq as number) ?? 0;
    const pvq = (t.pvq as number) ?? 0;

    const expected = 0.45 * stq + 0.25 * tfq + 0.15 * vaq + 0.15 * lmq;
    const diff = Math.abs(expected - pvq);

    checks.push({
      category: "PVQ",
      check: `PVQ formula (${(t.title as string)?.substring(0, 30)})`,
      passed: diff < 1.0,
      severity: diff < 1.0 ? "info" : "error",
      message: `PVQ=${pvq.toFixed(1)}, expected=${expected.toFixed(1)} (STQ=${stq.toFixed(0)} TFQ=${tfq.toFixed(0)} VAQ=${vaq.toFixed(0)} LMQ=${lmq.toFixed(0)})`,
    });
  }

  // PVQ range check
  const outOfRange = targets.filter((t) => {
    const pvq = t.pvq as number | null;
    return pvq != null && (pvq < 0 || pvq > 100);
  });
  checks.push({
    category: "PVQ",
    check: "PVQ within 0-100 range",
    passed: outOfRange.length === 0,
    severity: "error",
    message: outOfRange.length === 0
      ? "All PVQ scores within valid range"
      : `${outOfRange.length} targets have PVQ outside 0-100`,
  });
}

// ─── CPC Validation ──────────────────────────────────────────────────

function validateCPC(data: AnalysisData, checks: ValidationCheck[]) {
  const analysis = data.analysis;
  const targets = data.targets;
  const prwOnetCodes = data.prw
    .map((p) => p.onetSocCode as string)
    .filter(Boolean);

  // CPC analysis should be populated
  checks.push({
    category: "CPC",
    check: "CPC analysis populated on analysis record",
    passed: analysis.cpcAnalysis != null,
    severity: "error",
    message: analysis.cpcAnalysis != null
      ? "CPC analysis data present"
      : "CPC analysis is null — component profile not computed",
  });

  // Worker CPC code should be non-empty if PRW O*NET codes exist
  if (prwOnetCodes.length > 0 && analysis.cpcAnalysis) {
    const cpcData = analysis.cpcAnalysis as Record<string, unknown>;
    const workerProfile = cpcData.workerProfile as Record<string, unknown> | undefined;
    const cpcCode = (workerProfile?.cpc as Record<string, unknown>)?.code as string | undefined;

    checks.push({
      category: "CPC",
      check: "Worker CPC code is non-empty",
      passed: !!cpcCode && cpcCode.length > 5,
      severity: "error",
      message: cpcCode
        ? `Worker CPC: ${cpcCode}`
        : "Worker CPC code is empty despite PRW O*NET codes existing",
    });

    // Similar occupations should be found
    const similarOccs = cpcData.similarOccupations as unknown[] | undefined;
    checks.push({
      category: "CPC",
      check: "CPC similar occupations found",
      passed: (similarOccs?.length ?? 0) > 0,
      severity: "warning",
      message: `${similarOccs?.length ?? 0} similar occupations found by CPC`,
    });
  }

  // CPC similarity should be 0-1 for all targets
  const withCpc = targets.filter((t) => t.cpcSimilarity != null);
  const outOfRange = withCpc.filter(
    (t) => (t.cpcSimilarity as number) < 0 || (t.cpcSimilarity as number) > 1
  );
  checks.push({
    category: "CPC",
    check: "CPC similarity in 0-1 range",
    passed: outOfRange.length === 0,
    severity: "error",
    message: outOfRange.length === 0
      ? `All ${withCpc.length} CPC similarities within valid range`
      : `${outOfRange.length} targets have CPC similarity outside 0-1`,
  });

  // Targets should have CPC codes
  checks.push({
    category: "CPC",
    check: "Targets have CPC codes assigned",
    passed: withCpc.length > 0,
    severity: "warning",
    message: `${withCpc.length}/${targets.length} targets have CPC similarity scores`,
  });
}

// ─── Cross-Component Validation ──────────────────────────────────────

function validateCrossComponent(data: AnalysisData, checks: ValidationCheck[]) {
  const analysis = data.analysis;
  const targets = data.targets;
  const viableCount = targets.filter((t) => !t.excluded).length;

  // If zero viable → zeroViableExplanation should exist
  if (viableCount === 0 && targets.length > 0) {
    checks.push({
      category: "Cross-Component",
      check: "Zero-viable explanation present",
      passed: analysis.zeroViableExplanation != null,
      severity: "error",
      message: analysis.zeroViableExplanation != null
        ? "Zero-viable explanation correctly generated"
        : "No zero-viable explanation despite 0 viable targets",
    });
  }

  // If pre-profile exists → laborMarketAccess should exist
  if (data.preProfile) {
    checks.push({
      category: "Cross-Component",
      check: "Labor market access computed (pre-profile exists)",
      passed: analysis.laborMarketAccess != null,
      severity: "warning",
      message: analysis.laborMarketAccess != null
        ? "Labor market access analysis present"
        : "Labor market access missing despite pre-profile existing",
    });
  }

  // If viable targets exist → viableSetAnalysis should exist
  if (viableCount > 0) {
    checks.push({
      category: "Cross-Component",
      check: "Viable set analysis present",
      passed: analysis.viableSetAnalysis != null,
      severity: "warning",
      message: analysis.viableSetAnalysis != null
        ? "Viable set coherence analysis present"
        : "Viable set analysis missing despite viable targets existing",
    });
  }

  // RFC narrative should always be generated
  checks.push({
    category: "Cross-Component",
    check: "RFC narrative generated",
    passed: analysis.rfcNarrative != null,
    severity: "warning",
    message: analysis.rfcNarrative != null
      ? "RFC narrative present"
      : "RFC narrative missing",
  });

  // All targets should have confidence grade
  const withGrade = targets.filter((t) => t.confidenceGrade);
  const viableTargets = targets.filter((t) => !t.excluded);
  checks.push({
    category: "Cross-Component",
    check: "Confidence grades assigned",
    passed: withGrade.length >= viableTargets.length,
    severity: "warning",
    message: `${withGrade.length}/${targets.length} targets have confidence grades`,
  });
}

// ─── Data Integrity ──────────────────────────────────────────────────

function validateDataIntegrity(data: AnalysisData, checks: ValidationCheck[]) {
  const targets = data.targets;

  // All targets should have onetSocCode
  const missingCode = targets.filter((t) => !t.onetSocCode);
  checks.push({
    category: "Data Integrity",
    check: "All targets have O*NET code",
    passed: missingCode.length === 0,
    severity: "error",
    message: missingCode.length === 0
      ? "All targets have valid O*NET codes"
      : `${missingCode.length} targets missing O*NET code`,
  });

  // All targets should have titles
  const missingTitle = targets.filter((t) => !t.title);
  checks.push({
    category: "Data Integrity",
    check: "All targets have titles",
    passed: missingTitle.length === 0,
    severity: "error",
    message: missingTitle.length === 0
      ? "All targets have occupation titles"
      : `${missingTitle.length} targets missing titles`,
  });

  // Viable targets should have all 4 score components
  const viableTargets = targets.filter((t) => !t.excluded);
  for (const t of viableTargets.slice(0, 3)) {
    const hasAll = t.stq != null && t.tfq != null && t.vaq != null && t.lmq != null;
    checks.push({
      category: "Data Integrity",
      check: `Complete scores for ${(t.title as string)?.substring(0, 30)}`,
      passed: hasAll,
      severity: "error",
      message: hasAll
        ? `STQ=${t.stq} TFQ=${t.tfq} VAQ=${t.vaq} LMQ=${t.lmq} PVQ=${t.pvq}`
        : `Missing scores: ${[
            t.stq == null ? "STQ" : "",
            t.tfq == null ? "TFQ" : "",
            t.vaq == null ? "VAQ" : "",
            t.lmq == null ? "LMQ" : "",
          ].filter(Boolean).join(", ")}`,
    });
  }

  // Total candidates should be reasonable (not 0, not >200)
  checks.push({
    category: "Data Integrity",
    check: "Reasonable candidate count",
    passed: targets.length > 0 && targets.length <= 200,
    severity: targets.length === 0 ? "error" : "info",
    message: `${targets.length} total candidates evaluated`,
  });
}
