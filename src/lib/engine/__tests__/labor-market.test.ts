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

  it('should return maximum employment score for very high employment', () => {
    const input = makeInput({ employment: 150000 });
    const result = computeLMQ(input);

    expect(result.components.employmentScore).toBe(100);
  });

  it('should return lowest employment score for very low employment', () => {
    const input = makeInput({ employment: 500 });
    const result = computeLMQ(input);

    expect(result.components.employmentScore).toBe(10);
  });

  it('should score employment at correct thresholds', () => {
    // > 100,000 = 100
    expect(computeLMQ(makeInput({ employment: 100001 })).components.employmentScore).toBe(100);
    // > 50,000 = 80
    expect(computeLMQ(makeInput({ employment: 50001 })).components.employmentScore).toBe(80);
    // > 20,000 = 60
    expect(computeLMQ(makeInput({ employment: 20001 })).components.employmentScore).toBe(60);
    // > 5,000 = 40
    expect(computeLMQ(makeInput({ employment: 5001 })).components.employmentScore).toBe(40);
    // > 1,000 = 20
    expect(computeLMQ(makeInput({ employment: 1001 })).components.employmentScore).toBe(20);
    // <= 1,000 = 10
    expect(computeLMQ(makeInput({ employment: 1000 })).components.employmentScore).toBe(10);
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

    // ratio = 0.4, score = 20
    expect(result.components.wageScore).toBe(20);
  });

  it('should use absolute wage scoring when priorEarnings is null', () => {
    const highWage = computeLMQ(makeInput({ medianWage: 70000, priorEarnings: null }));
    const lowWage = computeLMQ(makeInput({ medianWage: 20000, priorEarnings: null }));

    expect(highWage.components.wageScore).toBe(80);
    expect(lowWage.components.wageScore).toBe(20);
  });

  it('should use absolute wage scoring when priorEarnings is zero', () => {
    const result = computeLMQ(makeInput({ medianWage: 45000, priorEarnings: 0 }));
    expect(result.components.wageScore).toBe(60);
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
    // LMQ = 0.4*50 + 0.35*50 + 0.25*50 = 50
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

    expect(result.components.projectionsScore).toBe(20);
  });

  it('should compute correct weighted composite', () => {
    // Set up inputs that produce known scores
    const input = makeInput({
      employment: 150000,       // score = 100
      medianWage: 60000,        // >= priorEarnings=50000, ratio >= 1.0, score = 100
      priorEarnings: 50000,
      projectedGrowthPct: 15,   // growth > 10 AND openings > 10000, score = 100
      projectedOpenings: 15000,
    });

    const result = computeLMQ(input);

    // LMQ = 0.4*100 + 0.35*100 + 0.25*100 = 100
    expect(result.lmq).toBe(100);
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
