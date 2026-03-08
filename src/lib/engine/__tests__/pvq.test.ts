import { describe, it, expect } from 'vitest';
import { computePVQ, rankOccupations, PVQ_WEIGHTS } from '@/lib/engine/pvq';
import type { STQResult } from '@/lib/engine/skill-transfer';
import type { TFQResult } from '@/lib/engine/trait-feasibility';
import type { VAQResult } from '@/lib/engine/vocational-adjustment';
import type { LMQResult } from '@/lib/engine/labor-market';

// ─── Helpers ──────────────────────────────────────────────────────────

function makeSTQ(overrides: Partial<STQResult> = {}): STQResult {
  return {
    stq: 70,
    passesGate: true,
    components: {
      taskDwaOverlap: 60,
      wfMpsmsOverlap: 50,
      toolsOverlap: 40,
      materialsOverlap: 30,
      credentialOverlap: 20,
    },
    details: {
      matchedTasks: ['task1'],
      matchedDWAs: ['dwa1'],
      matchedTools: ['tool1'],
      matchedMaterials: [],
      matchedKnowledge: [],
    },
    ...overrides,
  };
}

function makeTFQ(overrides: Partial<TFQResult> = {}): TFQResult {
  return {
    tfq: 65,
    passes: true,
    failedTraits: [],
    traitComparisons: [],
    reserveMargin: 30,
    ...overrides,
  };
}

function makeVAQ(overrides: Partial<VAQResult> = {}): VAQResult {
  return {
    vaq: 75,
    passes: true,
    adjustment: {
      tools: 100,
      workProcesses: 67,
      workSetting: 67,
      industry: 67,
    },
    ageRule: 'standard' as const,
    ...overrides,
  };
}

