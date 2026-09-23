import { DirectionId, DistrictId, SelectedDecision, ValidationResult } from './types';
import { MEASURES, INCOMPATIBILITIES } from '../data/measures';
import { DISTRICTS } from '../data/districts';

export const TOTAL_BUDGET = 100;
export const REQUIRED_DECISIONS_COUNT = 5;
export const MAX_MEASURES_PER_DIRECTION = 2;

export interface ValidationOptions {
  /** Used while choosing measures; all rules except the minimum count still apply. */
  allowIncomplete?: boolean;
}

export function validateDecisions(input: unknown, options: ValidationOptions = {}): ValidationResult {
  const errors: string[] = [];
  const directionCounts: Record<DirectionId, number> = {
    transport: 0, ecology: 0, social: 0, safety: 0, services: 0,
  };
  const decisions: SelectedDecision[] = [];
  const seenMeasureIds = new Set<string>();
  const items: unknown[] = Array.isArray(input) ? input : [];
  let totalCost = 0;

  if (!Array.isArray(input)) {
    errors.push('Решения должны быть переданы массивом.');
  }
  if (items.length > REQUIRED_DECISIONS_COUNT || (!options.allowIncomplete && items.length !== REQUIRED_DECISIONS_COUNT)) {
    errors.push(`Требуется принять ровно ${REQUIRED_DECISIONS_COUNT} управленческих решений (сейчас выбрано: ${items.length}).`);
  }

  // The input also comes from HTTP. Types alone cannot validate its runtime shape.
  for (const [index, item] of items.entries()) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`Решение №${index + 1} должно быть объектом с идентификатором мероприятия.`);
      continue;
    }
    const candidate = item as Record<string, unknown>;
    if (!Object.hasOwn(candidate, 'measureId') || typeof candidate.measureId !== 'string') {
      errors.push(`В решении №${index + 1} требуется строковый идентификатор мероприятия measureId.`);
      continue;
    }
    const measureId = candidate.measureId;
    if (!Object.hasOwn(MEASURES, measureId)) {
      errors.push(`Неизвестное мероприятие: ${measureId}`);
      continue;
    }
    const measure = MEASURES[measureId];
    if (seenMeasureIds.has(measureId)) {
      errors.push(`Мероприятие ${measureId} («${measure.nameRu}») выбрано повторно. Каждое мероприятие разрешено использовать максимум один раз.`);
    }
    seenMeasureIds.add(measureId);
    totalCost += measure.cost;
    directionCounts[measure.direction]++;

    if (measure.type === 'Район') {
      if (!Object.hasOwn(candidate, 'districtId') || candidate.districtId === undefined) {
        errors.push(`Для районного мероприятия ${measure.id} («${measure.nameRu}») необходимо указать конкретный целевой район.`);
      } else if (typeof candidate.districtId !== 'string' || !Object.hasOwn(DISTRICTS, candidate.districtId)) {
        errors.push(`Для мероприятия ${measure.id} указан некорректный район.`);
      } else {
        decisions.push({ measureId, districtId: candidate.districtId as DistrictId });
      }
    } else if ('districtId' in candidate) {
      errors.push(`Мероприятие ${measure.id} («${measure.nameRu}») является общегородским: район указывать нельзя.`);
    } else {
      decisions.push({ measureId });
    }
  }

  if (totalCost > TOTAL_BUDGET) {
    errors.push(`Превышен бюджет города: потрачено ${totalCost} у.е. из доступных ${TOTAL_BUDGET} у.е. (перерасход: ${totalCost - TOTAL_BUDGET} у.е.).`);
  }
  for (const [direction, count] of Object.entries(directionCounts)) {
    if (count > MAX_MEASURES_PER_DIRECTION) {
      errors.push(`Превышен лимит мер по направлению «${direction}»: выбрано ${count} мер (разрешено максимум ${MAX_MEASURES_PER_DIRECTION}).`);
    }
  }

  for (const rule of INCOMPATIBILITIES) {
    const first = decisions.filter((decision) => decision.measureId === rule.pair[0]);
    const second = decisions.filter((decision) => decision.measureId === rule.pair[1]);
    if (!first.length || !second.length) continue;
    if (rule.scope === 'any_district') {
      errors.push(rule.reasonRu);
    } else {
      const conflict = first.find((a) => second.some((b) => a.districtId === b.districtId));
      if (conflict?.districtId) {
        errors.push(`${rule.reasonRu} (Конфликт в районе ${DISTRICTS[conflict.districtId].nameRu}).`);
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
