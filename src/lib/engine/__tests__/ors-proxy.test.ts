/**
 * Tests for ORS Proxy Estimation System
 *
 * Covers:
 * - SOC group inheritance
 * - O*NET Work Context mapping
 * - Similar occupation transfer
 * - DOT adjustment factors
 * - Fallback chain priority
 * - Coverage report generation
 * - Trait source provenance tracking
 */

import { describe, it, expect } from "vitest";
import {
  estimateORSProxy,
  getORSCoverageLevel,
  toSOC6,
  getParentSOCCodes,
  adjustDOTTraits,
  categorizeOccupation,
  type ORSDataEntry,
} from "@/lib/engine/ors-proxy";
import {
  convertONETContextToTraits,
  getONETContextConfidence,
} from "@/lib/engine/onet-trait-mapping";
import {
  generateCoverageReport,
  formatCoverageReport,
} from "@/lib/engine/coverage-report";
import { TRAIT_KEYS } from "@/lib/engine/traits";

// ─── Test Fixtures ────────────────────────────────────────────────────

/** Realistic ORS data for a General Manager (11-1021) */
const MOCK_ORS_GM: ORSDataEntry = {
  n: "General and operations managers",
  p: {
    "Strength": [
      { t: "Sedentary work", v: "45.2" },
      { t: "Light work", v: "48.3" },
      { t: "Medium work", v: "6.1" },
      { t: "Heavy work", v: "<0.5" },
      { t: "Very heavy work", v: "<0.5" },
    ],
    "Fine manipulation": [
      { t: "did not require fine manipulation", v: "<0.5" },
      { t: "required fine manipulation, seldom", v: "<5" },
      { t: "required fine manipulation, occasionally", v: "37.6" },
      { t: "required fine manipulation, frequently", v: "61.3" },
      { t: "required fine manipulation, constantly", v: "<0.5" },
    ],
    "Low postures": [
      { t: "did not require low postures", v: "89.1" },
      { t: "required low postures, seldom", v: "8.2" },
      { t: "required low postures, occasionally", v: "2.3" },
    ],
  },
  e: {
    "Noise": [
      { t: "Quiet", v: "52.1" },
      { t: "Moderate", v: "40.3" },
      { t: "Loud", v: "7.1" },
      { t: "Very loud", v: "<0.5" },
    ],
    "Extreme cold": [
      { t: "not exposed to extreme cold", v: "95.2" },
      { t: "exposed to extreme cold, seldom", v: "3.1" },
    ],
  },
};

/** ORS data for a broad group (11-1020) */
const MOCK_ORS_BROAD: ORSDataEntry = {
  n: "General and operations managers (broad)",
  p: {
    "Strength": [
      { t: "Sedentary work", v: "40.0" },
      { t: "Light work", v: "50.0" },
      { t: "Medium work", v: "10.0" },
    ],
  },
};

/** ORS data for a healthcare occupation (29-1141) */
const MOCK_ORS_NURSE: ORSDataEntry = {
  n: "Registered nurses",
  p: {
    "Strength": [
      { t: "Light work", v: "32.5" },
      { t: "Medium work", v: "55.8" },
      { t: "Heavy work", v: "10.2" },
    ],
    "Low postures": [
      { t: "did not require low postures", v: "15.3" },
      { t: "required low postures, occasionally", v: "62.1" },
      { t: "required low postures, frequently", v: "18.5" },
    ],
  },
  e: {
    "Hazardous contaminants": [
      { t: "not exposed to hazardous contaminants", v: "12.3" },
      { t: "exposed to hazardous contaminants, occasionally", v: "65.1" },
    ],
  },
};

function buildORSMap(entries: Record<string, ORSDataEntry>): Map<string, ORSDataEntry> {
  return new Map(Object.entries(entries));
}

// ═══════════════════════════════════════════════════════════════════════
// SOC CODE UTILITIES
// ═══════════════════════════════════════════════════════════════════════

