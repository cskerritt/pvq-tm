import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  buildWorkerComponentProfile,
  generateCPCCandidates,
  computeGapAnalysis,
  buildCPCAnalysis,
  type WorkerComponentProfile,
} from '@/lib/engine/cpc-candidates';
import {
  buildFingerprintIndex,
  FINGERPRINT_DIMENSIONS,
  _resetFingerprintIndex,
} from '@/lib/engine/component-profile';

// ─── Setup ────────────────────────────────────────────────────────────

beforeAll(async () => {
  await buildFingerprintIndex();
}, 30000);

afterAll(() => {
  _resetFingerprintIndex();
});

// ─── Worker Component Profile ─────────────────────────────────────────

describe('buildWorkerComponentProfile', () => {
  it('builds a valid profile from PRW O*NET codes', async () => {
    const profile = await buildWorkerComponentProfile(
      ['11-1011.00', '11-1021.00'], // CEO + General Manager
      7,
      1 // Light strength
    );

    expect(profile.compositeVector.length).toBe(FINGERPRINT_DIMENSIONS);
    expect(profile.prwFingerprints.length).toBe(2);
    expect(profile.maxSvp).toBe(7);
    expect(profile.postStrength).toBe(1);
    expect(profile.cpc.code).toMatch(/^K\[.+\]-S\[.+\]-A\[.+\]-Z\d-STR:L/);
    expect(profile.breadth).toHaveProperty('label');
    expect(profile.topComponents.length).toBeGreaterThan(0);
  });

  it('handles single PRW code', async () => {
    const profile = await buildWorkerComponentProfile(
      ['29-1141.00'], // Registered Nurses
      6,
      2
    );

    expect(profile.prwFingerprints.length).toBe(1);
    expect(profile.compositeVector.length).toBe(FINGERPRINT_DIMENSIONS);
  });

  it('handles empty PRW codes gracefully', async () => {
    const profile = await buildWorkerComponentProfile([], 4, 2);
    expect(profile.prwFingerprints.length).toBe(0);
    expect(profile.compositeVector.length).toBe(FINGERPRINT_DIMENSIONS);
  });

  it('composite vector is L2-normalized', async () => {
    const profile = await buildWorkerComponentProfile(
      ['11-1011.00', '11-1021.00'],
      7,
      1
    );

    let sumSq = 0;
    for (let i = 0; i < profile.compositeVector.length; i++) {
      sumSq += profile.compositeVector[i] * profile.compositeVector[i];
    }
    // Should be 1.0 (unit vector) or 0 (empty)
    const norm = Math.sqrt(sumSq);
    expect(norm).toBeCloseTo(1.0, 3);
  });
});

// ─── CPC Candidate Generation ─────────────────────────────────────────

