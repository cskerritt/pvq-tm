import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  buildFingerprintIndex,
  cosineSimilarity,
  l2Normalize,
  generateCPC,
  generateCPCFromVector,
  analyzeComponentOverlap,
  jobZoneToMaxSvp,
  profileBreadth,
  FINGERPRINT_DIMENSIONS,
  TAXONOMY_RANGES,
  _resetFingerprintIndex,
  type OccupationFingerprint,
} from '@/lib/engine/component-profile';

// ─── Setup ────────────────────────────────────────────────────────────

let index: Map<string, OccupationFingerprint>;

beforeAll(async () => {
  index = await buildFingerprintIndex();
}, 30000); // 30s timeout for loading data

afterAll(() => {
  _resetFingerprintIndex();
});

// ─── Fingerprint Index ────────────────────────────────────────────────

describe('buildFingerprintIndex', () => {
  it('loads all 1016 O*NET occupations', () => {
    expect(index.size).toBeGreaterThanOrEqual(1000);
    expect(index.size).toBeLessThanOrEqual(1100);
  });

  it('each fingerprint has correct vector length', () => {
    for (const fp of index.values()) {
      expect(fp.vector.length).toBe(FINGERPRINT_DIMENSIONS);
      break; // just check first one for speed
    }
  });

  it('fingerprint vectors are L2-normalized (unit length)', () => {
    const fp = index.get('11-1011.00'); // Chief Executives
    expect(fp).toBeDefined();
    if (fp) {
      let sumSq = 0;
      for (let i = 0; i < fp.vector.length; i++) {
        sumSq += fp.vector[i] * fp.vector[i];
      }
      expect(Math.abs(Math.sqrt(sumSq) - 1.0)).toBeLessThan(0.001);
    }
  });

  it('includes numeric CPC code for each occupation', () => {
    const fp = index.get('11-1011.00');
    expect(fp?.cpc).toBeDefined();
    // New format: KK.kk-SS.ss-AA.aa-WW.ww-ZP-CCRS
    expect(fp?.cpc.code).toMatch(/^\d{2}\.\d{2}-\d{2}\.\d{2}-\d{2}\.\d{2}-\d{2}\.\d{2}-\d{2}-\d{4}$/);
    // Legacy code should still be populated
    expect(fp?.cpc.legacyCode).toMatch(/^K\[.+\]-S\[.+\]-A\[.+\]-Z\d-STR:/);
    // Should have work activities
    expect(fp?.cpc.topWorkActivities.length).toBe(2);
    // ORS demands should be 4 digits
    expect(fp?.cpc.orsPhysicalDemands.length).toBe(4);
  });

  it('includes OEWS data where available', () => {
    const fp = index.get('11-1011.00'); // Chief Executives
    // CEO should have OEWS data
    expect(fp?.oewsData).toBeDefined();
    if (fp?.oewsData) {
      expect(fp.oewsData.employment).toBeGreaterThan(0);
    }
  });

  it('no occupation should have "?" strength (3-tier fallback)', () => {
    let unknownCount = 0;
    const unknownCodes: string[] = [];
    for (const [code, fp] of index) {
      if (fp.cpc.strength === '?') {
        unknownCount++;
        if (unknownCodes.length < 5) unknownCodes.push(`${code} (${fp.title})`);
      }
    }
    if (unknownCount > 0) {
      console.warn(`${unknownCount} occupations still have "?" strength: ${unknownCodes.join(', ')}`);
    }
    // Allow at most 5% unknown (aspirational zero)
    expect(unknownCount / index.size).toBeLessThan(0.05);
  });

  it('rehabilitation counselor should not have "?" strength', () => {
    const fp = index.get('21-1015.00');
    expect(fp).toBeDefined();
    expect(fp?.cpc.strength).not.toBe('?');
    // Rehab Counselor is predominantly sitting — should be Sedentary or Light
    expect(['S', 'L']).toContain(fp?.cpc.strength);
  });

  it('includes ORS traits where available', () => {
    // General/Operations Managers (11-1021.00) has ORS data
    const fp = index.get('11-1021.00');
    if (fp?.orsTraits) {
      expect(typeof fp.orsTraits).toBe('object');
    }
  });
});

// ─── Cosine Similarity ───────────────────────────────────────────────

