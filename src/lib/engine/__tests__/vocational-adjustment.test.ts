import { describe, it, expect } from 'vitest';
import {
  computeVAQ,
  defaultAdjustment,
  estimateVAQ,
  ADJUSTMENT_LABELS,
  type VocationalAdjustment,
} from '@/lib/engine/vocational-adjustment';

// ─── Tests ────────────────────────────────────────────────────────────

describe('ADJUSTMENT_LABELS', () => {
  it('should define labels for all four levels', () => {
    expect(ADJUSTMENT_LABELS[100]).toBe('Very little or none');
    expect(ADJUSTMENT_LABELS[67]).toBe('Slight');
    expect(ADJUSTMENT_LABELS[33]).toBe('Moderate');
    expect(ADJUSTMENT_LABELS[0]).toBe('Substantial');
  });
});

describe('defaultAdjustment', () => {
  it('should return all dimensions set to 0 (substantial)', () => {
    const adj = defaultAdjustment();
    expect(adj.tools).toBe(0);
    expect(adj.workProcesses).toBe(0);
    expect(adj.workSetting).toBe(0);
    expect(adj.industry).toBe(0);
  });
});

describe('computeVAQ', () => {
  it('should compute correct average for standard age rule', () => {
    const adjustment: VocationalAdjustment = {
      tools: 100,
      workProcesses: 67,
      workSetting: 67,
      industry: 33,
    };

    const result = computeVAQ(adjustment, 'standard');

    // Average = (100 + 67 + 67 + 33) / 4 = 66.75
    expect(result.vaq).toBeCloseTo(66.75, 2);
    expect(result.passes).toBe(true);
    expect(result.ageRule).toBe('standard');
  });

  it('should return 100 VAQ when all dimensions are perfect', () => {
    const adjustment: VocationalAdjustment = {
      tools: 100,
      workProcesses: 100,
      workSetting: 100,
      industry: 100,
    };

    const result = computeVAQ(adjustment);
    expect(result.vaq).toBe(100);
    expect(result.passes).toBe(true);
  });

  it('should return 0 VAQ when all dimensions are substantial', () => {
    const adjustment: VocationalAdjustment = {
      tools: 0,
      workProcesses: 0,
      workSetting: 0,
      industry: 0,
    };

    const result = computeVAQ(adjustment, 'standard');
    expect(result.vaq).toBe(0);
    expect(result.passes).toBe(true); // standard rule still passes even at 0
  });

  it('should default to standard age rule', () => {
    const adjustment: VocationalAdjustment = {
      tools: 67,
      workProcesses: 67,
      workSetting: 67,
      industry: 67,
    };

    const result = computeVAQ(adjustment);
    expect(result.ageRule).toBe('standard');
    expect(result.passes).toBe(true);
  });

  it('should disqualify under advanced_age rule when any dimension < 100', () => {
    const adjustment: VocationalAdjustment = {
      tools: 100,
      workProcesses: 67,  // not 100
      workSetting: 100,
      industry: 100,
    };

    const result = computeVAQ(adjustment, 'advanced_age');

    expect(result.passes).toBe(false);
    expect(result.vaq).toBe(0);
    expect(result.disqualifyingReason).toContain('work processes');
  });

  it('should disqualify under closely_approaching rule when any dimension < 100', () => {
    const adjustment: VocationalAdjustment = {
      tools: 33,
      workProcesses: 100,
      workSetting: 100,
      industry: 100,
    };

    const result = computeVAQ(adjustment, 'closely_approaching');

    expect(result.passes).toBe(false);
    expect(result.vaq).toBe(0);
    expect(result.disqualifyingReason).toContain('tools');
  });

  it('should pass under advanced_age rule when all dimensions are 100', () => {
    const adjustment: VocationalAdjustment = {
      tools: 100,
      workProcesses: 100,
      workSetting: 100,
      industry: 100,
    };

    const result = computeVAQ(adjustment, 'advanced_age');

    expect(result.passes).toBe(true);
    expect(result.vaq).toBe(100);
  });

  it('should list all failing dimensions for advanced age', () => {
    const adjustment: VocationalAdjustment = {
      tools: 67,
      workProcesses: 33,
      workSetting: 0,
      industry: 67,
    };

    const result = computeVAQ(adjustment, 'advanced_age');

    expect(result.passes).toBe(false);
    expect(result.disqualifyingReason).toContain('tools');
    expect(result.disqualifyingReason).toContain('work processes');
    expect(result.disqualifyingReason).toContain('work setting');
    expect(result.disqualifyingReason).toContain('industry');
  });

  it('should preserve the adjustment object in the result', () => {
    const adjustment: VocationalAdjustment = {
      tools: 67,
      workProcesses: 33,
      workSetting: 100,
      industry: 0,
    };

    const result = computeVAQ(adjustment);
    expect(result.adjustment).toEqual(adjustment);
  });
});

