import type { ValidSimulationResult } from '../src/engine/types';
import { DISTRICT_LIST } from '../src/data/districts';
import { INDICATOR_LIST } from '../src/data/indicators';
import { MEASURES, MEASURE_LIST, SYNERGIES, INCOMPATIBILITIES } from '../src/data/measures';
import { buildAnalysisFacts } from './facts';

/** All facts sent to the model are computed on the server from the shared dataset. */
export function buildAnalysisContext(simulation: ValidSimulationResult, question?: string) {
  const horizonQuarters = simulation.horizonQuarters ?? 8;
  return {
    scenarioKind: 'Учебная модель Астаны на фиксированных синтетических данных, не прогноз реального города.',
    evidence: buildAnalysisFacts(simulation),
    horizonQuarters,
    budget: {
      available: 100,
      spent: simulation.validation.totalCost,
      remaining: simulation.validation.remainingBudget,
      unit: 'виртуальная бюджетная единица',
    },
    rules: {
      decisions: 5,
      maximumPerDirection: 2,
      criticalThreshold: 'строго меньше 40',
      formula: 'Score = 0.7 × средневзвешенный по населению балл + 0.3 × минимальный районный балл − число критических показателей',
      effectFormula: `эффект меры × min(1, max(0, (${horizonQuarters} − лаг в кварталах) / 8)); затем полные бонусы синергии после завершения лагов обеих мер; итоговые показатели ограничены [0, 100]`,
    },
    indicators: INDICATOR_LIST.map(({ id, nameRu, weight, meaningRu }) => ({
      id, name: nameRu, weight, meaning: meaningRu,
    })),
    catalog: {
      measures: MEASURE_LIST.map(({ id, nameRu, direction, type, cost, lag, effects }) => ({
        id, name: nameRu, direction, scope: type, cost, lagQuarters: lag, rawEffects: effects,
      })),
      incompatibilities: INCOMPATIBILITIES.map(({ pair, scope, reasonRu }) => ({
        measures: pair, scope, reason: reasonRu,
      })),
      synergies: SYNERGIES.map(({ pair, bonus, applyTo, descriptionRu }) => ({
        measures: pair, fixedBonus: bonus, applyTo, description: descriptionRu,
      })),
    },
    decisions: simulation.decisions.map((decision) => {
      const measure = MEASURES[decision.measureId];
      const lagFactor = Math.min(1, Math.max(0, (horizonQuarters - measure.lag) / 8));
      return {
        ...decision,
        name: measure.nameRu,
        direction: measure.direction,
        scope: measure.type,
        targetDistricts: measure.type === 'Город'
          ? DISTRICT_LIST.map((district) => district.id)
          : [decision.districtId!],
        cost: measure.cost,
        lagQuarters: measure.lag,
        lagFactor,
        rawEffects: measure.effects,
        realizedEffectsBeforeClipping: Object.fromEntries(
          Object.entries(measure.effects).map(([indicator, effect]) => [indicator, effect! * lagFactor]),
        ),
      };
    }),
    synergies: SYNERGIES.flatMap((rule) => {
      const first = simulation.decisions.find((decision) => decision.measureId === rule.pair[0]);
      const second = simulation.decisions.find((decision) => decision.measureId === rule.pair[1]);
      if (!first || !second) return [];
      if (horizonQuarters <= Math.max(MEASURES[first.measureId].lag, MEASURES[second.measureId].lag)) return [];
      return [{
        measures: rule.pair,
        description: rule.descriptionRu,
        targetDistricts: rule.applyTo === 'city'
          ? DISTRICT_LIST.map((district) => district.id)
          : [first.districtId!],
        fixedBonus: rule.bonus,
      }];
    }),
    districts: DISTRICT_LIST.map((district) => ({
      ...simulation.districts[district.id],
      profile: district.profileRu,
    })),
    criticalIndicatorsBefore: DISTRICT_LIST.flatMap((district) => INDICATOR_LIST.flatMap((indicator) => {
      const value = district.indicators[indicator.id];
      return value < 40 ? [{ districtId: district.id, indicatorId: indicator.id, value }] : [];
    })),
    criticalIndicatorsAfter: simulation.criticalPairs,
    score: {
      before: simulation.baseScore,
      after: simulation.finalScore,
      delta: simulation.scoreDelta,
      weakestDistrict: simulation.weakestDistrictId,
      decompositionBefore: {
        cityAverage: simulation.baseCityAverage,
        cityAverageContribution: 0.7 * simulation.baseCityAverage,
        minimumDistrict: simulation.baseMinDistrictScore,
        minimumDistrictContribution: 0.3 * simulation.baseMinDistrictScore,
        criticalCount: simulation.baseCritCount,
        criticalPenalty: -simulation.baseCritCount,
      },
      decompositionAfter: {
        cityAverage: simulation.finalCityAverage,
        cityAverageContribution: 0.7 * simulation.finalCityAverage,
        minimumDistrict: simulation.finalMinDistrictScore,
        minimumDistrictContribution: 0.3 * simulation.finalMinDistrictScore,
        criticalCount: simulation.finalCritCount,
        criticalPenalty: -simulation.finalCritCount,
      },
    },
    question: question ?? null,
  };
}

export type AnalysisContext = ReturnType<typeof buildAnalysisContext>;
