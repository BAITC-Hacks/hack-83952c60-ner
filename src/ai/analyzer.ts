import { AIAnalysis, SimulationResult } from '../engine/types';
import { DISTRICTS } from '../data/districts';
import { INDICATORS, INDICATOR_LIST } from '../data/indicators';
import { MEASURES } from '../data/measures';

const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}`;

/** Deterministic fallback; this function does not call a language model. */
export function generateAIAnalysis(sim: SimulationResult): AIAnalysis {
  if (!sim.isValid) {
    return {
      executiveSummary: 'Итоговый Score не рассчитан: сначала составьте допустимый набор из пяти решений.',
      strengths: [],
      risksAndTradeoffs: sim.validation.errors,
      districtHighlights: [],
      actionableRecommendations: ['Исправьте указанные ограничения и повторите анализ.'],
      akimatRatingVerdict: 'Сценарий не завершён',
    };
  }
  const strengths: string[] = [];
  const risksAndTradeoffs: string[] = [];
  const actionableRecommendations: string[] = [];
  const weakest = DISTRICTS[sim.weakestDistrictId].nameRu;
  if (sim.scoreDelta > 0) {
    strengths.push(`Городской Score вырос на ${signed(sim.scoreDelta)} относительно исходных условий.`);
  } else if (sim.scoreDelta < 0) {
    risksAndTradeoffs.push(`Городской Score снизился на ${Math.abs(sim.scoreDelta).toFixed(2)} относительно исходных условий.`);
  }
  if (sim.finalCritCount === 0) {
    strengths.push(`Показателей ниже 40 не осталось. Штраф за критические значения: 0 (в базе: ${sim.baseCritCount}).`);
  } else {
    risksAndTradeoffs.push(`Осталось критических показателей: ${sim.finalCritCount}. Штраф в формуле Score: ${sim.finalCritCount}.`);
    for (const pair of sim.criticalPairs) {
      actionableRecommendations.push(`При пересмотре мер обратите внимание на район ${DISTRICTS[pair.districtId].nameRu}: ${INDICATORS[pair.indicatorId].nameRu} — ${pair.value.toFixed(2)}. Проверяйте замену в пределах пяти решений и бюджета.`);
    }
  }
  const minDelta = sim.finalMinDistrictScore - sim.baseMinDistrictScore;
  if (minDelta > 0) strengths.push(`Минимальная районная оценка выросла на ${signed(minDelta)}. Текущий слабейший район — ${weakest} (${sim.finalMinDistrictScore.toFixed(2)}).`);
  for (const synergy of sim.activeSynergies) strengths.push(`${synergy.replace(/[.!]+$/, '')}. Её бонус не уменьшается лагом.`);
  const districtHighlights = Object.values(sim.districts).map((district) => {
    const negative = INDICATOR_LIST.filter((indicator) => district.indicatorDeltas[indicator.id] < 0);
    if (negative.length) risksAndTradeoffs.push(`${district.nameRu}: снизились ${negative.map((indicator) => `${indicator.id} (${signed(district.indicatorDeltas[indicator.id])})`).join(', ')}.`);
    return {
      district: district.nameRu,
      verdict: `Оценка ${district.initialDistrictScore.toFixed(2)} → ${district.finalDistrictScore.toFixed(2)}; изменение ${signed(district.scoreDelta)}.`,
      ...(district.criticalIndicators.length ? {
        criticalWarning: `Ниже 40: ${district.criticalIndicators.map((id) => INDICATORS[id].nameRu).join(', ')}.`,
      } : {}),
    };
  });
  const longLag = sim.decisions.filter((decision) => MEASURES[decision.measureId].lag >= 4);
  if (longLag.length) risksAndTradeoffs.push(`${longLag.map((decision) => decision.measureId).join(', ')}: лаг 4 квартала; за горизонт модели учитывается 50% полного эффекта.`);
  if (sim.validation.remainingBudget > 0) actionableRecommendations.push(`Остаток ${sim.validation.remainingBudget} у.е. не даёт бонуса и не штрафуется. Сравнивайте допустимые замены по рассчитанному результату; шестую меру добавлять нельзя.`);
  if (!sim.activeSynergies.length) actionableRecommendations.push('В наборе нет активных синергий. При сравнении замен учитывайте связки M1+M2, M10+M12 и M5+M6 вместе с их стоимостью и ограничениями.');
  return {
    executiveSummary: `Score: ${sim.finalScore.toFixed(2)}; изменение к базе: ${signed(sim.scoreDelta)}. Потрачено ${sim.validation.totalCost} из 100 у.е. Слабейший район: ${weakest}. Критических показателей: ${sim.finalCritCount}. Это расчёт по синтетической модели на восемь кварталов.`,
    strengths,
    risksAndTradeoffs,
    districtHighlights,
    actionableRecommendations,
    akimatRatingVerdict: sim.finalCritCount === 0 ? 'Критические дефициты устранены' : 'Есть критические дефициты',
  };
}