describe('estimateVAQ', () => {
  it('should return autoEstimated flag', () => {
    const result = estimateVAQ([], null, [], null);
    expect(result.autoEstimated).toBe(true);
  });

  it('should return conservative defaults when no data is available', () => {
    const result = estimateVAQ([], null, [], null);

    // No data -> defaults to 67 (slight) for all dimensions
    expect(result.tools).toBe(67);
    expect(result.workProcesses).toBe(67);
    expect(result.workSetting).toBe(67);
    expect(result.industry).toBe(67);
  });

  it('should estimate high tools overlap when ONET tools match', () => {
    const sourceOnet = [
      { toolsTech: [{ title: 'Hammer' }, { title: 'Screwdriver' }, { title: 'Drill' }, { title: 'Wrench' }] },
    ];
    const targetOnet = {
      toolsTech: [{ title: 'Hammer' }, { title: 'Screwdriver' }, { title: 'Drill' }, { title: 'Wrench' }],
    };

    const result = estimateVAQ([], null, sourceOnet, targetOnet);
    expect(result.tools).toBe(100);
  });

  it('should estimate low tools overlap when ONET tools do not match', () => {
    const sourceOnet = [
      { toolsTech: [{ title: 'Hammer' }, { title: 'Saw' }] },
    ];
    const targetOnet = {
      toolsTech: [{ title: 'Computer' }, { title: 'Microscope' }, { title: 'Centrifuge' }, { title: 'Pipette' }],
    };

    const result = estimateVAQ([], null, sourceOnet, targetOnet);
    expect(result.tools).toBeLessThan(67);
  });

  it('should estimate 100 work processes when GOE groups match', () => {
    const sourceDot = [{ aptitudes: { goe: '0506.01' } }];
    const targetDot = { aptitudes: { goe: '0506.02' } };

    const result = estimateVAQ(sourceDot, targetDot, [], null);
    expect(result.workProcesses).toBe(100);
  });

  it('should estimate 67 work processes when only GOE division matches', () => {
    const sourceDot = [{ aptitudes: { goe: '0506.01' } }];
    const targetDot = { aptitudes: { goe: '0512.03' } };

    const result = estimateVAQ(sourceDot, targetDot, [], null);
    expect(result.workProcesses).toBe(67);
  });

  it('should estimate 33 work processes when GOE codes are different', () => {
    const sourceDot = [{ aptitudes: { goe: '0506.01' } }];
    const targetDot = { aptitudes: { goe: '1104.02' } };

    const result = estimateVAQ(sourceDot, targetDot, [], null);
    expect(result.workProcesses).toBe(33);
  });

  it('should estimate 100 work setting for same industry designation', () => {
    const sourceDot = [{ industryDesig: 'construction' }];
    const targetDot = { industryDesig: 'construction' };

    const result = estimateVAQ(sourceDot, targetDot, [], null);
    expect(result.workSetting).toBe(100);
  });

  it('should estimate 33 work setting for completely different industries', () => {
    const sourceDot = [{ industryDesig: 'agriculture' }];
    const targetDot = { industryDesig: 'electronics' };

    const result = estimateVAQ(sourceDot, targetDot, [], null);
    expect(result.workSetting).toBe(33);
  });
});
