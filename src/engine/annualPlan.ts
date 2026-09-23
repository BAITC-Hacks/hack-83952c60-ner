import { runSimulationAtQuarter } from './simulator';
import { CityEvent, SimulationResult } from './types';

export interface AnnualPlanYear {
  year: 1 | 2 | 3;
  quarter: number;
  simulation: SimulationResult;
  annualSpending: number;
  cumulativeSpending: number;
  remainingBudget: number;
}

export interface AnnualPlan {
  isValid: boolean;
  years: AnnualPlanYear[];
}

/**
 * Three annual snapshots of the same five measures, launched and paid for once at the start.
 * Each snapshot starts from the baseline, so neither measure effects nor events compound.
 */
export function runAnnualPlan(input: unknown, events: CityEvent[] = []): AnnualPlan {
  const firstYear = runSimulationAtQuarter(input, 4, events);
  if (!firstYear.isValid) return { isValid: false, years: [] };

  const { totalCost, remainingBudget } = firstYear.validation;
  return {
    isValid: true,
    years: ([1, 2, 3] as const).map((year) => ({
      year,
      quarter: year * 4,
      simulation: year === 1 ? firstYear : runSimulationAtQuarter(input, year * 4, events),
      annualSpending: year === 1 ? totalCost : 0,
      cumulativeSpending: totalCost,
      remainingBudget,
    })),
  };
}