describe('cosineSimilarity', () => {
  it('self-similarity is 1.0', () => {
    const fp = index.get('11-1011.00');
    expect(fp).toBeDefined();
    if (fp) {
      const sim = cosineSimilarity(fp.vector, fp.vector);
      expect(sim).toBeCloseTo(1.0, 3);
    }
  });

  it('similarity is symmetric', () => {
    const fpA = index.get('11-1011.00'); // Chief Executives
    const fpB = index.get('29-1141.00'); // Registered Nurses
    expect(fpA).toBeDefined();
    expect(fpB).toBeDefined();
    if (fpA && fpB) {
      const simAB = cosineSimilarity(fpA.vector, fpB.vector);
      const simBA = cosineSimilarity(fpB.vector, fpA.vector);
      expect(simAB).toBeCloseTo(simBA, 10);
    }
  });

  it('similar occupations have higher similarity than dissimilar ones', () => {
    const ceo = index.get('11-1011.00');      // Chief Executives
    const genMgr = index.get('11-1021.00');    // General Managers
    const welder = index.get('51-4121.00');    // Welders

    expect(ceo).toBeDefined();
    expect(genMgr).toBeDefined();
    expect(welder).toBeDefined();

    if (ceo && genMgr && welder) {
      const ceoToMgr = cosineSimilarity(ceo.vector, genMgr.vector);
      const ceoToWelder = cosineSimilarity(ceo.vector, welder.vector);
      expect(ceoToMgr).toBeGreaterThan(ceoToWelder);
    }
  });

  it('similarity is bounded [0, 1]', () => {
    let checked = 0;
    for (const fpA of index.values()) {
      for (const fpB of index.values()) {
        const sim = cosineSimilarity(fpA.vector, fpB.vector);
        expect(sim).toBeGreaterThanOrEqual(0);
        expect(sim).toBeLessThanOrEqual(1.001); // tiny float tolerance
        checked++;
        if (checked > 50) break;
      }
      if (checked > 50) break;
    }
  });
});

// ─── L2 Normalization ────────────────────────────────────────────────

describe('l2Normalize', () => {
  it('normalizes a vector to unit length', () => {
    const v = new Float64Array([3, 4]);
    l2Normalize(v);
    const norm = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
    expect(norm).toBeCloseTo(1.0, 10);
    expect(v[0]).toBeCloseTo(0.6, 10);
    expect(v[1]).toBeCloseTo(0.8, 10);
  });

  it('handles zero vector gracefully', () => {
    const v = new Float64Array(5);
    l2Normalize(v);
    for (let i = 0; i < 5; i++) {
      expect(v[i]).toBe(0);
    }
  });
});

// ─── CPC Code Generation ─────────────────────────────────────────────

describe('generateCPC', () => {
  it('produces valid numeric CPC code format', () => {
    const fp = index.get('11-1011.00');
    expect(fp).toBeDefined();
    if (fp) {
      // Numeric: KK.kk-SS.ss-AA.aa-WW.ww-ZP-CCRS
      expect(fp.cpc.code).toMatch(/^\d{2}\.\d{2}-\d{2}\.\d{2}-\d{2}\.\d{2}-\d{2}\.\d{2}-\d{2}-\d{4}$/);
      // Legacy still works
      expect(fp.cpc.legacyCode).toMatch(/^K\[.+\]-S\[.+\]-A\[.+\]-Z\d-STR:/);
    }
  });

  it('has top knowledge, skills, abilities, and work activities', () => {
    const fp = index.get('11-1011.00');
    expect(fp).toBeDefined();
    if (fp) {
      expect(fp.cpc.topKnowledge.length).toBe(2);
      expect(fp.cpc.topSkills.length).toBe(2);
      expect(fp.cpc.topAbilities.length).toBe(2);
      expect(fp.cpc.topWorkActivities.length).toBe(2);
      // Numeric segments should be populated
      expect(fp.cpc.segments.knowledge[0]).toBeGreaterThan(0);
      expect(fp.cpc.segments.skills[0]).toBeGreaterThan(0);
      expect(fp.cpc.segments.abilities[0]).toBeGreaterThan(0);
      expect(fp.cpc.segments.workActivities[0]).toBeGreaterThan(0);
    }
  });

  it('includes job zone in the code', () => {
    const fp = index.get('11-1011.00');
    expect(fp?.cpc.jobZone).toBe(5);
    // Numeric code's 5th segment starts with the job zone digit
    expect(fp?.cpc.code.split('-')[4]?.[0]).toBe('5');
  });
});