describe('generateCPCCandidates', () => {
  let workerProfile: WorkerComponentProfile;

  beforeAll(async () => {
    workerProfile = await buildWorkerComponentProfile(
      ['11-1011.00', '11-1021.00'],
      7,
      1
    );
  });

  it('returns sorted candidates by similarity descending', async () => {
    const results = await generateCPCCandidates(workerProfile, {
      topN: 10,
    });

    expect(results.length).toBeLessThanOrEqual(10);
    expect(results.length).toBeGreaterThan(0);

    // Check descending order
    for (let i = 1; i < results.length; i++) {
      expect(results[i].cosineSimilarity).toBeLessThanOrEqual(
        results[i - 1].cosineSimilarity
      );
    }
  });

  it('respects SVP gate', async () => {
    const results = await generateCPCCandidates(workerProfile, {
      topN: 50,
      maxSvp: 4, // Only unskilled/semi-skilled
    });

    // All results should have job zone ≤ 2 (SVP ≤ 4)
    for (const r of results) {
      expect(r.jobZone).toBeLessThanOrEqual(2);
    }
  });

  it('respects minSimilarity threshold', async () => {
    const results = await generateCPCCandidates(workerProfile, {
      minSimilarity: 0.8,
    });

    for (const r of results) {
      expect(r.cosineSimilarity).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('excludes specified codes', async () => {
    const excludeSet = new Set(['11-1011.00', '11-1021.00']);
    const results = await generateCPCCandidates(workerProfile, {
      excludeCodes: excludeSet,
      topN: 20,
    });

    for (const r of results) {
      expect(excludeSet.has(r.onetCode)).toBe(false);
    }
  });

  it('includes matching and gap components', async () => {
    const results = await generateCPCCandidates(workerProfile, {
      topN: 5,
    });

    for (const r of results) {
      expect(r.topMatchingComponents).toBeDefined();
      expect(r.topGapComponents).toBeDefined();
      expect(r.cpc).toBeDefined();
      expect(r.cpc.code).toMatch(/^K\[/);
    }
  });

  it('includes OEWS employment/wage data', async () => {
    const results = await generateCPCCandidates(workerProfile, {
      topN: 20,
    });

    // At least some results should have OEWS data
    const withEmployment = results.filter((r) => r.employment !== null);
    expect(withEmployment.length).toBeGreaterThan(0);
  });

  it('relaxSvp allows higher SVP occupations', async () => {
    const strict = await generateCPCCandidates(workerProfile, {
      topN: 100,
      maxSvp: 4,
      minSimilarity: 0.1,
    });
    const relaxed = await generateCPCCandidates(workerProfile, {
      topN: 100,
      maxSvp: 4,
      relaxSvp: true,
      minSimilarity: 0.1,
    });

    expect(relaxed.length).toBeGreaterThanOrEqual(strict.length);
  });
});

// ─── Gap Analysis ─────────────────────────────────────────────────────

describe('computeGapAnalysis', () => {
  it('produces worker strengths and market gaps', async () => {
    const profile = await buildWorkerComponentProfile(
      ['11-1011.00'],
      7,
      1
    );
    const candidates = await generateCPCCandidates(profile, { topN: 15 });
    const gap = computeGapAnalysis(profile, candidates);

    expect(gap.workerStrengths.length).toBeGreaterThan(0);
    expect(gap.profileBreadth).toBeTruthy();
    expect(gap.narrative).toBeTruthy();
    expect(typeof gap.narrative).toBe('string');
  });
});

// ─── Full CPC Analysis ───────────────────────────────────────────────

describe('buildCPCAnalysis', () => {
  it('produces complete analysis with all sections', async () => {
    const analysis = await buildCPCAnalysis(
      ['11-1011.00', '11-1021.00'],
      7,
      1,
      { topN: 10 }
    );

    // Worker profile
    expect(analysis.workerProfile.cpc.code).toMatch(/^K\[/);
    expect(analysis.workerProfile.breadth).toBeDefined();
    expect(analysis.workerProfile.topComponents.length).toBeGreaterThan(0);
    expect(analysis.workerProfile.prwOccupations.length).toBe(2);

    // Similar occupations
    expect(analysis.similarOccupations.length).toBeGreaterThan(0);
    expect(analysis.similarOccupations.length).toBeLessThanOrEqual(10);

    // Gap analysis
    expect(analysis.gapAnalysis.narrative).toBeTruthy();

    // Labor market summary
    expect(analysis.laborMarketSummary).toBeDefined();
    expect(typeof analysis.laborMarketSummary.totalEmployment).toBe('number');
  });

  it('is fully deterministic', async () => {
    const a1 = await buildCPCAnalysis(['11-1011.00'], 7, 1, { topN: 5 });
    const a2 = await buildCPCAnalysis(['11-1011.00'], 7, 1, { topN: 5 });

    expect(a1.similarOccupations.length).toBe(a2.similarOccupations.length);
    for (let i = 0; i < a1.similarOccupations.length; i++) {
      expect(a1.similarOccupations[i].onetCode).toBe(
        a2.similarOccupations[i].onetCode
      );
      expect(a1.similarOccupations[i].cosineSimilarity).toBe(
        a2.similarOccupations[i].cosineSimilarity
      );
    }
  });
});
