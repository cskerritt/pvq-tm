import { describe, it, expect } from 'vitest';
import {
  computeSTQ,
  checkSvpGate,
  isValidTransferableSkill,
  computeAggregateSTQ,
  type SkillTransferInput,
} from '@/lib/engine/skill-transfer';

// ─── Helpers ──────────────────────────────────────────────────────────

function makeInput(overrides: Partial<SkillTransferInput> = {}): SkillTransferInput {
  return {
    sourceSvp: 5,
    sourceTasks: ['Inspect finished products', 'Operate machines'],
    sourceDWAs: ['Monitor equipment', 'Record data'],
    sourceWorkFields: ['machining'],
    sourceMPSMS: ['metal parts'],
    sourceTools: ['calipers', 'micrometers'],
    sourceMaterials: ['steel', 'aluminum'],
    sourceKnowledge: ['mechanical engineering', 'quality control'],
    targetSvp: 4,
    targetTasks: ['Inspect finished products', 'Read blueprints'],
    targetDWAs: ['Monitor equipment', 'Maintain records'],
    targetWorkFields: ['machining'],
    targetMPSMS: ['metal parts'],
    targetTools: ['calipers', 'gauges'],
    targetMaterials: ['steel', 'plastic'],
    targetKnowledge: ['mechanical engineering', 'manufacturing processes'],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('checkSvpGate', () => {
  it('should pass when target SVP equals source SVP', () => {
    const result = checkSvpGate(5, 5);
    expect(result.passes).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should pass when target SVP is lower than source SVP', () => {
    const result = checkSvpGate(6, 4);
    expect(result.passes).toBe(true);
  });

  it('should fail when target SVP exceeds source SVP', () => {
    const result = checkSvpGate(4, 6);
    expect(result.passes).toBe(false);
    expect(result.reason).toContain('Target SVP (6) exceeds source SVP (4)');
  });

  it('should handle SVP boundary at 1', () => {
    const result = checkSvpGate(1, 1);
    expect(result.passes).toBe(true);
  });
});

describe('isValidTransferableSkill', () => {
  it('should return true for SVP >= 4 (semiskilled)', () => {
    expect(isValidTransferableSkill(4)).toBe(true);
    expect(isValidTransferableSkill(5)).toBe(true);
    expect(isValidTransferableSkill(8)).toBe(true);
  });

  it('should return false for SVP < 4 (unskilled)', () => {
    expect(isValidTransferableSkill(1)).toBe(false);
    expect(isValidTransferableSkill(2)).toBe(false);
    expect(isValidTransferableSkill(3)).toBe(false);
  });

  it('should return false for SVP of 0', () => {
    expect(isValidTransferableSkill(0)).toBe(false);
  });
});

describe('computeSTQ', () => {
  it('should return zero STQ when SVP gate fails', () => {
    const input = makeInput({ sourceSvp: 3, targetSvp: 6 });
    const result = computeSTQ(input);

    expect(result.stq).toBe(0);
    expect(result.passesGate).toBe(false);
    expect(result.gateReason).toContain('exceeds');
    expect(result.details.matchedTasks).toEqual([]);
  });

  it('should compute positive STQ with matching data', () => {
    const input = makeInput();
    const result = computeSTQ(input);

    expect(result.stq).toBeGreaterThan(0);
    expect(result.passesGate).toBe(true);
    expect(result.gateReason).toBeUndefined();
  });

  it('should return higher STQ for identical source and target', () => {
    const tasks = ['Operate equipment', 'Inspect products', 'Record data'];
    const dwas = ['Monitor operations', 'Maintain records'];
    const tools = ['calipers', 'gauges'];
    const input = makeInput({
      sourceTasks: tasks,
      targetTasks: tasks,
      sourceDWAs: dwas,
      targetDWAs: dwas,
      sourceTools: tools,
      targetTools: tools,
      sourceWorkFields: ['machining'],
      targetWorkFields: ['machining'],
      sourceMPSMS: ['metal parts'],
      targetMPSMS: ['metal parts'],
      sourceMaterials: ['steel'],
      targetMaterials: ['steel'],
      sourceKnowledge: ['quality control'],
      targetKnowledge: ['quality control'],
    });

    const result = computeSTQ(input);
    expect(result.stq).toBe(100);
  });

  it('should return zero STQ when there is no overlap at all', () => {
    const input = makeInput({
      sourceTasks: ['Drive trucks'],
      sourceDWAs: ['Operate vehicles'],
      sourceTools: ['GPS units'],
      sourceMaterials: ['fuel'],
      sourceKnowledge: ['transportation'],
      sourceWorkFields: ['driving'],
      sourceMPSMS: ['freight'],
      targetTasks: ['Cook food'],
      targetDWAs: ['Prepare ingredients'],
      targetTools: ['ovens'],
      targetMaterials: ['flour'],
      targetKnowledge: ['culinary arts'],
      targetWorkFields: ['cooking'],
      targetMPSMS: ['food service'],
    });

    const result = computeSTQ(input);
    expect(result.stq).toBe(0);
    expect(result.details.matchedTasks).toEqual([]);
    expect(result.details.matchedDWAs).toEqual([]);
    expect(result.details.matchedTools).toEqual([]);
  });

  it('should populate matched details correctly', () => {
    const input = makeInput({
      sourceTasks: ['Inspect products', 'Operate machines', 'Read blueprints'],
      targetTasks: ['Inspect products', 'Read blueprints', 'Package items'],
    });

    const result = computeSTQ(input);
    expect(result.details.matchedTasks).toContain('Inspect products');
    expect(result.details.matchedTasks).toContain('Read blueprints');
    expect(result.details.matchedTasks).not.toContain('Operate machines');
  });

  it('should handle case-insensitive matching', () => {
    const input = makeInput({
      sourceTasks: ['INSPECT PRODUCTS'],
      targetTasks: ['inspect products'],
      sourceDWAs: [],
      targetDWAs: [],
    });

    const result = computeSTQ(input);
    expect(result.components.taskDwaOverlap).toBeGreaterThan(0);
  });

  it('should handle empty arrays gracefully', () => {
    const input = makeInput({
      sourceTasks: [],
      sourceDWAs: [],
      sourceTools: [],
      sourceMaterials: [],
      sourceKnowledge: [],
      sourceWorkFields: [],
      sourceMPSMS: [],
      targetTasks: [],
      targetDWAs: [],
      targetTools: [],
      targetMaterials: [],
      targetKnowledge: [],
      targetWorkFields: [],
      targetMPSMS: [],
    });

    const result = computeSTQ(input);
    expect(result.stq).toBe(0);
    expect(result.passesGate).toBe(true);
  });
});

describe('computeAggregateSTQ', () => {
  it('should return the best STQ across multiple PRW entries', () => {
    const prwEntries: SkillTransferInput[] = [
      makeInput({
        sourceSvp: 5,
        sourceTasks: ['Inspect products'],
        sourceDWAs: [],
        sourceTools: [],
        sourceMaterials: [],
        sourceKnowledge: [],
        sourceWorkFields: [],
        sourceMPSMS: [],
      }),
      makeInput({
        sourceSvp: 6,
        sourceTasks: ['Inspect products', 'Operate machines', 'Read blueprints'],
        sourceDWAs: ['Monitor equipment'],
        sourceTools: ['calipers', 'gauges'],
        sourceMaterials: ['steel'],
        sourceKnowledge: ['mechanical engineering'],
        sourceWorkFields: ['machining'],
        sourceMPSMS: ['metal parts'],
      }),
    ];

    const targetData = {
      targetSvp: 4,
      targetTasks: ['Inspect products', 'Operate machines', 'Read blueprints'],
      targetDWAs: ['Monitor equipment'],
      targetTools: ['calipers', 'gauges'],
      targetMaterials: ['steel'],
      targetKnowledge: ['mechanical engineering'],
      targetWorkFields: ['machining'],
      targetMPSMS: ['metal parts'],
    };

    const result = computeAggregateSTQ(prwEntries, targetData);
    expect(result.stq).toBeGreaterThan(0);
    expect(result.passesGate).toBe(true);
  });

  it('should skip PRW entries with SVP < 4', () => {
    const prwEntries: SkillTransferInput[] = [
      makeInput({ sourceSvp: 2 }),
      makeInput({ sourceSvp: 3 }),
    ];

    const targetData = {
      targetSvp: 2,
      targetTasks: ['Task A'],
      targetDWAs: [],
      targetTools: [],
      targetMaterials: [],
      targetKnowledge: [],
      targetWorkFields: [],
      targetMPSMS: [],
    };

    const result = computeAggregateSTQ(prwEntries, targetData);
    expect(result.stq).toBe(0);
    expect(result.passesGate).toBe(false);
    expect(result.gateReason).toContain('No valid transferable skills');
  });

  it('should handle empty PRW entries array', () => {
    const targetData = {
      targetSvp: 4,
      targetTasks: [],
      targetDWAs: [],
      targetTools: [],
      targetMaterials: [],
      targetKnowledge: [],
      targetWorkFields: [],
      targetMPSMS: [],
    };

    const result = computeAggregateSTQ([], targetData);
    expect(result.stq).toBe(0);
    expect(result.passesGate).toBe(false);
  });
});