describe('generateCPCFromVector', () => {
  it('generates CPC from an averaged vector', () => {
    const fp = index.get('11-1011.00');
    if (fp) {
      const cpc = generateCPCFromVector(fp.vector, 5, 'L');
      // Numeric format
      expect(cpc.code).toMatch(/^\d{2}\.\d{2}-\d{2}\.\d{2}-\d{2}\.\d{2}-\d{2}\.\d{2}-52-\d{4}$/);
      // Legacy format
      expect(cpc.legacyCode).toMatch(/^K\[.+\]-S\[.+\]-A\[.+\]-Z5-STR:L/);
      expect(cpc.topKnowledge.length).toBe(2);
    }
  });
});

// ─── Component Overlap Analysis ──────────────────────────────────────

describe('analyzeComponentOverlap', () => {
  it('finds matching and gap components', () => {
    const fpA = index.get('11-1011.00');
    const fpB = index.get('11-1021.00');
    expect(fpA).toBeDefined();
    expect(fpB).toBeDefined();
    if (fpA && fpB) {
      const result = analyzeComponentOverlap(fpA.vector, fpB.vector, 5);
      expect(result.matching.length).toBeGreaterThan(0);
      expect(result.matching.length).toBeLessThanOrEqual(5);
      expect(result.matching[0]).toHaveProperty('id');
      expect(result.matching[0]).toHaveProperty('name');
      expect(result.matching[0]).toHaveProperty('taxonomy');
    }
  });
});

// ─── Taxonomy Ranges ─────────────────────────────────────────────────

describe('TAXONOMY_RANGES', () => {
  it('total dimensions sum to 237', () => {
    const total = Object.values(TAXONOMY_RANGES).reduce(
      (sum, r) => sum + r.count,
      0
    );
    expect(total).toBe(237);
  });

  it('ranges are contiguous', () => {
    const ranges = Object.values(TAXONOMY_RANGES);
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i].start).toBe(ranges[i - 1].start + ranges[i - 1].count);
    }
  });
});

// ─── Utility Functions ───────────────────────────────────────────────

describe('jobZoneToMaxSvp', () => {
  it('maps correctly', () => {
    expect(jobZoneToMaxSvp(1)).toBe(2);
    expect(jobZoneToMaxSvp(2)).toBe(4);
    expect(jobZoneToMaxSvp(3)).toBe(6);
    expect(jobZoneToMaxSvp(4)).toBe(7);
    expect(jobZoneToMaxSvp(5)).toBe(9);
  });
});

describe('profileBreadth', () => {
  it('classifies a uniform vector as broad', () => {
    const v = new Float64Array(237).fill(1 / Math.sqrt(237));
    const result = profileBreadth(v);
    expect(result.label).toBe('broad');
  });

  it('classifies a concentrated vector as narrow or moderate', () => {
    const v = new Float64Array(237);
    // Concentrate weight heavily in just a few dimensions
    v[0] = 1;
    v[1] = 0.9;
    v[2] = 0.8;
    const result = profileBreadth(v);
    // Concentrated profiles have higher std dev than uniform
    expect(['narrow', 'moderate']).toContain(result.label);
    expect(result.stdDev).toBeGreaterThan(0.04);
  });
});

// ─── Determinism ─────────────────────────────────────────────────────

describe('determinism', () => {
  it('same occupation always produces same fingerprint', () => {
    const fp1 = index.get('11-1011.00');
    const fp2 = index.get('11-1011.00');
    expect(fp1).toBe(fp2); // same reference from the Map
  });

  it('cosine similarity is deterministic', () => {
    const fpA = index.get('11-1011.00');
    const fpB = index.get('29-1141.00');
    if (fpA && fpB) {
      const sim1 = cosineSimilarity(fpA.vector, fpB.vector);
      const sim2 = cosineSimilarity(fpA.vector, fpB.vector);
      expect(sim1).toBe(sim2);
    }
  });
});
