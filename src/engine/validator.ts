import { getLanguage, Language, translate } from '../i18n';
import { DirectionId, SelectedDecision, ValidationResult } from './types';
import { MEASURES, INCOMPATIBILITIES } from '../data/measures';
import { DISTRICTS } from '../data/districts';
import { DIRECTIONS } from '../data/indicators';

export const TOTAL_BUDGET = 100;
export const REQUIRED_DECISIONS_COUNT = 5;
export const MAX_MEASURES_PER_DIRECTION = 2;

export function validateDecisions(decisions: SelectedDecision[], language: Language = getLanguage()): ValidationResult {
  const t = (source: string, params: readonly unknown[] = []) => translate(source, language, params);
  const errors: string[] = [];
  const warnings: string[] = [];

  // Track counts by direction
  const directionCounts: Record<DirectionId, number> = {
    transport: 0,
    ecology: 0,
    social: 0,
    safety: 0,
    services: 0,
  };

  let totalCost = 0;
  const seenMeasureIds = new Set<string>();

  // Check decision count
  if (decisions.length !== REQUIRED_DECISIONS_COUNT) {
    errors.push(t("Требуется принять ровно {0} управленческих решений (сейчас выбрано: {1}).", [REQUIRED_DECISIONS_COUNT, decisions.length]));
  }

  for (const decision of decisions) {
    const measure = MEASURES[decision.measureId];
    if (!measure) {
      errors.push(t("Неизвестное мероприятие: {0}", [decision.measureId]));
      continue;
    }

    // Rule 3: No duplicate measures
    if (seenMeasureIds.has(decision.measureId)) {
      errors.push(t("Мероприятие {0} («{1}») выбрано повторно. Каждое мероприятие разрешено использовать максимум один раз.", [decision.measureId, measure.nameRu]));
    }
    seenMeasureIds.add(decision.measureId);

    // Sum cost
    totalCost += measure.cost;

    // Direction count
    directionCounts[measure.direction] = (directionCounts[measure.direction] || 0) + 1;

    // Rule 4: District validation
    if (measure.type === 'Район') {
      if (!decision.districtId) {
        errors.push(t("Для районного мероприятия {0} («{1}») необходимо указать конкретный целевой район.", [measure.id, measure.nameRu]));
      } else if (!DISTRICTS[decision.districtId]) {
        errors.push(t("Для мероприятия {0} указан некорректный район: {1}", [measure.id, decision.districtId]));
      }
    } else if (measure.type === 'Город') {
      if (decision.districtId) {
        // Warning or clear error
        warnings.push(t("Мероприятие {0} («{1}») является общегородским. Выбранный район игнорируется.", [measure.id, measure.nameRu]));
      }
    }
  }

  // Rule 1: Budget limit
  if (totalCost > TOTAL_BUDGET) {
    errors.push(t("Превышен бюджет города: потрачено {0} у.е. из доступных {1} у.е. (перерасход: {2} у.е.).", [totalCost, TOTAL_BUDGET, totalCost - TOTAL_BUDGET]));
  }

  // Rule 5: Direction limits (<= 2 per direction)
  for (const [direction, count] of Object.entries(directionCounts)) {
    if (count > MAX_MEASURES_PER_DIRECTION) {
      errors.push(t("Превышен лимит мер по направлению «{0}»: выбрано {1} мер (разрешено максимум {2}). Должно быть охвачено минимум 3 направления.", [DIRECTIONS[direction as DirectionId].nameRu, count, MAX_MEASURES_PER_DIRECTION]));
    }
  }

  // Rule 6: Incompatibilities
  for (const rule of INCOMPATIBILITIES) {
    const [m1Id, m2Id] = rule.pair;
    const d1 = decisions.find((d) => d.measureId === m1Id);
    const d2 = decisions.find((d) => d.measureId === m2Id);

    if (d1 && d2) {
      if (rule.scope === 'any_district') {
        errors.push(t(rule.reasonRu));
      } else if (rule.scope === 'same_district') {
        if (d1.districtId && d2.districtId && d1.districtId === d2.districtId) {
          const districtName = t(DISTRICTS[d1.districtId]?.nameRu) || d1.districtId;
          errors.push(t("{0} (Конфликт в районе {1}).", [rule.reasonRu, districtName]));
        }
      }
    }
  }

  const remainingBudget = TOTAL_BUDGET - totalCost;

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    totalCost,
    remainingBudget,
    decisionCount: decisions.length,
    directionCounts,
  };
}
