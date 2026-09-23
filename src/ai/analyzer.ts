import { getLanguage, Language, translate } from '../i18n';
import { AIAnalysis, SimulationResult } from '../engine/types';
import { DISTRICTS } from '../data/districts';
import { INDICATORS, INDICATOR_LIST } from '../data/indicators';
import { MEASURES } from '../data/measures';

const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}`;

/** Deterministic fallback; this function does not call a language model. */
export function generateAIAnalysis(sim: SimulationResult, language: Language = getLanguage()): AIAnalysis {
  const t = (source: string, params: readonly unknown[] = []) => translate(source, language, params);
  if (!sim.isValid) {
    return {
      executiveSummary: t("Итоговый Score не рассчитан: сначала составьте допустимый набор из пяти решений."),
      strengths: [],
      risksAndTradeoffs: sim.validation.errors,
      districtHighlights: [],
      actionableRecommendations: [t("Исправьте указанные ограничения и повторите анализ.")],
      akimatRatingVerdict: t("Сценарий не завершён"),
    };
  }
  const strengths: string[] = [];
  const risksAndTradeoffs: string[] = [];
  const actionableRecommendations: string[] = [];
  const horizonQuarters = sim.horizonQuarters ?? 8;
  const weakest = t(DISTRICTS[sim.weakestDistrictId].nameRu);
  if (sim.scoreDelta > 0) {
    strengths.push(t("Городской Score вырос на {0} относительно исходных условий.", [signed(sim.scoreDelta)]));
  } else if (sim.scoreDelta < 0) {
    risksAndTradeoffs.push(t("Городской Score снизился на {0} относительно исходных условий.", [Math.abs(sim.scoreDelta).toFixed(2)]));
  }
  if (sim.finalCritCount === 0) {
    strengths.push(t("Показателей ниже 40 не осталось. Штраф за критические значения: 0 (в базе: {0}).", [sim.baseCritCount]));
  } else {
    risksAndTradeoffs.push(t("Осталось критических показателей: {0}. Штраф в формуле Score: {1}.", [sim.finalCritCount, sim.finalCritCount]));
    for (const pair of sim.criticalPairs) {
      actionableRecommendations.push(t("При пересмотре мер обратите внимание на район {0}: {1} — {2}. Проверяйте замену в пределах пяти решений и бюджета.", [DISTRICTS[pair.districtId].nameRu, INDICATORS[pair.indicatorId].nameRu, pair.value.toFixed(2)]));
    }
  }
  const minDelta = sim.finalMinDistrictScore - sim.baseMinDistrictScore;
  if (minDelta > 0) strengths.push(t("Минимальная районная оценка выросла на {0}. Текущий слабейший район — {1} ({2}).", [signed(minDelta), weakest, sim.finalMinDistrictScore.toFixed(2)]));
  for (const synergy of sim.activeSynergies) strengths.push(t("{0}. Её бонус не уменьшается лагом.", [t(synergy).replace(/[.!]+$/, '')]));
  const districtHighlights = Object.values(sim.districts).map((district) => {
    const negative = INDICATOR_LIST.filter((indicator) => district.indicatorDeltas[indicator.id] < 0);
    if (negative.length) risksAndTradeoffs.push(t("{0}: снизились {1}.", [district.nameRu, negative.map((indicator) => `${indicator.id} (${signed(district.indicatorDeltas[indicator.id])})`).join(', ')]));
    return {
      district: t(district.nameRu),
      verdict: t("Оценка {0} → {1}; изменение {2}.", [district.initialDistrictScore.toFixed(2), district.finalDistrictScore.toFixed(2), signed(district.scoreDelta)]),
      ...(district.criticalIndicators.length ? {
        criticalWarning: t("Ниже 40: {0}.", [district.criticalIndicators.map((id) => t(INDICATORS[id].nameRu)).join(', ')]),
      } : {}),
    };
  });
  const longLag = sim.decisions.filter((decision) => MEASURES[decision.measureId].lag >= 4);
  if (horizonQuarters === 8 && longLag.length) {
    risksAndTradeoffs.push(t("{0}: лаг 4 квартала; за горизонт модели учитывается 50% полного эффекта.", [longLag.map((decision) => decision.measureId).join(', ')]));
  } else {
    for (const decision of longLag) {
      const lag = MEASURES[decision.measureId].lag;
      const effectFactor = Math.min(1, Math.max(0, (horizonQuarters - lag) / 8));
      if (effectFactor < 1) risksAndTradeoffs.push(t("{0}: лаг {1} квартала; за {2} кварталов учитывается {3}% полного эффекта.", [decision.measureId, lag, horizonQuarters, effectFactor * 100]));
    }
  }
  if (sim.validation.remainingBudget > 0) actionableRecommendations.push(t("Остаток {0} у.е. не даёт бонуса и не штрафуется. Сравнивайте допустимые замены по рассчитанному результату; шестую меру добавлять нельзя.", [sim.validation.remainingBudget]));
  if (!sim.activeSynergies.length) actionableRecommendations.push(t("В наборе нет активных синергий. При сравнении замен учитывайте связки M1+M2, M10+M12 и M5+M6 вместе с их стоимостью и ограничениями."));
  return {
    executiveSummary: horizonQuarters === 8
      ? t("Score: {0}; изменение к базе: {1}. Потрачено {2} из 100 у.е. Слабейший район: {3}. Критических показателей: {4}. Это расчёт по синтетической модели на восемь кварталов.", [sim.finalScore.toFixed(2), signed(sim.scoreDelta), sim.validation.totalCost, weakest, sim.finalCritCount])
      : t("Score: {0}; изменение к базе: {1}. Потрачено {2} из 100 у.е. Слабейший район: {3}. Критических показателей: {4}. Это расчёт по синтетической модели на {5} кварталов.", [sim.finalScore.toFixed(2), signed(sim.scoreDelta), sim.validation.totalCost, weakest, sim.finalCritCount, horizonQuarters]),
    strengths,
    risksAndTradeoffs,
    districtHighlights,
    actionableRecommendations,
    akimatRatingVerdict: sim.finalCritCount === 0 ? t("Критические дефициты устранены") : t("Есть критические дефициты"),
  };
}