function makeLMQ(overrides: Partial<LMQResult> = {}): LMQResult {
  return {
    lmq: 60,
    components: {
      employmentScore: 80,
      wageScore: 60,
      projectionsScore: 40,
    },
    details: {
      employment: 50000,
      medianWage: 45000,
      meanWage: 48000,
      wageRatio: 0.9,
      projectedOpenings: 5000,
      projectedGrowthPct: 3,
      pct10: null,
      pct25: null,
      pct75: null,
      pct90: null,
    },
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('PVQ_WEIGHTS', () => {
  it('should sum to 1.0', () => {
    const sum = PVQ_WEIGHTS.stq + PVQ_WEIGHTS.tfq + PVQ_WEIGHTS.vaq + PVQ_WEIGHTS.lmq;
    expect(sum).toBeCloseTo(1.0);
  });

  it('should have expected individual weights', () => {
    expect(PVQ_WEIGHTS.stq).toBe(0.45);
    expect(PVQ_WEIGHTS.tfq).toBe(0.25);
    expect(PVQ_WEIGHTS.vaq).toBe(0.15);
    expect(PVQ_WEIGHTS.lmq).toBe(0.15);
  });
});

describe('computePVQ', () => {
  it('should compute correct weighted composite when all gates pass', () => {
    const stq = makeSTQ({ stq: 80 });
    const tfq = makeTFQ({ tfq: 60 });
    const vaq = makeVAQ({ vaq: 75 });
    const lmq = makeLMQ({ lmq: 50 });

    const result = computePVQ(stq, tfq, vaq, lmq);

    // Expected: 0.45*80 + 0.25*60 + 0.15*75 + 0.15*50 = 36 + 15 + 11.25 + 7.5 = 69.75
    expect(result.excluded).toBe(false);
    expect(result.pvq).toBeCloseTo(69.75, 2);
    expect(result.stq).toBe(80);
    expect(result.tfq).toBe(60);
    expect(result.vaq).toBe(75);
    expect(result.lmq).toBe(50);
  });

  it('should exclude when STQ SVP gate fails', () => {
    const stq = makeSTQ({
      stq: 0,
      passesGate: false,
      gateReason: 'Target SVP (6) exceeds source SVP (4)',
    });
    const tfq = makeTFQ();
    const vaq = makeVAQ();
    const lmq = makeLMQ();

    const result = computePVQ(stq, tfq, vaq, lmq);

    expect(result.excluded).toBe(true);
    expect(result.pvq).toBe(0);
    expect(result.exclusionReason).toContain('SVP');
  });

  it('should exclude when TFQ trait fails', () => {
    const stq = makeSTQ();
    const tfq = makeTFQ({
      tfq: 0,
      passes: false,
      failedTraits: [
        {
          trait: 'strength',
          label: 'Strength',
          workerCapacity: 1,
          occupationDemand: 3,
          margin: -2,
          passes: false,
          source: 'DOT',
        },
      ],
    });
    const vaq = makeVAQ();
    const lmq = makeLMQ();

    const result = computePVQ(stq, tfq, vaq, lmq);

    expect(result.excluded).toBe(true);
    expect(result.pvq).toBe(0);
    expect(result.exclusionReason).toContain('Strength');
  });

  it('should exclude when VAQ fails (advanced age)', () => {
    const stq = makeSTQ();
    const tfq = makeTFQ();
    const vaq = makeVAQ({
      vaq: 0,
      passes: false,
      disqualifyingReason: 'Advanced age rule requires very little or no vocational adjustment.',
    });
    const lmq = makeLMQ();

    const result = computePVQ(stq, tfq, vaq, lmq);

    expect(result.excluded).toBe(true);
    expect(result.pvq).toBe(0);
    expect(result.exclusionReason).toContain('vocational adjustment');
  });

  it('should preserve component results in the output', () => {
    const stq = makeSTQ();
    const tfq = makeTFQ();
    const vaq = makeVAQ();
    const lmq = makeLMQ();

    const result = computePVQ(stq, tfq, vaq, lmq);

    expect(result.components.stqResult).toBe(stq);
    expect(result.components.tfqResult).toBe(tfq);
    expect(result.components.vaqResult).toBe(vaq);
    expect(result.components.lmqResult).toBe(lmq);
  });

  it('should set all sub-scores to 0 when STQ gate fails', () => {
    const stq = makeSTQ({ stq: 0, passesGate: false });
    const result = computePVQ(stq, makeTFQ(), makeVAQ(), makeLMQ());

    expect(result.stq).toBe(0);
    expect(result.tfq).toBe(0);
    expect(result.vaq).toBe(0);
    expect(result.lmq).toBe(0);
  });

  it('should set pvq to 0 but preserve stq when TFQ fails', () => {
    const stq = makeSTQ({ stq: 80 });
    const tfq = makeTFQ({
      passes: false,
      failedTraits: [
        {
          trait: 'reasoning',
          label: 'Reasoning',
          workerCapacity: 1,
          occupationDemand: 3,
          margin: -2,
          passes: false,
          source: 'DOT',
        },
      ],
    });

    const result = computePVQ(stq, tfq, makeVAQ(), makeLMQ());

    expect(result.pvq).toBe(0);
    expect(result.stq).toBe(80);
    expect(result.tfq).toBe(0);
  });

  it('should assign a confidence grade', () => {
    const result = computePVQ(makeSTQ(), makeTFQ(), makeVAQ(), makeLMQ());
    expect(['A', 'B', 'C', 'D']).toContain(result.confidenceGrade);
  });

  it('should handle maximum scores (all 100)', () => {
    const stq = makeSTQ({ stq: 100 });
    const tfq = makeTFQ({ tfq: 100 });
    const vaq = makeVAQ({ vaq: 100 });
    const lmq = makeLMQ({ lmq: 100 });

    const result = computePVQ(stq, tfq, vaq, lmq);

    expect(result.pvq).toBe(100);
    expect(result.excluded).toBe(false);
  });
});

describe('rankOccupations', () => {
  it('should rank non-excluded occupations before excluded ones', () => {
    const included = computePVQ(
      makeSTQ({ stq: 50 }),
      makeTFQ({ tfq: 50 }),
      makeVAQ({ vaq: 50 }),
      makeLMQ({ lmq: 50 }),
    );
    const excluded = computePVQ(
      makeSTQ({ stq: 0, passesGate: false }),
      makeTFQ(),
      makeVAQ(),
      makeLMQ(),
    );

    const ranked = rankOccupations([excluded, included]);
    expect(ranked[0].excluded).toBe(false);
    expect(ranked[1].excluded).toBe(true);
  });

  it('should rank by PVQ descending among non-excluded', () => {
    const high = computePVQ(
      makeSTQ({ stq: 90 }),
      makeTFQ({ tfq: 90 }),
      makeVAQ({ vaq: 90 }),
      makeLMQ({ lmq: 90 }),
    );
    const low = computePVQ(
      makeSTQ({ stq: 30 }),
      makeTFQ({ tfq: 30 }),
      makeVAQ({ vaq: 30 }),
      makeLMQ({ lmq: 30 }),
    );

    const ranked = rankOccupations([low, high]);
    expect(ranked[0].pvq).toBeGreaterThan(ranked[1].pvq);
  });

  it('should return empty array for empty input', () => {
    expect(rankOccupations([])).toEqual([]);
  });

  it('should not mutate the original array', () => {
    const results = [
      computePVQ(makeSTQ({ stq: 30 }), makeTFQ(), makeVAQ(), makeLMQ()),
      computePVQ(makeSTQ({ stq: 90 }), makeTFQ(), makeVAQ(), makeLMQ()),
    ];
    const original = [...results];
    rankOccupations(results);
    expect(results).toEqual(original);
  });
});
