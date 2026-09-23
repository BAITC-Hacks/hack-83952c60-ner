import { describe, expect, it } from 'vitest';
import { DISTRICT_LIST } from '../src/data/districts';
import { runAnnualPlan } from '../src/engine/annualPlan';
import { findTopScenarios } from '../src/engine/optimizer';
import { runSimulation, runSimulationAtQuarter } from '../src/engine/simulator';
import { CityEvent, SelectedDecision } from '../src/engine/types';
import { TOTAL_BUDGET } from '../src/engine/validator';

const reference: SelectedDecision[] = [
  { measureId: 'M7', districtId: 'nura' },
  { measureId: 'M8', districtId: 'nura' },
  { measureId: 'M10', districtId: 'nura' },
  { measureId: 'M12' },
  { measureId: 'M5', districtId: 'saryarka' },
];

const event: CityEvent = {
  id: 'annual-test', titleRu: 'Событие', descriptionRu: 'Годовой сценарий', severity: 'medium',
  cityWideImpacts: { T2: -3 },
  indicatorImpacts: { nura: { S1: 7 } },
};

describe('three-year portfolio projections', () => {
  it('realizes delayed school and clinic effects by Q4, Q8 and Q12 from one baseline', () => {
    const plan = runAnnualPlan(reference);
    expect(plan.isValid).toBe(true);
    expect(plan.years.map(({ year, quarter }) => [year, quarter])).toEqual([[1, 4], [2, 8], [3, 12]]);
    expect(plan.years.map(({ simulation }) => simulation.horizonQuarters)).toEqual([4, 8, 12]);
    expect(plan.years.map(({ simulation }) => simulation.districts.nura.indicatorDeltas.S1)).toEqual([2, 10, 16]);
    expect(plan.years.map(({ simulation }) => simulation.districts.nura.indicatorDeltas.S2)).toEqual([1.75, 8.75, 14]);
    for (const { simulation } of plan.years) {
      expect(simulation.decisions).toEqual(reference);
      expect(simulation.districts.nura.initialIndicators.S1).toBe(38);
      expect(simulation.baseScore).toBeCloseTo(52.55768, 8);
    }
  });

  it.each(findTopScenarios(5).map((scenario, index) => [index, scenario.decisions] as const))(
    'keeps year two identical to the legacy eight-quarter simulation for preset %i and events',
    (_index, decisions) => {
      expect(runAnnualPlan(decisions).years[1].simulation).toEqual(runSimulation(decisions));
      expect(runAnnualPlan(decisions, [event]).years[1].simulation).toEqual(runSimulation(decisions, [event]));
    },
  );

  it('keeps an LRT with a four-quarter lag inactive in year one and caps the mature effect', () => {
    const decisions: SelectedDecision[] = [
      { measureId: 'M3', districtId: 'nura' }, { measureId: 'M10', districtId: 'esil' },
      { measureId: 'M11', districtId: 'almaty' }, { measureId: 'M12' }, { measureId: 'M14' },
    ];
    const plan = runAnnualPlan(decisions);
    expect(plan.years.map(({ simulation }) => simulation.districts.nura.indicatorDeltas.T2)).toEqual([0, 10, 20]);
    expect(runSimulationAtQuarter(decisions, 24).districts.nura.indicatorDeltas.T2).toBe(20);
    // Negative transport effects also mature and stop at the raw effect; benefits are not assumed universal.
    expect(plan.years.map(({ simulation }) => simulation.districts.almaty.indicatorDeltas.T1)).toEqual([-0.75, -1.75, -2]);
  });

  it('activates the ecology synergy only after both measures are commissioned', () => {
    const decisions: SelectedDecision[] = [
      { measureId: 'M5', districtId: 'nura' }, { measureId: 'M6' },
      { measureId: 'M9', districtId: 'esil' }, { measureId: 'M12' }, { measureId: 'M14' },
    ];
    const plan = runAnnualPlan(decisions);
    expect(plan.years.map(({ simulation }) => simulation.activeSynergies.length)).toEqual([0, 1, 1]);
    expect(plan.years.map(({ simulation }) => simulation.districts.nura.indicatorDeltas.E2)).toEqual([1.75, 12.25, 19]);
    expect(plan.years.map(({ simulation }) => simulation.districts.baikonur.indicatorDeltas.E2)).toEqual([0, 1.5, 3]);
    const justCommissioned = runSimulationAtQuarter(reference, 1);
    const inOperation = runSimulationAtQuarter(reference, 2);
    expect(justCommissioned.activeSynergies).toEqual([]);
    expect(justCommissioned.districts.nura.indicatorDeltas.B1).toBe(0);
    expect(inOperation.activeSynergies).toHaveLength(1);
    expect(inOperation.districts.nura.indicatorDeltas.B1).toBe(3.5);
  });

  it('applies event impacts once in each snapshot without accumulating across years', () => {
    const baselinePlan = runAnnualPlan(reference);
    const eventPlan = runAnnualPlan(reference, [event]);
    eventPlan.years.forEach(({ simulation }, index) => {
      const baseline = baselinePlan.years[index].simulation;
      expect(simulation.districts.nura.finalIndicators.S1 - baseline.districts.nura.finalIndicators.S1).toBe(7);
      for (const district of DISTRICT_LIST) {
        expect(simulation.districts[district.id].indicatorDeltas.T2).toBe(-3);
      }
      expect(simulation.appliedEvents).toEqual([event]);
    });
  });

  it('charges the portfolio once and conserves the single budget through all three years', () => {
    const plan = runAnnualPlan(reference);
    expect(plan.years.map(({ annualSpending }) => annualSpending)).toEqual([95, 0, 0]);
    let spent = 0;
    for (const year of plan.years) {
      spent += year.annualSpending;
      expect(year.cumulativeSpending).toBe(spent);
      expect(year.cumulativeSpending + year.remainingBudget).toBe(TOTAL_BUDGET);
      expect(year.remainingBudget).toBe(5);
    }
  });

  it('uses shared clipping and scores while keeping annual snapshot objects independent', () => {
    const plan = runAnnualPlan(reference, [{
      id: 'bounds', titleRu: 'Границы', descriptionRu: 'Границы', severity: 'low',
      indicatorImpacts: { nura: { S1: 1000, S2: -1000 } },
    }]);
    for (const { simulation } of plan.years) {
      expect(simulation.districts.nura.finalIndicators.S1).toBe(100);
      expect(simulation.districts.nura.finalIndicators.S2).toBe(0);
      expect(simulation.criticalPairs).toContainEqual({ districtId: 'nura', indicatorId: 'S2', value: 0 });
      expect(simulation.finalScore).toBeCloseTo(0.7 * simulation.finalCityAverage + 0.3 * simulation.finalMinDistrictScore - simulation.finalCritCount, 10);
    }
    plan.years[0].simulation.districts.nura.finalIndicators.S1 = 1;
    expect(plan.years[1].simulation.districts.nura.finalIndicators.S1).toBe(100);
    expect(runAnnualPlan(reference).years[0].simulation.districts.nura.finalIndicators.S1).toBe(40);
  });

  it.each([
    undefined, null, {}, [], new Array(5),
    [null, ...reference.slice(1)],
    [{ measureId: 'toString' }, ...reference.slice(1)],
    [{ measureId: 'M7', districtId: 'constructor' }, ...reference.slice(1)],
    [reference[0], reference[0], ...reference.slice(2)],
    // Over budget, an incompatible transport pair, and three measures in one direction.
    [
      { measureId: 'M3', districtId: 'nura' }, { measureId: 'M5', districtId: 'saryarka' },
      { measureId: 'M7', districtId: 'nura' }, { measureId: 'M8', districtId: 'nura' }, { measureId: 'M14' },
    ],
    [
      { measureId: 'M1', districtId: 'nura' }, { measureId: 'M3', districtId: 'almaty' },
      { measureId: 'M9', districtId: 'nura' }, { measureId: 'M12' }, { measureId: 'M10', districtId: 'nura' },
    ],
    [
      { measureId: 'M7', districtId: 'nura' }, { measureId: 'M8', districtId: 'nura' },
      { measureId: 'M9', districtId: 'nura' }, { measureId: 'M12' }, { measureId: 'M14' },
    ],
  ].map((input) => ({ input })))('does not project any years for invalid input %#', ({ input }) => {
    expect(runAnnualPlan(input)).toEqual({ isValid: false, years: [] });
  });

  it.each([0, -1, 1.5, NaN, Infinity])('rejects invalid elapsed quarter %s', (quarter) => {
    expect(() => runSimulationAtQuarter(reference, quarter)).toThrow(RangeError);
  });
});
