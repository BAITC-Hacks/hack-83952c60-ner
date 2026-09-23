import { AIAnalysis, SimulationResult } from '../engine/types';
import { DISTRICTS } from '../data/districts';
import { INDICATORS } from '../data/indicators';
import { MEASURES } from '../data/measures';

export function generateAIAnalysis(sim: SimulationResult): AIAnalysis {
  if (!sim.isValid) {
    return {
      executiveSummary: 'Сценарий невалиден. Математический движок отклонил набор решений из-за нарушения регламентных ограничений бюджета или несовместимости проектов.',
      strengths: [],
      risksAndTradeoffs: sim.validation.errors,
      districtHighlights: [],
      actionableRecommendations: [
        'Скорректируйте бюджет так, чтобы сумма расходов не превышала 100 у.е.',
        'Убедитесь, что выбрано ровно 5 решений и не более 2 в одном направлении.',
        'Устраните конфликты несовместимости (например, BRT vs LRT или земельные наложения).',
      ],
      akimatRatingVerdict: 'Решение заблокировано регламентом',
    };
  }

  const strengths: string[] = [];
  const risks: string[] = [];
  const districtHighlights: Array<{ district: string; verdict: string; criticalWarning?: string }> = [];

  const { finalScore, baseScore, scoreDelta, finalCritCount, baseCritCount, weakestDistrictId } = sim;
  const weakestDistrictName = DISTRICTS[weakestDistrictId]?.nameRu || weakestDistrictId;

  // 1. Evaluate Critical Deficits (N_crit)
  if (finalCritCount === 0 && baseCritCount > 0) {
    strengths.push(
      `Ликвидация критических провалов: Полностью устранены показатели с оценкой ниже 40 баллов в районе Нура (были S1: 38, S2: 35), что сняло штраф -${baseCritCount} балла с общегородского рейтинга.`
    );
  } else if (finalCritCount > 0) {
    risks.push(
      `Критический дефицит базовых сервисов: В городе сохраняется ${finalCritCount} показатель(я) с оценкой ниже 40 баллов. Каждый такой провал накладывает жесткий штраф (-1.0 балл за каждый) на итоговый Astana Quality of Life Score.`
    );
  }

  // 2. Evaluate Weakest District Pull
  const nuraDist = sim.districts.nura;
  if (nuraDist.scoreDelta > 3.0) {
    strengths.push(
      `Сглаживание пространственного неравенства: Район Нура получил мощный импульс (+${nuraDist.scoreDelta.toFixed(2)} балла), что подняло минимальную планку качества жизни в городе с 49.18 до ${sim.finalMinDistrictScore.toFixed(2)}.`
    );
  } else if (nuraDist.scoreDelta <= 0.5) {
    risks.push(
      `Игнорирование отстающего района: Район Нура практически не получил точечных инвестиций (+${nuraDist.scoreDelta.toFixed(2)}). Так как формула Score отдает 30% веса наименее благополучному району, это сдерживает итоговый результат всего мегаполиса.`
    );
  }

  // 3. Synergies evaluation
  if (sim.activeSynergies.length > 0) {
    strengths.push(
      `Реализация синергетических эффектов: Активировано ${sim.activeSynergies.length} синергии(й). Согласованные межведомственные меры дали дополнительный прирост показателей без увеличения финансовых затрат.`
    );
  } else {
    risks.push(
      `Упущенная синергия: В выбранном наборе нет взаимоусиливающих мер (например, M10 Safe City + M12 iKomek или M1 Bus Lanes + M2 Умные светофоры), что означает недополученные бонусы.`
    );
  }

  // 4. Direction balance & lag evaluation
  const decisions = sim.decisions;
  const longLagDecisions = decisions.filter((d) => (MEASURES[d.measureId]?.lag || 0) >= 4);
  const quickWinDecisions = decisions.filter((d) => (MEASURES[d.measureId]?.lag || 0) <= 1);

  if (longLagDecisions.length >= 2) {
    risks.push(
      `Длинный инвестиционный горизонт: ${longLagDecisions.length} меры имеют лаг внедрения 4 квартала. В рамках 2-летнего горизонта (8 кварталов) реализуется лишь 50% их потенциала.`
    );
  }

  if (quickWinDecisions.length >= 2) {
    strengths.push(
      `Быстрый эффект (Quick Wins): Выбрано ${quickWinDecisions.length} мер с лагом 1 квартал, эффект от которых горожане ощутят уже в первые 3 месяца (реализация 87.5% мощности).`
    );
  }

  // 5. District-by-district highlights
  for (const [dId, dRes] of Object.entries(sim.districts)) {
    const dName = dRes.nameRu;
    const delta = dRes.scoreDelta;
    let verdict = '';
    let warning: string | undefined = undefined;

    if (dRes.criticalIndicators.length > 0) {
      warning = `Внимание: критические дефициты в метриках: ${dRes.criticalIndicators.map((i) => INDICATORS[i].nameRu).join(', ')}`;
    }

    if (delta >= 4.0) {
      verdict = `Лидер прорыва (+${delta.toFixed(2)}): значительный рост городской среды и закрытие узких мест.`;
    } else if (delta >= 1.5) {
      verdict = `Умеренное развитие (+${delta.toFixed(2)}): стабильное улучшение качества жизни.`;
    } else if (delta > 0) {
      verdict = `Косвенный прирост (+${delta.toFixed(2)}): в основном за счет общегородских сервисов.`;
    } else {
      verdict = `Стагнация (+0.00): район не затронут прямыми или общегородскими мерами.`;
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
      'Первоочередная мера: Инвестируйте в социальную инфраструктуру Нуры (M7 Школа/детсад или M8 Поликлиника), чтобы ликвидировать штрафы N_crit.'
    );
  }
  if (sim.validation.remainingBudget >= 12) {
    actionableRecommendations.push(
      `Свободный бюджет ${sim.validation.remainingBudget} у.е.: Доступны резервы, которые можно задействовать для более капиталоемких мер (например, M5 Газификация или M10 Safe City).`
    );
  }
  if (sim.activeSynergies.length === 0) {
    actionableRecommendations.push(
      'Попробуйте включить связку «M10 Освещение Safe City» (район) + «M12 Единая платформа iKomek» (город) — это даст бесплатный бонус +2 к безопасности B1.'
    );
  }

  // 7. Executive summary & Akimat rating
  let akimatRatingVerdict = '';
  let executiveSummary = '';

  if (finalScore >= 56.5) {
    akimatRatingVerdict = 'Стратег инклюзивного развития (Класс A)';
    executiveSummary = `Высокоэффективный сбалансированный сценарий. Прирост Astana Quality of Life Score составил +${scoreDelta.toFixed(2)} (итоговый балл: ${finalScore.toFixed(2)}). Устранены глубокие инфраструктурные разрывы, реализована социальная защита отстающих районов при сохранении бюджетной дисциплины (израсходовано ${sim.validation.totalCost}/100 у.е.).`;
  } else if (finalScore >= 54.0) {
    akimatRatingVerdict = 'Прагматичный управленец (Класс B)';
    executiveSummary = `Добротный рабочий сценарий с положительной динамикой (+${scoreDelta.toFixed(2)} к базовому уровню). Достигнуты точечные улучшения, однако потенциал оптимизации и синергии использован не полностью.`;
  } else {
    akimatRatingVerdict = 'Локальный фокус / Высокие риски (Класс C)';
    executiveSummary = `Сценарий имеет диспропорции (+${scoreDelta.toFixed(2)}). Сохраняются нерешенные критические дефициты в уязвимых районах, из-за чего штрафные коэффициенты снижают итоговый городской рейтинг.`;
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
