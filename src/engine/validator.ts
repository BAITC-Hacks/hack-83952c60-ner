import { DirectionId, SelectedDecision, ValidationResult } from './types';
import { MEASURES, INCOMPATIBILITIES } from '../data/measures';
import { DISTRICTS } from '../data/districts';

export const TOTAL_BUDGET = 100;
export const REQUIRED_DECISIONS_COUNT = 5;
export const MAX_MEASURES_PER_DIRECTION = 2;

export function validateDecisions(decisions: SelectedDecision[]): ValidationResult {
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
    errors.push(`Требуется принять ровно ${REQUIRED_DECISIONS_COUNT} управленческих решений (сейчас выбрано: ${decisions.length}).`);
  }

  for (const decision of decisions) {
    const measure = MEASURES[decision.measureId];
    if (!measure) {
      errors.push(`Неизвестное мероприятие: ${decision.measureId}`);
      continue;
    }

    // Rule 3: No duplicate measures
    if (seenMeasureIds.has(decision.measureId)) {
      errors.push(`Мероприятие ${decision.measureId} («${measure.nameRu}») выбрано повторно. Каждое мероприятие разрешено использовать максимум один раз.`);
    }
    seenMeasureIds.add(decision.measureId);

    // Sum cost
    totalCost += measure.cost;

    // Direction count
    directionCounts[measure.direction] = (directionCounts[measure.direction] || 0) + 1;

    // Rule 4: District validation
    if (measure.type === 'Район') {
      if (!decision.districtId) {
        errors.push(`Для районного мероприятия ${measure.id} («${measure.nameRu}») необходимо указать конкретный целевой район.`);
      } else if (!DISTRICTS[decision.districtId]) {
        errors.push(`Для мероприятия ${measure.id} указан некорректный район: ${decision.districtId}`);
      }
    } else if (measure.type === 'Город') {
      if (decision.districtId) {
        // Warning or clear error
        warnings.push(`Мероприятие ${measure.id} («${measure.nameRu}») является общегородским. Выбранный район игнорируется.`);
      }
    }
  }

  // Rule 1: Budget limit
  if (totalCost > TOTAL_BUDGET) {
    errors.push(`Превышен бюджет города: потрачено ${totalCost} у.е. из доступных ${TOTAL_BUDGET} у.е. (перерасход: ${totalCost - TOTAL_BUDGET} у.е.).`);
  }

  // Rule 5: Direction limits (<= 2 per direction)
  for (const [direction, count] of Object.entries(directionCounts)) {
    if (count > MAX_MEASURES_PER_DIRECTION) {
      errors.push(`Превышен лимит мер по направлению «${direction}»: выбрано ${count} мер (разрешено максимум ${MAX_MEASURES_PER_DIRECTION}). Должно быть охвачено минимум 3 направления.`);
    }
  }

  // Rule 6: Incompatibilities
  for (const rule of INCOMPATIBILITIES) {
    const [m1Id, m2Id] = rule.pair;
    const d1 = decisions.find((d) => d.measureId === m1Id);
    const d2 = decisions.find((d) => d.measureId === m2Id);

    if (d1 && d2) {
      if (rule.scope === 'any_district') {
        errors.push(rule.reasonRu);
      } else if (rule.scope === 'same_district') {
        if (d1.districtId && d2.districtId && d1.districtId === d2.districtId) {
          const districtName = DISTRICTS[d1.districtId]?.nameRu || d1.districtId;
          errors.push(`${rule.reasonRu} (Конфликт в районе ${districtName}).`);
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