describe("SOC Code Utilities", () => {
  it("toSOC6 normalizes various code formats", () => {
    expect(toSOC6("29-1141.00")).toBe("291141");
    expect(toSOC6("29-1141")).toBe("291141");
    expect(toSOC6("291141")).toBe("291141");
    expect(toSOC6("11-1021.00")).toBe("111021");
  });

  it("getParentSOCCodes returns correct hierarchy", () => {
    const parents = getParentSOCCodes("291141");
    expect(parents).toEqual(["291140", "291100", "290000"]);
  });

  it("getParentSOCCodes handles XX-XX00 codes", () => {
    const parents = getParentSOCCodes("291100");
    // minor group doesn't produce a broad group that equals itself
    expect(parents).toContain("290000");
    expect(parents.length).toBeGreaterThanOrEqual(1);
  });

  it("getParentSOCCodes returns empty for invalid input", () => {
    expect(getParentSOCCodes("12")).toEqual([]);
    expect(getParentSOCCodes("")).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SOC GROUP INHERITANCE (Strategy 1)
// ═══════════════════════════════════════════════════════════════════════

describe("SOC Group Inheritance", () => {
  it("inherits from broad occupation group when detailed code has no ORS", () => {
    // 11-1029 has no ORS, but 11-1020 (broad group) does
    const orsMap = buildORSMap({
      "111020": MOCK_ORS_BROAD,
    });

    const result = estimateORSProxy("11-1029.00", orsMap);

    // Should have inherited strength from broad group
    expect(result.traits.strength).toBeDefined();
    expect(result.sources.strength).toBe("ORS_GROUP");
    expect(result.confidence.strength).toBeGreaterThan(0.5);
    expect(result.methodology).toContain("group inheritance");
  });

  it("uses direct ORS data when available (does not fall through to group)", () => {
    const orsMap = buildORSMap({
      "111021": MOCK_ORS_GM,
      "111020": MOCK_ORS_BROAD,
    });

    const result = estimateORSProxy("11-1021.00", orsMap);

    // Direct ORS should be used, not broad group
    expect(result.sources.strength).toBe("ORS");
    expect(result.confidence.strength).toBe(1.0);
  });

  it("getORSCoverageLevel correctly identifies coverage tiers", () => {
    const orsMap = buildORSMap({
      "111021": MOCK_ORS_GM,
      "291140": MOCK_ORS_BROAD,
    });

    expect(getORSCoverageLevel("11-1021", orsMap)).toBe("direct");
    expect(getORSCoverageLevel("29-1141", orsMap)).toBe("group"); // inherits from 291140
    expect(getORSCoverageLevel("99-9999", orsMap)).toBe("none");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// O*NET WORK CONTEXT MAPPING (Strategy 3)
// ═══════════════════════════════════════════════════════════════════════

describe("O*NET Work Context Mapping", () => {
  it("produces valid 0-4 scale values", () => {
    const context = {
      "Spend Time Standing": 3,
      "Exposed to Hazardous Conditions": 4,
      "Sounds, Noise Levels Are Distracting or Uncomfortable": 2,
      "Spend Time Climbing Ladders, Scaffolds, or Poles": 1,
    };

    const traits = convertONETContextToTraits(context);

    for (const [, value] of Object.entries(traits)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(4);
    }
  });

  it("maps standing time to strength trait", () => {
    const context = { "Spend Time Standing": 4 };
    const traits = convertONETContextToTraits(context);

    expect(traits.strength).toBeDefined();
    expect(traits.strength).toBeGreaterThan(0);
  });

  it("maps hazardous conditions to hazards trait", () => {
    const context = { "Exposed to Hazardous Conditions": 5 };
    const traits = convertONETContextToTraits(context);

    expect(traits.hazards).toBeDefined();
    expect(traits.hazards).toBe(3); // environmentalMap(5) = 3
  });

  it("maps noise levels to noiseVibration trait", () => {
    const context = { "Sounds, Noise Levels Are Distracting or Uncomfortable": 4 };
    const traits = convertONETContextToTraits(context);

    expect(traits.noiseVibration).toBeDefined();
    expect(traits.noiseVibration).toBe(2); // environmentalMap(4) = 2
  });

  it("inversely maps sitting to lower strength", () => {
    const sittingHigh = convertONETContextToTraits({ "Spend Time Sitting": 5 });
    const sittingLow = convertONETContextToTraits({ "Spend Time Sitting": 1 });

    // High sitting should produce LOWER strength (inverse mapping)
    expect(sittingHigh.strength ?? 0).toBeLessThan(sittingLow.strength ?? 4);
  });

  it("maps climbing to climbBalance", () => {
    const context = { "Spend Time Climbing Ladders, Scaffolds, or Poles": 3 };
    const traits = convertONETContextToTraits(context);

    expect(traits.climbBalance).toBeDefined();
    expect(traits.climbBalance).toBeGreaterThan(0);
  });

  it("maps repetitive motions to both fingerDexterity and manualDexterity", () => {
    const context = { "Spend Time Making Repetitive Motions": 4 };
    const traits = convertONETContextToTraits(context);

    expect(traits.fingerDexterity).toBeDefined();
    expect(traits.manualDexterity).toBeDefined();
  });

  it("handles array-format work context input", () => {
    const context = [
      { name: "Spend Time Standing", value: 3 },
      { name: "Exposed to Contaminants", level: 4 },
    ];

    const traits = convertONETContextToTraits(context);
    expect(traits.strength).toBeDefined();
    expect(traits.dustsFumes).toBeDefined();
  });

  it("handles hot/cold temperatures mapping to both extremes", () => {
    const context = { "Very Hot or Cold Temperatures": 4 };
    const traits = convertONETContextToTraits(context);

    expect(traits.extremeHeat).toBeDefined();
    expect(traits.extremeCold).toBeDefined();
    expect(traits.extremeHeat).toBe(traits.extremeCold);
  });

  it("returns correct confidence scores per trait type", () => {
    // Environmental traits should have higher confidence
    expect(getONETContextConfidence("hazards")).toBeGreaterThan(
      getONETContextConfidence("strength")
    );
    expect(getONETContextConfidence("workLocation")).toBeGreaterThan(
      getONETContextConfidence("motorCoordination")
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SIMILAR OCCUPATION TRANSFER (Strategy 2)
// ═══════════════════════════════════════════════════════════════════════

describe("Similar Occupation Transfer", () => {
  it("transfers ORS data from similar occupation above threshold", () => {
    const orsMap = buildORSMap({
      "291141": MOCK_ORS_NURSE,
    });

    const result = estimateORSProxy("29-1142.00", orsMap, undefined, undefined, [
      { code: "29-1141.00", similarity: 0.85 },
      { code: "29-1151.00", similarity: 0.72 },
    ]);

    // Should have transferred from 29-1141 (nurses) since similarity > 0.7
    expect(result.traits.strength).toBeDefined();
    // Group inheritance might fire first for traits if group ORS exists
    // But the similar transfer should contribute some traits
    const hasSimilarSource = Object.values(result.sources).some(
      (s) => s === "ORS_SIMILAR" || s === "ORS_GROUP"
    );
    expect(hasSimilarSource).toBe(true);
  });

  it("does not transfer from occupation below similarity threshold", () => {
    const orsMap = buildORSMap({
      "291141": MOCK_ORS_NURSE,
    });

    const result = estimateORSProxy("53-3031.00", orsMap, undefined, undefined, [
      { code: "29-1141.00", similarity: 0.55 }, // Below 0.7 threshold
    ]);

    // Should NOT have ORS_SIMILAR source for any trait
    const hasSimilar = Object.values(result.sources).some(s => s === "ORS_SIMILAR");
    expect(hasSimilar).toBe(false);
  });

  it("scales confidence by similarity score", () => {
    const orsMap = buildORSMap({
      "291141": MOCK_ORS_NURSE,
    });

    const result = estimateORSProxy("29-1142.00", orsMap, undefined, undefined, [
      { code: "29-1141.00", similarity: 0.85 },
    ]);

    // Confidence for similar-sourced traits should be < 0.65 (base) * 0.85 (similarity)
    for (const [key, source] of Object.entries(result.sources)) {
      if (source === "ORS_SIMILAR") {
        expect(result.confidence[key]).toBeLessThanOrEqual(0.65);
        expect(result.confidence[key]).toBeGreaterThan(0.4);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// DOT ADJUSTMENT FACTORS (Strategy 4)
// ═══════════════════════════════════════════════════════════════════════

describe("DOT Adjustment Factors", () => {
  it("reduces office occupation strength from DOT values", () => {
    const dotTraits = { strength: 2, stoopKneel: 2, fingerDexterity: 2 };
    const adjusted = adjustDOTTraits(dotTraits, "431011"); // Office Supervisors

    // Office strength should be reduced (factor 0.7)
    expect(adjusted.strength).toBeLessThan(2);
    expect(adjusted.strength).toBeCloseTo(1.4, 1);

    // Finger dexterity should increase slightly (factor 1.1)
    expect(adjusted.fingerDexterity).toBeGreaterThan(2);
  });

  it("leaves manufacturing strength unchanged", () => {
    const dotTraits = { strength: 3 };
    const adjusted = adjustDOTTraits(dotTraits, "512099"); // Manufacturing

    expect(adjusted.strength).toBe(3); // Factor is 1.0
  });

  it("adjusts healthcare hazards upward", () => {
    const dotTraits = { hazards: 2 };
    const adjusted = adjustDOTTraits(dotTraits, "291141"); // Nurses

    expect(adjusted.hazards).toBeGreaterThan(2); // Factor 1.1
  });

  it("categorizes occupations correctly", () => {
    expect(categorizeOccupation("111021")).toBe("office");
    expect(categorizeOccupation("291141")).toBe("healthcare");
    expect(categorizeOccupation("512099")).toBe("manufacturing");
    expect(categorizeOccupation("353031")).toBe("service");
  });

  it("keeps all adjusted values within 0-4 range", () => {
    const dotTraits: Record<string, number> = {};
    for (const key of TRAIT_KEYS) {
      dotTraits[key] = 4; // Max value
    }

    const adjusted = adjustDOTTraits(dotTraits, "111021"); // Office
    for (const value of Object.values(adjusted)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(4);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// FALLBACK CHAIN
// ═══════════════════════════════════════════════════════════════════════

describe("Fallback Chain Priority", () => {
  it("follows ORS > group > similar > context > DOT > default priority", () => {
    const orsMap = buildORSMap({
      "111021": MOCK_ORS_GM,
    });

    // Occupation WITH direct ORS data
    const resultDirect = estimateORSProxy("11-1021.00", orsMap);
    expect(resultDirect.sources.strength).toBe("ORS");

    // Occupation WITHOUT ORS but with group match
    const orsMapWithGroup = buildORSMap({
      "111020": MOCK_ORS_BROAD,
    });
    const resultGroup = estimateORSProxy("11-1029.00", orsMapWithGroup);
    expect(resultGroup.sources.strength).toBe("ORS_GROUP");
  });

  it("fills all 24 traits even with no data sources", () => {
    const emptyORS = new Map<string, ORSDataEntry>();
    const result = estimateORSProxy("99-9999.00", emptyORS);

    // All 24 traits should be filled
    for (const key of TRAIT_KEYS) {
      expect(result.traits[key]).toBeDefined();
      expect(typeof result.traits[key]).toBe("number");
      expect(result.traits[key]).toBeGreaterThanOrEqual(0);
      expect(result.traits[key]).toBeLessThanOrEqual(4);
    }
  });

  it("uses conservative defaults (0 for environmental, 1 for physical/aptitude)", () => {
    const emptyORS = new Map<string, ORSDataEntry>();
    const result = estimateORSProxy("99-9999.00", emptyORS);

    // Environmental traits default to 0
    expect(result.traits.extremeCold).toBe(0);
    expect(result.traits.extremeHeat).toBe(0);
    expect(result.traits.hazards).toBe(0);
    expect(result.traits.dustsFumes).toBe(0);

    // Non-environmental traits default to 1
    expect(result.traits.reasoning).toBe(1);
    expect(result.traits.strength).toBe(1);
  });

  it("marks proxy-sourced traits correctly in sources", () => {
    const emptyORS = new Map<string, ORSDataEntry>();
    const result = estimateORSProxy("99-9999.00", emptyORS);

    // All traits should be marked as PROXY when no data available
    for (const key of TRAIT_KEYS) {
      expect(result.sources[key]).toBe("PROXY");
    }
  });

  it("mixes sources when different strategies provide different traits", () => {
    const orsMap = buildORSMap({
      "111020": { n: "Broad group", p: { "Strength": [{ t: "Light work", v: "80" }] } },
    });

    const context = {
      "Exposed to Hazardous Conditions": 4,
      "Sounds, Noise Levels Are Distracting or Uncomfortable": 3,
    };

    const result = estimateORSProxy("11-1029.00", orsMap, context);

    // Strength should come from group ORS
    expect(result.sources.strength).toBe("ORS_GROUP");

    // Environmental traits should come from O*NET context
    expect(result.sources.hazards).toBe("ONET_CONTEXT");
  });

  it("generates coverage score that reflects data quality", () => {
    // Full ORS data → high coverage score
    const orsMapFull = buildORSMap({ "111021": MOCK_ORS_GM });
    const resultFull = estimateORSProxy("11-1021.00", orsMapFull);
    expect(resultFull.coverageScore).toBeGreaterThan(20);

    // No data → low coverage score
    const emptyORS = new Map<string, ORSDataEntry>();
    const resultEmpty = estimateORSProxy("99-9999.00", emptyORS);
    expect(resultEmpty.coverageScore).toBeLessThan(20);

    // Full should be higher than empty
    expect(resultFull.coverageScore).toBeGreaterThan(resultEmpty.coverageScore);
  });

  it("generates methodology description", () => {
    const orsMap = buildORSMap({ "111021": MOCK_ORS_GM });
    const result = estimateORSProxy("11-1021.00", orsMap);

    expect(result.methodology).toContain("ORS Proxy Estimation");
    expect(result.methodology).toContain("11-1021.00");
    expect(result.methodology.length).toBeGreaterThan(20);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// COVERAGE REPORT
// ═══════════════════════════════════════════════════════════════════════

describe("Coverage Report", () => {
  it("generates correct totals", () => {
    const codes = [
      "11-1021.00", "11-1031.00", "29-1141.00",
      "43-4051.00", "53-3031.00",
    ];
    const orsMap = buildORSMap({
      "111021": MOCK_ORS_GM,
      "291141": MOCK_ORS_NURSE,
    });

    const report = generateCoverageReport(codes, orsMap);

    expect(report.totalONET).toBe(5);
    expect(report.withORS).toBe(2); // 11-1021 and 29-1141
    expect(report.withORS + report.withORSGroup + report.withONETContext +
      report.withDOTOnly + report.withNoData).toBe(5);
  });

  it("includes SOC major group breakdown", () => {
    const codes = [
      "11-1021.00", "11-1031.00", "29-1141.00",
    ];
    const orsMap = buildORSMap({
      "111021": MOCK_ORS_GM,
    });

    const report = generateCoverageReport(codes, orsMap);

    expect(report.coverageBySOCMajorGroup["11"]).toBeDefined();
    expect(report.coverageBySOCMajorGroup["11"].total).toBe(2);
    expect(report.coverageBySOCMajorGroup["11"].covered).toBe(1);
    expect(report.coverageBySOCMajorGroup["11"].groupName).toBe("Management");

    expect(report.coverageBySOCMajorGroup["29"]).toBeDefined();
    expect(report.coverageBySOCMajorGroup["29"].total).toBe(1);
    expect(report.coverageBySOCMajorGroup["29"].groupName).toContain("Healthcare");
  });

  it("calculates primary coverage percentage", () => {
    const codes = ["11-1021.00", "11-1031.00", "29-1141.00", "43-4051.00"];
    const orsMap = buildORSMap({
      "111021": MOCK_ORS_GM,
      "291141": MOCK_ORS_NURSE,
    });

    const report = generateCoverageReport(codes, orsMap);

    // 2 out of 4 = 50%
    expect(report.primaryCoveragePct).toBe(50);
  });

  it("formats report as readable string", () => {
    const codes = ["11-1021.00", "29-1141.00"];
    const orsMap = buildORSMap({
      "111021": MOCK_ORS_GM,
    });

    const report = generateCoverageReport(codes, orsMap);
    const formatted = formatCoverageReport(report);

    expect(formatted).toContain("ORS Coverage Report");
    expect(formatted).toContain("Total O*NET occupations: 2");
    expect(formatted).toContain("Management");
  });

  it("handles empty input gracefully", () => {
    const report = generateCoverageReport([], new Map());

    expect(report.totalONET).toBe(0);
    expect(report.withORS).toBe(0);
    expect(report.primaryCoveragePct).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TRAIT SOURCE PROVENANCE
// ═══════════════════════════════════════════════════════════════════════

describe("Trait Source Provenance", () => {
  it("never overwrites real ORS data with proxy estimates", () => {
    const orsMap = buildORSMap({
      "111021": MOCK_ORS_GM,
    });

    const dotTraits = { strength: 4 }; // Heavy — should NOT override ORS
    const result = estimateORSProxy("11-1021.00", orsMap, undefined, dotTraits);

    // ORS says Light (1), DOT says Heavy (4) — ORS should win
    expect(result.traits.strength).toBe(1);
    expect(result.sources.strength).toBe("ORS");
  });

  it("confidence decreases through fallback chain", () => {
    const orsMap = buildORSMap({
      "111021": MOCK_ORS_GM,
    });

    const result = estimateORSProxy("11-1021.00", orsMap);

    // ORS-sourced traits should have highest confidence
    for (const [key, source] of Object.entries(result.sources)) {
      if (source === "ORS") {
        expect(result.confidence[key]).toBe(1.0);
      } else if (source === "PROXY") {
        expect(result.confidence[key]).toBeLessThan(0.2);
      }
    }
  });

  it("all trait values are numeric and within 0-4", () => {
    const orsMap = buildORSMap({
      "111021": MOCK_ORS_GM,
      "291140": MOCK_ORS_BROAD,
    });

    const context = {
      "Spend Time Standing": 3,
      "Exposed to Hazardous Conditions": 4,
    };

    const dotTraits = { strength: 2, climbBalance: 1 };

    const result = estimateORSProxy(
      "29-1142.00", orsMap, context, dotTraits,
      [{ code: "29-1141.00", similarity: 0.85 }]
    );

    for (const key of TRAIT_KEYS) {
      expect(typeof result.traits[key]).toBe("number");
      expect(result.traits[key]).toBeGreaterThanOrEqual(0);
      expect(result.traits[key]).toBeLessThanOrEqual(4);
      expect(result.sources[key]).toBeDefined();
      expect(result.confidence[key]).toBeGreaterThanOrEqual(0);
      expect(result.confidence[key]).toBeLessThanOrEqual(1);
    }
  });
});
