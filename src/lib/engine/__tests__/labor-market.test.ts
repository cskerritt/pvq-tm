import { describe, it, expect } from 'vitest';
import { computeLMQ, type LaborMarketInput } from '@/lib/engine/labor-market';

// ─── Helpers ──────────────────────────────────────────────────────────

function makeInput(overrides: Partial<LaborMarketInput> = {}): LaborMarketInput {
  return {
    employment: 50000,
    medianWage: 45000,
    meanWage: 48000,
    priorEarnings: 50000,
    projectedOpenings: 6000,
    projectedGrowthPct: 6,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('computeLMQ', () => {
  it('should compute LMQ with all data available', () => {
    const input = makeInput();
    const result = computeLMQ(input);

    expect(result.lmq).toBeGreaterThan(0);
    expect(result.lmq).toBeLessThanOrEqual(100);
    expect(result.components.employmentScore).toBeGreaterThan(0);
    expect(result.components.wageScore).toBeGreaterThan(0);
    expect(result.components.projectionsScore).toBeGreaterThan(0);
  });

  it('should return high employment score for very high employment', () => {
    const input = makeInput({ employment: 150000 });
    const result = computeLMQ(input);

    // Log-based continuous scoring: 150k -> 87
    expect(result.components.employmentScore).toBe(87);
  });

  it('should return low employment score for very low employment', () => {
    const input = makeInput({ employment: 500 });
    const result = computeLMQ(input);

    // Log-based continuous scoring: 500 -> 27
    expect(result.components.employmentScore).toBe(27);
  });

  it('should score employment using log-based continuous scaling', () => {
    // Log-based continuous scoring (no cliff thresholds)
    expect(computeLMQ(makeInput({ employment: 100001 })).components.employmentScore).toBe(83);
    expect(computeLMQ(makeInput({ employment: 50001 })).components.employmentScore).toBe(76);
    expect(computeLMQ(makeInput({ employment: 20001 })).components.employmentScore).toBe(66);
    expect(computeLMQ(makeInput({ employment: 5001 })).components.employmentScore).toBe(51);
    expect(computeLMQ(makeInput({ employment: 1001 })).components.employmentScore).toBe(34);
    expect(computeLMQ(makeInput({ employment: 1000 })).components.employmentScore).toBe(34);
  });

  it('should give perfect wage score when target wage meets prior earnings', () => {
    const input = makeInput({ medianWage: 60000, priorEarnings: 50000 });
    const result = computeLMQ(input);

    expect(result.components.wageScore).toBe(100);
    expect(result.details.wageRatio).toBeCloseTo(1.2, 1);
  });

  it('should give lower wage score when target wage is much less than prior', () => {
    const input = makeInput({ medianWage: 20000, priorEarnings: 50000 });
    const result = computeLMQ(input);

    // ratio = 0.4, continuous score = 10 + min(90, 0.4*90) = 10 + 36 = 46
    expect(result.components.wageScore).toBe(46);
  });

  it('should use absolute wage scoring when priorEarnings is null', () => {
    const highWage = computeLMQ(makeInput({ medianWage: 70000, priorEarnings: null }));
    const lowWage = computeLMQ(makeInput({ medianWage: 20000, priorEarnings: null }));

    // Absolute scoring: wage/80000*100 -> 70000/80000*100=87.5->88, 20000/80000*100=25
    expect(highWage.components.wageScore).toBe(88);
    expect(lowWage.components.wageScore).toBe(25);
  });

  it('should use absolute wage scoring when priorEarnings is zero', () => {
    const result = computeLMQ(makeInput({ medianWage: 45000, priorEarnings: 0 }));
    // Absolute scoring: 45000/80000*100 = 56.25 -> 56
    expect(result.components.wageScore).toBe(56);
  });

  it('should return neutral scores when data is null', () => {
    const input = makeInput({
      employment: null,
      medianWage: null,
      meanWage: null,
      priorEarnings: null,
      projectedOpenings: null,
      projectedGrowthPct: null,
    });

    const result = computeLMQ(input);

    // All null -> neutral scores of 50
    expect(result.components.employmentScore).toBe(50);
    expect(result.components.wageScore).toBe(50);
    expect(result.components.projectionsScore).toBe(50);
    // All null -> neutral, LMQ = 50
    expect(result.lmq).toBe(50);
  });

  it('should give maximum projections score for high growth and high openings', () => {
    const input = makeInput({ projectedGrowthPct: 15, projectedOpenings: 20000 });
    const result = computeLMQ(input);

    expect(result.components.projectionsScore).toBe(100);
  });

  it('should give lowest projections score for declining with few openings', () => {
    const input = makeInput({ projectedGrowthPct: -5, projectedOpenings: 500 });
    const result = computeLMQ(input);

    // Log-based scoring: growth -5 -> 33, openings 500 -> 55, avg -> 44
    expect(result.components.projectionsScore).toBe(44);
  });

  it('should compute correct weighted composite', () => {
    // Set up inputs that produce known scores
    const input = makeInput({
      employment: 150000,       // log-based score = 87
      medianWage: 60000,        // ratio=1.2 >= 1.0, score = 100
      priorEarnings: 50000,
      projectedGrowthPct: 15,   // growth=100, openings log-based=95, avg=98
      projectedOpenings: 15000,
    });

    const result = computeLMQ(input);

    // Weights redistribute: emp=0.357, wage=0.357, proj=0.286
    // LMQ = 0.357*87 + 0.357*100 + 0.286*98 = 94.79
    expect(result.lmq).toBeCloseTo(94.79, 1);
  });

  it('should preserve all detail fields in output', () => {
    const input = makeInput({
      employment: 50000,
      medianWage: 45000,
      meanWage: 48000,
      priorEarnings: 50000,
      projectedOpenings: 6000,
      projectedGrowthPct: 6,
      pct10: 25000,
      pct25: 35000,
      pct75: 55000,
      pct90: 70000,
    });

    const result = computeLMQ(input);

    expect(result.details.employment).toBe(50000);
    expect(result.details.medianWage).toBe(45000);
    expect(result.details.meanWage).toBe(48000);
    expect(result.details.projectedOpenings).toBe(6000);
    expect(result.details.projectedGrowthPct).toBe(6);
    expect(result.details.pct10).toBe(25000);
    expect(result.details.pct25).toBe(35000);
    expect(result.details.pct75).toBe(55000);
    expect(result.details.pct90).toBe(70000);
  });

  it('should default percentile fields to null when not provided', () => {
    const input = makeInput();
    const result = computeLMQ(input);

    expect(result.details.pct10).toBeNull();
    expect(result.details.pct25).toBeNull();
    expect(result.details.pct75).toBeNull();
    expect(result.details.pct90).toBeNull();
  });
});
