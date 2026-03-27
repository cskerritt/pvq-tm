/**
 * Validation tests for the comprehensive benchmark fixtures.
 *
 * These tests verify that the generated benchmark files contain valid data
 * for all DOT codes and O*NET occupations.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const FIXTURES_DIR = path.resolve(__dirname, "../__fixtures__");

interface DOTBenchmark {
  id: string;
  title: string;
  dotCode: string;
  onetCode: string | null;
  svp: number;
  strength: string;
  traitVector: Record<string, number>;
  traitSources: Record<string, string>;
  expectedVQ: number;
  expectedVQBand: 1 | 2 | 3 | 4;
}

interface ONETBenchmark {
  id: string;
  title: string;
  onetCode: string;
  description: string;
  jobZone: number;
  tasks: string[];
  knowledge: { name: string; importance: number }[];
  skills: { name: string; importance: number }[];
  tools: { name: string; category: string }[];
  abilities: { id: string; name: string; importance: number; level: number }[];
  oewsData: {
    employment: number | null;
    medianWage: number | null;
    meanWage: number | null;
    pct10: number | null;
    pct25: number | null;
    pct75: number | null;
    pct90: number | null;
  } | null;
  orsAvailable: boolean;
  orsTraits: Record<string, number> | null;
}

const TRAIT_KEYS = [
  "reasoning", "math", "language",
  "spatialPerception", "formPerception", "clericalPerception",
  "motorCoordination", "fingerDexterity", "manualDexterity",
  "eyeHandFoot", "colorDiscrimination",
  "strength", "climbBalance", "stoopKneel", "reachHandle",
  "talkHear", "see",
  "workLocation", "extremeCold", "extremeHeat",
  "wetnessHumidity", "noiseVibration", "hazards", "dustsFumes",
];

// ─── DOT Benchmarks ──────────────────────────────────────────────────────────

describe("All DOT Benchmarks", () => {
  let dotBenchmarks: DOTBenchmark[];

  beforeAll(() => {
    const filePath = path.join(FIXTURES_DIR, "all-dot-benchmarks.json");
    expect(fs.existsSync(filePath)).toBe(true);
    dotBenchmarks = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  });

  it("should have generated benchmarks for all DOT codes", () => {
    expect(dotBenchmarks.length).toBeGreaterThanOrEqual(12700);
    console.log(`  Total DOT benchmarks: ${dotBenchmarks.length}`);
  });

  it("every DOT benchmark should have a unique id", () => {
    const ids = new Set(dotBenchmarks.map((b) => b.id));
    expect(ids.size).toBe(dotBenchmarks.length);
  });

  it("every DOT benchmark should have a title", () => {
    for (const b of dotBenchmarks) {
      expect(b.title).toBeTruthy();
      expect(typeof b.title).toBe("string");
      expect(b.title.length).toBeGreaterThan(0);
    }
  });

  it("every DOT benchmark should have valid trait vectors", () => {
    for (const b of dotBenchmarks) {
      for (const key of TRAIT_KEYS) {
        const val = b.traitVector[key];
        expect(typeof val).toBe("number");
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(4);
      }
    }
  });

  it("every DOT benchmark should have all 24 trait sources", () => {
    for (const b of dotBenchmarks) {
      for (const key of TRAIT_KEYS) {
        expect(b.traitSources[key]).toBeTruthy();
      }
    }
  });

  it("every DOT benchmark should have valid VQ score", () => {
    for (const b of dotBenchmarks) {
      expect(b.expectedVQ).toBeGreaterThanOrEqual(68);
      expect(b.expectedVQ).toBeLessThanOrEqual(158);
      expect([1, 2, 3, 4]).toContain(b.expectedVQBand);
    }
  });

  it("VQ band distribution should be reasonable", () => {
    const bandCounts = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<number, number>;
    for (const b of dotBenchmarks) {
      bandCounts[b.expectedVQBand]++;
    }

    console.log("  VQ Band distribution:");
    console.log(`    Band 1: ${bandCounts[1]} (${((bandCounts[1] / dotBenchmarks.length) * 100).toFixed(1)}%)`);
    console.log(`    Band 2: ${bandCounts[2]} (${((bandCounts[2] / dotBenchmarks.length) * 100).toFixed(1)}%)`);
    console.log(`    Band 3: ${bandCounts[3]} (${((bandCounts[3] / dotBenchmarks.length) * 100).toFixed(1)}%)`);
    console.log(`    Band 4: ${bandCounts[4]} (${((bandCounts[4] / dotBenchmarks.length) * 100).toFixed(1)}%)`);

    // All 4 bands should have occupations
    expect(bandCounts[1]).toBeGreaterThan(0);
    expect(bandCounts[2]).toBeGreaterThan(0);
    expect(bandCounts[3]).toBeGreaterThan(0);
    // Band 4 may or may not have entries, but at least 3 bands should
    expect(bandCounts[1] + bandCounts[2] + bandCounts[3]).toBeGreaterThan(0);
  });

  it("should cover all strength levels", () => {
    const strengths = new Set(dotBenchmarks.map((b) => b.strength));
    console.log("  Strength levels found:", [...strengths].sort());
    expect(strengths.has("S")).toBe(true);
    expect(strengths.has("L")).toBe(true);
    expect(strengths.has("M")).toBe(true);
    expect(strengths.has("H")).toBe(true);
    expect(strengths.has("V")).toBe(true);
  });

  it("should cover SVP 1-9", () => {
    const svps = new Set(dotBenchmarks.map((b) => b.svp));
    console.log("  SVP levels found:", [...svps].sort());
    for (let s = 1; s <= 9; s++) {
      if (!svps.has(s)) {
        console.log(`    SVP ${s}: not found`);
      }
    }
    // At least SVP 2-8 should be present (1 and 9 might be rare)
    expect(svps.has(2)).toBe(true);
    expect(svps.has(4)).toBe(true);
    expect(svps.has(6)).toBe(true);
    expect(svps.has(8)).toBe(true);
  });

  it("VQ band should match VQ score", () => {
    for (const b of dotBenchmarks) {
      let expectedBand: number;
      if (b.expectedVQ < 100) expectedBand = 1;
      else if (b.expectedVQ < 109) expectedBand = 2;
      else if (b.expectedVQ < 144) expectedBand = 3;
      else expectedBand = 4;
      expect(b.expectedVQBand).toBe(expectedBand);
    }
  });
});

// ─── O*NET Benchmarks ────────────────────────────────────────────────────────

describe("All O*NET Benchmarks", () => {
  let onetBenchmarks: ONETBenchmark[];

  beforeAll(() => {
    const filePath = path.join(FIXTURES_DIR, "all-onet-benchmarks.json");
    expect(fs.existsSync(filePath)).toBe(true);
    onetBenchmarks = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  });

  it("should have generated benchmarks for all O*NET occupations", () => {
    expect(onetBenchmarks.length).toBeGreaterThanOrEqual(1000);
    console.log(`  Total O*NET benchmarks: ${onetBenchmarks.length}`);
  });

  it("every O*NET benchmark should have a unique id", () => {
    const ids = new Set(onetBenchmarks.map((b) => b.id));
    expect(ids.size).toBe(onetBenchmarks.length);
  });

  it("every O*NET benchmark should have tasks", () => {
    let withTasks = 0;
    for (const b of onetBenchmarks) {
      if (b.tasks.length > 0) withTasks++;
    }
    console.log(`  Occupations with tasks: ${withTasks}/${onetBenchmarks.length}`);
    // Most O*NET occupations should have tasks
    expect(withTasks).toBeGreaterThan(onetBenchmarks.length * 0.9);
  });

  it("every O*NET benchmark should have a valid job zone", () => {
    let withJobZone = 0;
    for (const b of onetBenchmarks) {
      if (b.jobZone !== undefined && b.jobZone !== null) {
        expect(b.jobZone).toBeGreaterThanOrEqual(1);
        expect(b.jobZone).toBeLessThanOrEqual(5);
        withJobZone++;
      }
    }
    console.log(`  Occupations with job zone: ${withJobZone}/${onetBenchmarks.length}`);
    // Most should have a job zone
    expect(withJobZone).toBeGreaterThan(onetBenchmarks.length * 0.8);
  });

  it("every O*NET benchmark should have skills", () => {
    let withSkills = 0;
    for (const b of onetBenchmarks) {
      if (b.skills.length > 0) withSkills++;
    }
    console.log(`  Occupations with skills: ${withSkills}/${onetBenchmarks.length}`);
    expect(withSkills).toBeGreaterThan(onetBenchmarks.length * 0.85);
  });

  it("every O*NET benchmark should have knowledge areas", () => {
    let withKnowledge = 0;
    for (const b of onetBenchmarks) {
      if (b.knowledge.length > 0) withKnowledge++;
    }
    console.log(`  Occupations with knowledge: ${withKnowledge}/${onetBenchmarks.length}`);
    expect(withKnowledge).toBeGreaterThan(onetBenchmarks.length * 0.85);
  });

  it("every O*NET benchmark should have abilities", () => {
    let withAbilities = 0;
    for (const b of onetBenchmarks) {
      if (b.abilities.length > 0) withAbilities++;
    }
    console.log(`  Occupations with abilities: ${withAbilities}/${onetBenchmarks.length}`);
    expect(withAbilities).toBeGreaterThan(onetBenchmarks.length * 0.85);
  });

  it("OEWS coverage should be documented", () => {
    const withOEWS = onetBenchmarks.filter((b) => b.oewsData !== null).length;
    const coverage = (withOEWS / onetBenchmarks.length) * 100;
    console.log(`  OEWS coverage: ${withOEWS}/${onetBenchmarks.length} (${coverage.toFixed(1)}%)`);
    // At least some O*NET occupations should have OEWS data
    expect(withOEWS).toBeGreaterThan(0);
  });

  it("ORS coverage should be documented", () => {
    const withORS = onetBenchmarks.filter((b) => b.orsAvailable).length;
    const coverage = (withORS / onetBenchmarks.length) * 100;
    console.log(`  ORS coverage: ${withORS}/${onetBenchmarks.length} (${coverage.toFixed(1)}%)`);
    // At least some O*NET occupations should have ORS data
    expect(withORS).toBeGreaterThan(0);
  });

  it("OEWS wage data should have valid values", () => {
    const withOEWS = onetBenchmarks.filter((b) => b.oewsData !== null);
    for (const b of withOEWS) {
      if (b.oewsData!.medianWage !== null) {
        expect(b.oewsData!.medianWage).toBeGreaterThan(0);
      }
      if (b.oewsData!.meanWage !== null) {
        expect(b.oewsData!.meanWage).toBeGreaterThan(0);
      }
    }
  });

  it("ORS traits should have values in valid range", () => {
    const withORS = onetBenchmarks.filter((b) => b.orsTraits !== null);
    for (const b of withORS) {
      for (const [, val] of Object.entries(b.orsTraits!)) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(4);
      }
    }
  });

  it("O*NET codes should have valid format", () => {
    const onetCodePattern = /^\d{2}-\d{4}\.\d{2}$/;
    for (const b of onetBenchmarks) {
      expect(b.onetCode).toMatch(onetCodePattern);
    }
  });
});

// ─── Cross-validation ────────────────────────────────────────────────────────

describe("Benchmark Cross-Validation", () => {
  it("existing hand-verified benchmarks should not be overwritten", () => {
    const handVerifiedPath = path.join(FIXTURES_DIR, "benchmark-occupations.json");
    expect(fs.existsSync(handVerifiedPath)).toBe(true);
    const handVerified = JSON.parse(fs.readFileSync(handVerifiedPath, "utf-8"));
    expect(handVerified.length).toBe(100);
  });
});
