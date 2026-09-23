import { getLanguage, Language, translate } from '../i18n';
import { AIAnalysis, SimulationResult } from '../engine/types';
import { DISTRICTS } from '../data/districts';
import { INDICATORS } from '../data/indicators';
import { MEASURES } from '../data/measures';
import { validateDecisions } from '../engine/validator';

export function generateAIAnalysis(sim: SimulationResult, language: Language = getLanguage()): AIAnalysis {
  const t = (source: string, params: readonly unknown[] = []) => translate(source, language, params);
  if (!sim.isValid) {
    return {
      executiveSummary: t("Сценарий невалиден. Математический движок отклонил набор решений из-за нарушения регламентных ограничений бюджета или несовместимости проектов."),
      strengths: [],
      risksAndTradeoffs: validateDecisions(sim.decisions, language).errors,
      districtHighlights: [],
      actionableRecommendations: [
        t("Скорректируйте бюджет так, чтобы сумма расходов не превышала 100 у.е."),
        t("Убедитесь, что выбрано ровно 5 решений и не более 2 в одном направлении."),
        t("Устраните конфликты несовместимости (например, BRT vs LRT или земельные наложения)."),
      ],
      akimatRatingVerdict: t("Решение заблокировано регламентом"),
    };
  }

  const strengths: string[] = [];
  const risks: string[] = [];
  const districtHighlights: Array<{ district: string; verdict: string; criticalWarning?: string }> = [];

  const { finalScore, baseScore, scoreDelta, finalCritCount, baseCritCount, weakestDistrictId } = sim;
  const weakestDistrictName = t(DISTRICTS[weakestDistrictId]?.nameRu) || weakestDistrictId;

  // 1. Evaluate Critical Deficits (N_crit)
  if (finalCritCount === 0 && baseCritCount > 0) {
    strengths.push(
      t("Ликвидация критических провалов: Полностью устранены показатели с оценкой ниже 40 баллов в районе Нура (были S1: 38, S2: 35), что сняло штраф -{0} балла с общегородского рейтинга.", [baseCritCount])
    );
  } else if (finalCritCount > 0) {
    risks.push(
      t("Критический дефицит базовых сервисов: В городе сохраняется {0} показатель(я) с оценкой ниже 40 баллов. Каждый такой провал накладывает жесткий штраф (-1.0 балл за каждый) на итоговый Astana Quality of Life Score.", [finalCritCount])
    );
  }

  // 2. Evaluate Weakest District Pull
  const nuraDist = sim.districts.nura;
  if (nuraDist.scoreDelta > 3.0) {
    strengths.push(
      t("Сглаживание пространственного неравенства: Район Нура получил мощный импульс (+{0} балла), что подняло минимальную планку качества жизни в городе с 49.18 до {1}.", [nuraDist.scoreDelta.toFixed(2), sim.finalMinDistrictScore.toFixed(2)])
    );
  } else if (nuraDist.scoreDelta <= 0.5) {
    risks.push(
      t("Игнорирование отстающего района: Район Нура практически не получил точечных инвестиций (+{0}). Так как формула Score отдает 30% веса наименее благополучному району, это сдерживает итоговый результат всего мегаполиса.", [nuraDist.scoreDelta.toFixed(2)])
    );
  }

  // 3. Synergies evaluation
  if (sim.activeSynergies.length > 0) {
    strengths.push(
      t("Реализация синергетических эффектов: Активировано {0} синергии(й). Согласованные межведомственные меры дали дополнительный прирост показателей без увеличения финансовых затрат.", [sim.activeSynergies.length])
    );
  } else {
    risks.push(
      t("Упущенная синергия: В выбранном наборе нет взаимоусиливающих мер (например, M10 Safe City + M12 iKomek или M1 Bus Lanes + M2 Умные светофоры), что означает недополученные бонусы.")
    );
  }

  // 4. Direction balance & lag evaluation
  const decisions = sim.decisions;
  const longLagDecisions = decisions.filter((d) => (MEASURES[d.measureId]?.lag || 0) >= 4);
  const quickWinDecisions = decisions.filter((d) => (MEASURES[d.measureId]?.lag || 0) <= 1);

  if (longLagDecisions.length >= 2) {
    risks.push(
      t("Длинный инвестиционный горизонт: {0} меры имеют лаг внедрения 4 квартала. В рамках 2-летнего горизонта (8 кварталов) реализуется лишь 50% их потенциала.", [longLagDecisions.length])
    );
  }

  if (quickWinDecisions.length >= 2) {
    strengths.push(
      t("Быстрый эффект (Quick Wins): Выбрано {0} мер с лагом 1 квартал, эффект от которых горожане ощутят уже в первые 3 месяца (реализация 87.5% мощности).", [quickWinDecisions.length])
    );
  }

  // 5. District-by-district highlights
  for (const [dId, dRes] of Object.entries(sim.districts)) {
    const dName = t(dRes.nameRu);
    const delta = dRes.scoreDelta;
    let verdict = '';
    let warning: string | undefined = undefined;

    if (dRes.criticalIndicators.length > 0) {
      warning = t("Внимание: критические дефициты в метриках: {0}", [dRes.criticalIndicators.map((i) => t(INDICATORS[i].nameRu)).join(', ')]);
    }

    if (delta >= 4.0) {
      verdict = t("Лидер прорыва (+{0}): значительный рост городской среды и закрытие узких мест.", [delta.toFixed(2)]);
    } else if (delta >= 1.5) {
      verdict = t("Умеренное развитие (+{0}): стабильное улучшение качества жизни.", [delta.toFixed(2)]);
    } else if (delta > 0) {
      verdict = t("Косвенный прирост (+{0}): в основном за счет общегородских сервисов.", [delta.toFixed(2)]);
    } else {
      verdict = t("Стагнация (+0.00): район не затронут прямыми или общегородскими мерами.");
    }

    districtHighlights.push({
      district: dName,
      verdict,
      criticalWarning: warning,
    });
  }

  // 6. Actionable recommendations
  const actionableRecommendations: string[] = [];
  if (finalCritCount > 0) {
    actionableRecommendations.push(
      t("Первоочередная мера: Инвестируйте в социальную инфраструктуру Нуры (M7 Школа/детсад или M8 Поликлиника), чтобы ликвидировать штрафы N_crit.")
    );
  }
  if (sim.validation.remainingBudget >= 12) {
    actionableRecommendations.push(
      t("Свободный бюджет {0} у.е.: Доступны резервы, которые можно задействовать для более капиталоемких мер (например, M5 Газификация или M10 Safe City).", [sim.validation.remainingBudget])
    );
  }
  if (sim.activeSynergies.length === 0) {
    actionableRecommendations.push(
      t("Попробуйте включить связку «M10 Освещение Safe City» (район) + «M12 Единая платформа iKomek» (город) — это даст бесплатный бонус +2 к безопасности B1.")
    );
  }

  // 7. Executive summary & Akimat rating
  let akimatRatingVerdict = '';
  let executiveSummary = '';

  if (finalScore >= 56.5) {
    akimatRatingVerdict = t("Стратег инклюзивного развития (Класс A)");
    executiveSummary = t("Высокоэффективный сбалансированный сценарий. Прирост Astana Quality of Life Score составил +{0} (итоговый балл: {1}). Устранены глубокие инфраструктурные разрывы, реализована социальная защита отстающих районов при сохранении бюджетной дисциплины (израсходовано {2}/100 у.е.).", [scoreDelta.toFixed(2), finalScore.toFixed(2), sim.validation.totalCost]);
  } else if (finalScore >= 54.0) {
    akimatRatingVerdict = t("Прагматичный управленец (Класс B)");
    executiveSummary = t("Добротный рабочий сценарий с положительной динамикой (+{0} к базовому уровню). Достигнуты точечные улучшения, однако потенциал оптимизации и синергии использован не полностью.", [scoreDelta.toFixed(2)]);
  } else {
    akimatRatingVerdict = t("Локальный фокус / Высокие риски (Класс C)");
    executiveSummary = t("Сценарий имеет диспропорции (+{0}). Сохраняются нерешенные критические дефициты в уязвимых районах, из-за чего штрафные коэффициенты снижают итоговый городской рейтинг.", [scoreDelta.toFixed(2)]);
  }

  return {
    executiveSummary,
    strengths,
    risksAndTradeoffs: risks,
    districtHighlights,
    actionableRecommendations,
    akimatRatingVerdict,
  };
}
