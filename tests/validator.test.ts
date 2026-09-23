import { describe, it, expect } from 'vitest';
import { validateDecisions } from '../src/engine/validator';
import { SelectedDecision } from '../src/engine/types';

const reference: SelectedDecision[] = [
  { measureId: 'M7', districtId: 'nura' },
  { measureId: 'M8', districtId: 'nura' },
  { measureId: 'M10', districtId: 'nura' },
  { measureId: 'M12' },
  { measureId: 'M5', districtId: 'saryarka' },
];

describe('Validator rules', () => {
  it('accepts five decisions across four directions; one per direction is not required', () => {
    expect(validateDecisions(reference)).toMatchObject({
      isValid: true, totalCost: 95, remainingBudget: 5, decisionCount: 5,
      directionCounts: { transport: 0, ecology: 1, social: 2, safety: 1, services: 1 },
    });
  });

  it.each([
    [99, [
      { measureId: 'M3', districtId: 'nura' }, { measureId: 'M5', districtId: 'saryarka' },
      { measureId: 'M8', districtId: 'nura' }, { measureId: 'M12' }, { measureId: 'M9', districtId: 'esil' },
    ]],
    [100, [
      { measureId: 'M3', districtId: 'nura' }, { measureId: 'M7', districtId: 'nura' },
      { measureId: 'M2' }, { measureId: 'M12' }, { measureId: 'M9', districtId: 'esil' },
    ]],
    [101, [
      { measureId: 'M5', districtId: 'esil' }, { measureId: 'M7', districtId: 'nura' },
      { measureId: 'M13', districtId: 'almaty' }, { measureId: 'M12' }, { measureId: 'M9', districtId: 'esil' },
    ]],
  ])('checks the budget boundary at %i', (cost, decisions) => {
    const result = validateDecisions(decisions);
    expect(result.totalCost).toBe(cost);
    expect(result.remainingBudget).toBe(100 - cost);
    expect(result.isValid).toBe(cost <= 100);
    expect(result.errors.length).toBe(cost <= 100 ? 0 : 1);
  });

  it.each([0, 1, 4, 6])('rejects %i decisions in final validation', (count) => {
    const decisions = count <= 5 ? reference.slice(0, count) : [...reference, { measureId: 'M14' }];
    expect(validateDecisions(decisions).errors.some((error) => error.includes('ровно 5'))).toBe(true);
  });

  it('allows incomplete selection only while all other constraints still hold', () => {
    expect(validateDecisions([], { allowIncomplete: true }).isValid).toBe(true);
    expect(validateDecisions(reference.slice(0, 4), { allowIncomplete: true }).isValid).toBe(true);
    expect(validateDecisions([...reference, { measureId: 'M14' }], { allowIncomplete: true }).isValid).toBe(false);
    expect(validateDecisions([reference[0], reference[0]], { allowIncomplete: true }).isValid).toBe(false);
    expect(validateDecisions([{ measureId: 'M7' }], { allowIncomplete: true }).isValid).toBe(false);
    expect(validateDecisions([
      { measureId: 'M7', districtId: 'nura' }, { measureId: 'M8', districtId: 'esil' },
      { measureId: 'M9', districtId: 'almaty' },
    ], { allowIncomplete: true }).errors.some((error) => error.includes('Превышен лимит'))).toBe(true);
    expect(validateDecisions([
      { measureId: 'M1', districtId: 'esil' }, { measureId: 'M3', districtId: 'nura' },
    ], { allowIncomplete: true }).errors.some((error) => error.includes('M1 и M3'))).toBe(true);
  });

  it('rejects the same measure even if targeted to a different district', () => {
    const result = validateDecisions([reference[0], { measureId: 'M7', districtId: 'esil' }, ...reference.slice(2)]);
    expect(result.errors.some((error) => error.includes('повторно'))).toBe(true);
  });

  it('rejects three measures in one direction', () => {
    const result = validateDecisions([reference[0], reference[1], { measureId: 'M9', districtId: 'almaty' }, reference[2], reference[3]]);
    expect(result.errors.some((error) => error.includes('Превышен лимит мер по направлению'))).toBe(true);
  });

  it.each([
    ['M1', 'M3', 'esil', 'nura', 'M1 и M3'],
    ['M4', 'M7', 'nura', 'nura', 'Конфликт участков M4 и M7'],
    ['M5', 'M13', 'saryarka', 'saryarka', 'Дублирование M5 и M13'],
  ])('rejects incompatible %s + %s', (first, second, firstDistrict, secondDistrict, message) => {
    const result = validateDecisions([
      { measureId: first, districtId: firstDistrict },
      { measureId: second, districtId: secondDistrict },
    ], { allowIncomplete: true });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain(message);
  });

  it.each([['M4', 'M7'], ['M5', 'M13']])('allows %s + %s in different districts', (first, second) => {
    expect(validateDecisions([
      { measureId: first, districtId: 'esil' }, { measureId: second, districtId: 'nura' },
    ], { allowIncomplete: true }).isValid).toBe(true);
  });

  it.each([undefined, null, '', 'unknown', 'toString', 'constructor', '__proto__', 12, {}, ['esil']])(
    'rejects missing or malformed district %j for a district measure', (districtId) => {
      expect(validateDecisions([{ measureId: 'M7', districtId }, ...reference.slice(1)]).isValid).toBe(false);
    },
  );

  it.each(['M2', 'M6', 'M12', 'M14'])('forbids any district field on city measure %s', (measureId) => {
    for (const districtId of ['nura', undefined, null, '', 'toString']) {
      const result = validateDecisions([{ measureId, districtId }], { allowIncomplete: true });
      expect(result.isValid).toBe(false);
      expect(result.warnings).toEqual([]);
      expect(result.errors[0]).toContain('район указывать нельзя');
    }
    expect(validateDecisions([{ measureId }], { allowIncomplete: true }).isValid).toBe(true);
  });

  it.each(['M0', 'M15', 'toString', 'constructor', '__proto__', '', 12, null, {}, ['M7']])(
    'rejects unknown or malformed measure ID %j without corrupting costs', (measureId) => {
      const result = validateDecisions([{ measureId, districtId: 'nura' }, ...reference.slice(1)]);
      expect(result.isValid).toBe(false);
      expect(Number.isFinite(result.totalCost)).toBe(true);
      expect(Number.isFinite(result.remainingBudget)).toBe(true);
    },
  );

  it.each([undefined, null, {}, 'M7', 5, true])('rejects non-array input %j', (input) => {
    expect(validateDecisions(input).isValid).toBe(false);
    expect(validateDecisions(input, { allowIncomplete: true }).isValid).toBe(false);
  });

  it.each([null, undefined, [], 'M7', 7, true, {}, { districtId: 'nura' }])(
    'rejects malformed decision %j without throwing', (decision) => {
      const result = validateDecisions([decision, ...reference.slice(1)]);
      expect(result.isValid).toBe(false);
      expect(Number.isFinite(result.totalCost)).toBe(true);
    },
  );

  it('rejects inherited fields and sparse array entries', () => {
    expect(validateDecisions([Object.create({ measureId: 'M7', districtId: 'nura' }), ...reference.slice(1)]).isValid).toBe(false);
    expect(validateDecisions([{ ...Object.create({ districtId: 'nura' }), measureId: 'M7' }, ...reference.slice(1)]).isValid).toBe(false);
    expect(validateDecisions(new Array(5)).isValid).toBe(false);
  });

  it('does not mutate input and returns the same result regardless of decision order', () => {
    const input = reference.map((decision) => Object.freeze({ ...decision }));
    Object.freeze(input);
    const forward = validateDecisions(input);
    const reverse = validateDecisions([...input].reverse());
    expect(reverse).toEqual(forward);
  });
});
