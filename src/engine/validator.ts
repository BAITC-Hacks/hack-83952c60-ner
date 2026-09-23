import { getLanguage, Language, translate } from '../i18n';
import { DirectionId, DistrictId, SelectedDecision, ValidationResult } from './types';
import { MEASURES, INCOMPATIBILITIES } from '../data/measures';
import { DISTRICTS } from '../data/districts';
import { DIRECTIONS } from '../data/indicators';

export const TOTAL_BUDGET = 100;
export const REQUIRED_DECISIONS_COUNT = 5;
export const MAX_MEASURES_PER_DIRECTION = 2;

export interface ValidationOptions {
  /** Used while choosing measures; all rules except the minimum count still apply. */
  allowIncomplete?: boolean;
  language?: Language;
}

export function validateDecisions(input: unknown, options: ValidationOptions = {}): ValidationResult {
  const t = (source: string, params: readonly unknown[] = []) => translate(source, options.language ?? getLanguage(), params);
  const errors: string[] = [];
  const directionCounts: Record<DirectionId, number> = {
    transport: 0, ecology: 0, social: 0, safety: 0, services: 0,
  };
  const decisions: SelectedDecision[] = [];
  const seenMeasureIds = new Set<string>();
  const items: unknown[] = Array.isArray(input) ? input : [];
  let totalCost = 0;

  if (!Array.isArray(input)) {
    errors.push(t("Решения должны быть переданы массивом."));
  }
  if (items.length > REQUIRED_DECISIONS_COUNT || (!options.allowIncomplete && items.length !== REQUIRED_DECISIONS_COUNT)) {
    errors.push(t("Требуется принять ровно {0} управленческих решений (сейчас выбрано: {1}).", [REQUIRED_DECISIONS_COUNT, items.length]));
  }

  // The input also comes from HTTP. Types alone cannot validate its runtime shape.
  for (const [index, item] of items.entries()) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(t("Решение №{0} должно быть объектом с идентификатором мероприятия.", [index + 1]));
      continue;
    }
    const candidate = item as Record<string, unknown>;
    if (!Object.hasOwn(candidate, 'measureId') || typeof candidate.measureId !== 'string') {
      errors.push(t("В решении №{0} требуется строковый идентификатор мероприятия measureId.", [index + 1]));
      continue;
    }
    const measureId = candidate.measureId;
    if (!Object.hasOwn(MEASURES, measureId)) {
      errors.push(t("Неизвестное мероприятие: {0}", [measureId]));
      continue;
    }
    const measure = MEASURES[measureId];
    if (seenMeasureIds.has(measureId)) {
      errors.push(t("Мероприятие {0} («{1}») выбрано повторно. Каждое мероприятие разрешено использовать максимум один раз.", [measureId, measure.nameRu]));
    }
    seenMeasureIds.add(measureId);
    totalCost += measure.cost;
    directionCounts[measure.direction]++;

    if (measure.type === 'Район') {
      if (!Object.hasOwn(candidate, 'districtId') || candidate.districtId === undefined) {
        errors.push(t("Для районного мероприятия {0} («{1}») необходимо указать конкретный целевой район.", [measure.id, measure.nameRu]));
      } else if (typeof candidate.districtId !== 'string' || !Object.hasOwn(DISTRICTS, candidate.districtId)) {
        errors.push(t("Для мероприятия {0} указан некорректный район.", [measure.id]));
      } else {
        decisions.push({ measureId, districtId: candidate.districtId as DistrictId });
      }
    } else if ('districtId' in candidate) {
      errors.push(t("Мероприятие {0} («{1}») является общегородским: район указывать нельзя.", [measure.id, measure.nameRu]));
    } else {
      decisions.push({ measureId });
    }
  }

  if (totalCost > TOTAL_BUDGET) {
    errors.push(t("Превышен бюджет города: потрачено {0} у.е. из доступных {1} у.е. (перерасход: {2} у.е.).", [totalCost, TOTAL_BUDGET, totalCost - TOTAL_BUDGET]));
  }
  for (const [direction, count] of Object.entries(directionCounts)) {
    if (count > MAX_MEASURES_PER_DIRECTION) {
      errors.push(t("Превышен лимит мер по направлению «{0}»: выбрано {1} мер (разрешено максимум {2}).", [DIRECTIONS[direction as DirectionId].nameRu, count, MAX_MEASURES_PER_DIRECTION]));
    }
  }

  for (const rule of INCOMPATIBILITIES) {
    const first = decisions.filter((decision) => decision.measureId === rule.pair[0]);
    const second = decisions.filter((decision) => decision.measureId === rule.pair[1]);
    if (!first.length || !second.length) continue;
    if (rule.scope === 'any_district') {
      errors.push(t(rule.reasonRu));
    } else {
      const conflict = first.find((a) => second.some((b) => a.districtId === b.districtId));
      if (conflict?.districtId) {
        errors.push(t("{0} (Конфликт в районе {1}).", [rule.reasonRu, DISTRICTS[conflict.districtId].nameRu]));
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: [],
    totalCost,
    remainingBudget: TOTAL_BUDGET - totalCost,
    decisionCount: items.length,
    directionCounts,
  };
}
