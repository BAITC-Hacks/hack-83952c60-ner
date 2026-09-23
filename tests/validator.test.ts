import { describe, it, expect } from 'vitest';
import { validateDecisions } from '../src/engine/validator';
import { SelectedDecision } from '../src/engine/types';

describe('Validator Rules Engine', () => {
  it('should reject budget exceeding 100', () => {
    // M3 (30) + M13 (28) + M5 (25) + M7 (24) + M2 (22) = 129
    const decisions: SelectedDecision[] = [
      { measureId: 'M3', districtId: 'esil' },
      { measureId: 'M13', districtId: 'almaty' },
      { measureId: 'M5', districtId: 'saryarka' },
      { measureId: 'M7', districtId: 'nura' },
      { measureId: 'M2' },
    ];
    const val = validateDecisions(decisions);
    expect(val.isValid).toBe(false);
    expect(val.errors.some((e) => e.includes('Превышен бюджет'))).toBe(true);
  });

  it('should reject when decision count is not exactly 5', () => {
    const decisions: SelectedDecision[] = [
      { measureId: 'M7', districtId: 'nura' },
      { measureId: 'M8', districtId: 'nura' },
    ];
    const val = validateDecisions(decisions);
    expect(val.isValid).toBe(false);
    expect(val.errors.some((e) => e.includes('ровно 5'))).toBe(true);
  });

  it('should reject duplicate measures', () => {
    const decisions: SelectedDecision[] = [
      { measureId: 'M7', districtId: 'nura' },
      { measureId: 'M7', districtId: 'esil' },
      { measureId: 'M8', districtId: 'nura' },
      { measureId: 'M10', districtId: 'nura' },
      { measureId: 'M12' },
    ];
    const val = validateDecisions(decisions);
    expect(val.isValid).toBe(false);
    expect(val.errors.some((e) => e.includes('повторно'))).toBe(true);
  });

  it('should enforce maximum 2 measures per direction', () => {
    // 3 social measures: M7, M8, M9
    const decisions: SelectedDecision[] = [
      { measureId: 'M7', districtId: 'nura' },
      { measureId: 'M8', districtId: 'nura' },
      { measureId: 'M9', districtId: 'almaty' },
      { measureId: 'M10', districtId: 'saryarka' },
      { measureId: 'M12' },
    ];
    const val = validateDecisions(decisions);
    expect(val.isValid).toBe(false);
    expect(val.errors.some((e) => e.includes('Превышен лимит мер по направлению'))).toBe(true);
  });

  it('should reject incompatibility M1 and M3 in any district', () => {
    const decisions: SelectedDecision[] = [
      { measureId: 'M1', districtId: 'esil' },
      { measureId: 'M3', districtId: 'almaty' },
      { measureId: 'M9', districtId: 'nura' },
      { measureId: 'M10', districtId: 'saryarka' },
      { measureId: 'M12' },
    ];
    const val = validateDecisions(decisions);
    expect(val.isValid).toBe(false);
    expect(val.errors.some((e) => e.includes('M1 и M3'))).toBe(true);
  });

  it('should reject incompatibility M4 and M7 in the same district', () => {
    const decisions: SelectedDecision[] = [
      { measureId: 'M4', districtId: 'nura' },
      { measureId: 'M7', districtId: 'nura' }, // Conflict in NuRa
      { measureId: 'M2' },
      { measureId: 'M10', districtId: 'esil' },
      { measureId: 'M12' },
    ];
    const val = validateDecisions(decisions);
    expect(val.isValid).toBe(false);
    expect(val.errors.some((e) => e.includes('Конфликт участков M4 и M7'))).toBe(true);
  });

  it('should allow M4 and M7 in different districts', () => {
    const decisions: SelectedDecision[] = [
      { measureId: 'M4', districtId: 'esil' },
      { measureId: 'M7', districtId: 'nura' }, // Different districts!
      { measureId: 'M2' },
      { measureId: 'M10', districtId: 'saryarka' },
      { measureId: 'M12' },
    ];
    const val = validateDecisions(decisions);
    expect(val.isValid).toBe(true);
  });

  it('should reject incompatibility M5 and M13 in the same district', () => {
    const decisions: SelectedDecision[] = [
      { measureId: 'M5', districtId: 'saryarka' },
      { measureId: 'M13', districtId: 'saryarka' }, // Conflict in Saryarka
      { measureId: 'M2' },
      { measureId: 'M10', districtId: 'nura' },
      { measureId: 'M12' },
    ];
    const val = validateDecisions(decisions);
    expect(val.isValid).toBe(false);
    expect(val.errors.some((e) => e.includes('Дублирование M5 и M13'))).toBe(true);
  });
});
