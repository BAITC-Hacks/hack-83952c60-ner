import { describe, expect, it } from 'vitest';
import { buildAnalysisFacts } from '../server/facts';
import { runSimulation } from '../src/engine/simulator';
import type { SelectedDecision } from '../src/engine/types';

const reference: SelectedDecision[] = [
  { measureId: 'M7', districtId: 'nura' }, { measureId: 'M8', districtId: 'nura' },
  { measureId: 'M10', districtId: 'nura' }, { measureId: 'M12' },
  { measureId: 'M5', districtId: 'saryarka' },
];

describe('verified evidence for model composition', () => {
  it('reports resolved Nura deficits instead of repeating initial critical values', () => {
    const sim = runSimulation(reference);
    if (!sim.isValid) throw new Error('Invalid reference fixture');
    const evidence = buildAnalysisFacts(sim);
    expect(evidence.facts.critical).toContain('2 → 0');
    expect(evidence.facts.indicator_nura_S1).toContain('38.00 → 48.00');
    expect(evidence.facts.indicator_nura_S2).toContain('35.00 → 43.75');
    expect(evidence.districtHighlights.every((district) => !district.criticalWarning)).toBe(true);
    expect(evidence.riskIds).toContain('unfunded_transport');
    expect(evidence.recommendationIds.length).toBeGreaterThan(0);
    expect(evidence.recommendationIds.every((id) => Object.hasOwn(evidence.facts, id))).toBe(true);
  });

  it('grounds an actual negative tradeoff in the affected district', () => {
    const sim = runSimulation([...reference.slice(0, 4), { measureId: 'M11', districtId: 'almaty' }]);
    if (!sim.isValid) throw new Error('Invalid negative-effect fixture');
    const evidence = buildAnalysisFacts(sim);
    expect(evidence.facts.indicator_almaty_T1).toContain('40.00 → 38.25');
    expect(evidence.facts.indicator_almaty_T1).toContain('Значение после мер критическое');
    expect(evidence.facts.critical).toContain('2 → 1');
    expect(evidence.districtHighlights.find((district) => district.district === 'Алматы')?.criticalWarning).toContain('Разгрузка дорог');
    expect(evidence.districtHighlights.find((district) => district.district === 'Нура')?.criticalWarning).toBeUndefined();
  });
});
