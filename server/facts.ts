import type { AIAnalysis, ValidSimulationResult } from '../src/engine/types';
import { generateAIAnalysis } from '../src/ai/analyzer';
import { findBestImprovements } from '../src/engine/optimizer';
import { runSimulationAtQuarter } from '../src/engine/simulator';
import { DISTRICTS } from '../src/data/districts';
import { DIRECTION_LIST, INDICATORS } from '../src/data/indicators';
import { MEASURES } from '../src/data/measures';

export interface AnalysisFacts {
  facts: Record<string, string>;
  summaryIds: string[];
  strengthIds: string[];
  riskIds: string[];
  recommendationIds: string[];
  districtHighlights: AIAnalysis['districtHighlights'];
  verdict: string;
}

const number = (value: number) => value.toFixed(2);
const signed = (value: number) => `${value > 0 ? '+' : ''}${number(value)}`;

/** The LLM may rank these facts, but cannot create facts or unchecked alternatives. */
export function buildAnalysisFacts(sim: ValidSimulationResult): AnalysisFacts {
  const horizonQuarters = sim.horizonQuarters ?? 8;
  const baseline = generateAIAnalysis(sim);
  const facts: Record<string, string> = {};
  const summaryIds: string[] = [];
  const strengthIds: string[] = [];
  const riskIds: string[] = [];
  const recommendationIds: string[] = [];
  const add = (id: string, text: string, category?: string[]) => {
    facts[id] = text;
    category?.push(id);
  };
  add('score', `Score изменился с ${number(sim.baseScore)} до ${number(sim.finalScore)} (${signed(sim.scoreDelta)}). Это результат синтетической модели на ${horizonQuarters} кв.`, summaryIds);
  add('budget', `Выбрано пять решений на ${sim.validation.totalCost} из 100 у.е.; остаток ${sim.validation.remainingBudget} у.е. не даёт бонуса и не штрафуется.`, summaryIds);
  add('city_average', `Средневзвешенная оценка города: ${number(sim.baseCityAverage)} → ${number(sim.finalCityAverage)}. Её изменение добавляет ${signed(0.7 * (sim.finalCityAverage - sim.baseCityAverage))} к Score.`, summaryIds);
  add('minimum', `Оценка слабейшего района: ${number(sim.baseMinDistrictScore)} → ${number(sim.finalMinDistrictScore)}. Текущий слабейший район — ${DISTRICTS[sim.weakestDistrictId].nameRu}; изменение минимальной оценки даёт ${signed(0.3 * (sim.finalMinDistrictScore - sim.baseMinDistrictScore))} к Score.`, summaryIds);
  add('critical', `Число показателей строго ниже 40: ${sim.baseCritCount} → ${sim.finalCritCount}. Изменение штрафа даёт ${signed(sim.baseCritCount - sim.finalCritCount)} к Score.${sim.finalCritCount === 0 ? ' После выбранных мер критических показателей нет ни в одном районе.' : ''}`, summaryIds);
  baseline.strengths.forEach((text, index) => add(`strength_${index}`, text, strengthIds));
  baseline.risksAndTradeoffs.forEach((text, index) => add(`risk_${index}`, text, riskIds));
  for (const direction of DIRECTION_LIST) {
    if (sim.validation.directionCounts[direction.id] === 0) {
      add(`unfunded_${direction.id}`, `В наборе нет прямых мер направления «${direction.nameRu}». Бюджет отдан другим приоритетам; вариант с этим направлением можно сравнить отдельным расчётом.`, riskIds);
    }
  }
  for (const district of Object.values(sim.districts)) {
    add(`district_${district.districtId}`, `${district.nameRu}: районная оценка ${number(district.initialDistrictScore)} → ${number(district.finalDistrictScore)} (${signed(district.scoreDelta)}). Критических показателей после мер: ${district.criticalIndicators.length}.`);
    for (const indicator of Object.values(INDICATORS)) {
      const delta = district.indicatorDeltas[indicator.id];
      if (delta === 0 && !district.criticalIndicators.includes(indicator.id)) continue;
      const before = district.initialIndicators[indicator.id];
      const after = district.finalIndicators[indicator.id];
      add(`indicator_${district.districtId}_${indicator.id}`, `${district.nameRu}, ${indicator.nameRu} (${indicator.id}): ${number(before)} → ${number(after)} (${signed(delta)}).${after < 40 ? ' Значение после мер критическое (ниже 40).' : ' Показатель после мер не ниже критического порога 40.'}`, delta > 0 ? strengthIds : undefined);
    }
  }
  for (const decision of sim.decisions) {
    const measure = MEASURES[decision.measureId];
    const effectFactor = Math.min(1, Math.max(0, (horizonQuarters - measure.lag) / 8));
    add(`measure_${measure.id}`, `${measure.id} «${measure.nameRu}», ${decision.districtId ? DISTRICTS[decision.districtId].nameRu : 'все шесть районов'}: стоимость ${measure.cost} у.е., лаг ${measure.lag} кв., за ${horizonQuarters} кв. реализуется ${(effectFactor * 100).toFixed(1)}% полного эффекта.`);
  }
  for (const [index, suggestion] of findBestImprovements(sim.decisions, horizonQuarters).entries()) {
    const nextDecisions = sim.decisions.map((decision) => decision.measureId === suggestion.removeMeasureId ? suggestion.addDecision : decision);
    const next = runSimulationAtQuarter(nextDecisions, horizonQuarters);
    if (!next.isValid || next.finalScore <= sim.finalScore) continue;
    const added = suggestion.addDecision;
    const target = added.districtId ? DISTRICTS[added.districtId].nameRu : 'весь город';
    add(`replacement_${index}`, `Проверенный вариант: заменить ${suggestion.removeMeasureId} «${suggestion.removeMeasureName}» на ${added.measureId} «${suggestion.addMeasureName}» (${target}). Пять решений, бюджет ${next.validation.totalCost}/100, все ограничения соблюдены. Score модели: ${number(sim.finalScore)} → ${number(next.finalScore)} (${signed(next.finalScore - sim.finalScore)}), критических показателей: ${next.finalCritCount}. Это вариант одной замены, а не доказанный глобальный оптимум.`, recommendationIds);
  }
  return { facts, summaryIds, strengthIds, riskIds, recommendationIds, districtHighlights: baseline.districtHighlights, verdict: baseline.akimatRatingVerdict };
}
