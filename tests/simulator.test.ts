import { describe, it, expect } from 'vitest';
import { calculateBaseScore, runSimulation } from '../src/engine/simulator';
import { SelectedDecision, CityEvent, ValidSimulationResult, IndicatorId } from '../src/engine/types';
import { DISTRICT_LIST } from '../src/data/districts';

const reference: SelectedDecision[] = [
  { measureId: 'M7', districtId: 'nura' },
  { measureId: 'M8', districtId: 'nura' },
  { measureId: 'M10', districtId: 'nura' },
  { measureId: 'M12' },
  { measureId: 'M5', districtId: 'saryarka' },
];

function simulate(decisions: SelectedDecision[], events: CityEvent[] = []): ValidSimulationResult {
  const result = runSimulation(decisions, events);
  if (!result.isValid) throw new Error(result.validation.errors.join('\n'));
  return result;
}

describe('Astana Quality of Life Score engine', () => {
  it('calculates exact baseline components without rounding intermediate results', () => {
    const base = calculateBaseScore();
    expect(Math.abs(base.baseScore - 52.55768)).toBeLessThanOrEqual(1e-6);
    expect(base.baseCityAverage).toBeCloseTo(56.8624, 8);
    expect(base.baseMinDistrictScore).toBeCloseTo(49.18, 8);
    expect(base.baseCritCount).toBe(2);
    expect(Object.values(base.districts).map((district) => district.initialDistrictScore))
      .toEqual(expect.arrayContaining([
        expect.closeTo(62.99, 8), expect.closeTo(57.06, 8), expect.closeTo(54.65, 8),
        expect.closeTo(56.63, 8), expect.closeTo(49.18, 8),
      ]));
    expect(base.districts.nura.criticalIndicators).toEqual(['S1', 'S2']);
  });

  it('matches the exact reference scenario, budget, indicators and score decomposition', () => {
    const result = simulate(reference);
    expect(Math.abs(result.finalScore - 56.54307)).toBeLessThanOrEqual(1e-6);
    expect(result.scoreDelta).toBeCloseTo(3.98539, 8);
    expect(result.validation).toMatchObject({ totalCost: 95, remainingBudget: 5 });
    expect(result.finalCityAverage).toBeCloseTo(58.0776, 8);
    expect(result.finalMinDistrictScore).toBeCloseTo(52.9625, 8);
    expect(result.weakestDistrictId).toBe('nura');
    expect(result.finalCritCount).toBe(0);
    expect(result.criticalPairs).toEqual([]);
    expect(result.districts.nura.finalIndicators).toMatchObject({
      S1: 48, S2: 43.75, B1: 67.5, B2: 51.75, C2: 54.375,
    });
    expect(result.districts.saryarka.finalIndicators).toMatchObject({ E2: 48.75, C1: 47.5 });
    expect(result.activeSynergies).toHaveLength(1);
    expect(result.activeSynergies[0]).toContain('M10 + M12');
  });

  it('accepts the cheapest reference set costing 61', () => {
    const result = simulate([
      { measureId: 'M9', districtId: 'nura' }, { measureId: 'M11', districtId: 'almaty' },
      { measureId: 'M10', districtId: 'saryarka' }, { measureId: 'M12' },
      { measureId: 'M4', districtId: 'esil' },
    ]);
    expect(result.validation).toMatchObject({ totalCost: 61, remainingBudget: 39 });
  });

  it.each([
    ['M9', 'S1', 2.625], ['M1', 'T2', 6.75], ['M7', 'S1', 10], ['M3', 'T2', 10],
  ] as const)('applies the specified lag for %s', (measureId, indicator, expectedEffect) => {
    const result = simulate([
      { measureId, districtId: 'nura' }, { measureId: 'M10', districtId: 'esil' },
      { measureId: 'M11', districtId: 'almaty' }, { measureId: 'M12' }, { measureId: 'M14' },
    ]);
    expect(result.districts.nura.indicatorDeltas[indicator]).toBe(expectedEffect);
    expect(result.districts.saryarka.indicatorDeltas[indicator]).toBe(0);
  });

  it('applies city measures uniformly and local measures only in their selected district', () => {
    const result = simulate(reference);
    for (const district of DISTRICT_LIST) {
      expect(result.districts[district.id].indicatorDeltas.C2).toBe(4.375);
      expect(result.districts[district.id].indicatorDeltas.S1).toBe(district.id === 'nura' ? 10 : 0);
      expect(result.districts[district.id].indicatorDeltas.E2).toBe(district.id === 'saryarka' ? 8.75 : 0);
    }
  });

  it.each([
    {
      pair: 'M1 + M2', indicator: 'T1', expected: 9.5, otherExpected: 3,
      decisions: [
        { measureId: 'M1', districtId: 'nura' }, { measureId: 'M2' },
        { measureId: 'M9', districtId: 'esil' }, { measureId: 'M12' }, { measureId: 'M14' },
      ],
    },
    {
      pair: 'M10 + M12', indicator: 'B1', expected: 12.5, otherExpected: 0,
      decisions: reference,
    },
    {
      pair: 'M5 + M6', indicator: 'E2', expected: 12.25, otherExpected: 1.5,
      decisions: [
        { measureId: 'M5', districtId: 'nura' }, { measureId: 'M6' },
        { measureId: 'M9', districtId: 'esil' }, { measureId: 'M12' }, { measureId: 'M14' },
      ],
    },
  ])('applies fixed synergy $pair in its local measure district without lag scaling', (scenario) => {
    const result = simulate(scenario.decisions as SelectedDecision[]);
    expect(result.activeSynergies.some((description) => description.includes(scenario.pair))).toBe(true);
    expect(result.districts.nura.indicatorDeltas[scenario.indicator as IndicatorId]).toBe(scenario.expected);
    expect(result.districts.baikonur.indicatorDeltas[scenario.indicator as IndicatorId]).toBe(scenario.otherExpected);
    const reversed = simulate([...scenario.decisions].reverse() as SelectedDecision[]);
    expect(reversed.districts).toEqual(result.districts);
    expect(reversed.finalScore).toBe(result.finalScore);
  });

  it('keeps the negative M11 transport effect and counts crossing below 40 as critical', () => {
    const result = simulate([
      { measureId: 'M11', districtId: 'almaty' }, { measureId: 'M9', districtId: 'nura' },
      { measureId: 'M10', districtId: 'saryarka' }, { measureId: 'M12' },
      { measureId: 'M4', districtId: 'esil' },
    ]);
    expect(result.districts.almaty.indicatorDeltas.T1).toBe(-1.75);
    expect(result.districts.almaty.finalIndicators.T1).toBe(38.25);
    expect(result.districts.almaty.indicatorDeltas.B2).toBe(10.5);
    expect(result.criticalPairs).toContainEqual({ districtId: 'almaty', indicatorId: 'T1', value: 38.25 });
  });

  it('clips accumulated effects to both 0 and 100 before calculating district scores', () => {
    // Extreme event effects exercise boundaries unreachable with the fixed five-measure catalog.
    const result = simulate(reference, [{
      id: 'boundary-test', titleRu: 'Границы', descriptionRu: 'Проверка границ', severity: 'low',
      indicatorImpacts: { nura: { S1: 1000, S2: -1000 } },
    }]);
    expect(result.districts.nura.finalIndicators.S1).toBe(100);
    expect(result.districts.nura.finalIndicators.S2).toBe(0);
    expect(result.districts.nura.indicatorDeltas.S1).toBe(62);
    expect(result.districts.nura.indicatorDeltas.S2).toBe(-35);
    expect(result.districts.nura.finalDistrictScore).toBeCloseTo(53.87, 8);
    expect(result.criticalPairs).toContainEqual({ districtId: 'nura', indicatorId: 'S2', value: 0 });
  });

  it('treats exactly 40 as noncritical, and values immediately below 40 as critical', () => {
    const result = simulate(reference, [{
      id: 'threshold-test', titleRu: 'Порог', descriptionRu: 'Проверка порога', severity: 'low',
      indicatorImpacts: { nura: { S1: -8, S2: -3.750001 } },
    }]);
    expect(result.districts.nura.finalIndicators.S1).toBe(40);
    expect(result.districts.nura.finalIndicators.S2).toBeCloseTo(39.999999, 8);
    expect(result.districts.nura.criticalIndicators).toEqual(['S2']);
    expect(result.finalCritCount).toBe(1);
  });

  it('is independent of selection order and does not mutate the input or dataset', () => {
    const before = JSON.stringify(DISTRICT_LIST);
    const frozen = reference.map((decision) => Object.freeze({ ...decision }));
    Object.freeze(frozen);
    const original = simulate(frozen);
    const reverse = simulate([...frozen].reverse());
    expect(reverse.districts).toEqual(original.districts);
    expect(reverse.finalScore).toBe(original.finalScore);
    expect(reverse.activeSynergies).toEqual(original.activeSynergies);
    original.districts.nura.finalIndicators.S1 = 0;
    expect(JSON.stringify(DISTRICT_LIST)).toBe(before);
    expect(simulate(reference).districts.nura.finalIndicators.S1).toBe(48);
  });

  it.each([
    undefined, null, {}, [], new Array(5),
    [null, ...reference.slice(1)],
    [{ measureId: 'toString' }, ...reference.slice(1)],
    [{ measureId: 'M7', districtId: 'constructor' }, ...reference.slice(1)],
    [{ measureId: 'M12', districtId: 'nura' }, ...reference.slice(1)],
  ])('returns errors and null scores for invalid runtime input %#', (input) => {
    const result = runSimulation(input);
    expect(result.isValid).toBe(false);
    expect(result.validation.errors.length).toBeGreaterThan(0);
    expect(result.finalScore).toBeNull();
    expect(result.scoreDelta).toBeNull();
    expect(result.baseScore).toBeCloseTo(52.55768, 8);
    expect(result.criticalPairs).toHaveLength(result.baseCritCount);
    expect(result.districts.nura.finalIndicators).toEqual(result.districts.nura.initialIndicators);
    expect(JSON.stringify(result)).not.toContain('NaN');
  });
});
