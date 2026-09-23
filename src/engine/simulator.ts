import {
  CityEvent,
  DistrictId,
  DistrictSimulationResult,
  IndicatorId,
  SelectedDecision,
  SimulationResult,
} from './types';
import { DISTRICTS, DISTRICT_LIST } from '../data/districts';
import { INDICATORS, INDICATOR_LIST } from '../data/indicators';
import { MEASURES, SYNERGIES } from '../data/measures';
import { validateDecisions } from './validator';

export function calculateBaseScore(): {
  districts: Record<DistrictId, DistrictSimulationResult>;
  baseCityAverage: number;
  baseMinDistrictScore: number;
  baseCritCount: number;
  baseScore: number;
} {
  const districts: Record<DistrictId, DistrictSimulationResult> = {} as any;
  let cityAvg = 0;
  let minScore = Infinity;
  let critCount = 0;

  for (const d of DISTRICT_LIST) {
    let dScore = 0;
    const criticalIndicators: IndicatorId[] = [];

    for (const ind of INDICATOR_LIST) {
      const val = d.indicators[ind.id];
      dScore += ind.weight * val;
      if (val < 40) {
        criticalIndicators.push(ind.id);
        critCount++;
      }
    }

    districts[d.id] = {
      districtId: d.id,
      nameRu: d.nameRu,
      populationShare: d.populationShare,
      initialIndicators: { ...d.indicators },
      finalIndicators: { ...d.indicators },
      indicatorDeltas: {
        T1: 0, T2: 0, E1: 0, E2: 0, S1: 0, S2: 0, B1: 0, B2: 0, C1: 0, C2: 0,
      },
      initialDistrictScore: dScore,
      finalDistrictScore: dScore,
      scoreDelta: 0,
      criticalIndicators,
    };

    cityAvg += d.populationShare * dScore;
    if (dScore < minScore) {
      minScore = dScore;
    }
  }

  const baseScore = 0.7 * cityAvg + 0.3 * minScore - 1.0 * critCount;

  return {
    districts,
    baseCityAverage: cityAvg,
    baseMinDistrictScore: minScore,
    baseCritCount: critCount,
    baseScore,
  };
}

export function runSimulation(
  decisions: SelectedDecision[],
  events: CityEvent[] = []
): SimulationResult {
  const validation = validateDecisions(decisions);
  const baseData = calculateBaseScore();

  if (!validation.isValid) {
    return {
      isValid: false,
      validation,
      decisions,
      districts: baseData.districts,
      baseCityAverage: baseData.baseCityAverage,
      finalCityAverage: baseData.baseCityAverage,
      baseMinDistrictScore: baseData.baseMinDistrictScore,
      finalMinDistrictScore: baseData.baseMinDistrictScore,
      weakestDistrictId: 'nura',
      baseCritCount: baseData.baseCritCount,
      finalCritCount: baseData.baseCritCount,
      criticalPairs: [],
      baseScore: baseData.baseScore,
      finalScore: 0,
      scoreDelta: 0,
      activeSynergies: [],
      appliedEvents: events,
    };
  }

  // Initialize indicator values for each district
  const modifiedIndicators: Record<DistrictId, Record<IndicatorId, number>> = {
    esil: { ...DISTRICTS.esil.indicators },
    almaty: { ...DISTRICTS.almaty.indicators },
    saryarka: { ...DISTRICTS.saryarka.indicators },
    baikonur: { ...DISTRICTS.baikonur.indicators },
    nura: { ...DISTRICTS.nura.indicators },
  };

  // 1. Apply measures with lag: factor = (8 - L) / 8
  for (const decision of decisions) {
    const measure = MEASURES[decision.measureId];
    if (!measure) continue;

    const lagFactor = (8 - measure.lag) / 8;

    for (const [indIdStr, rawEffect] of Object.entries(measure.effects)) {
      const indId = indIdStr as IndicatorId;
      if (rawEffect === undefined) continue;
      const realizedEffect = rawEffect * lagFactor;

      if (measure.type === 'Район' && decision.districtId) {
        modifiedIndicators[decision.districtId][indId] += realizedEffect;
      } else if (measure.type === 'Город') {
        for (const dist of DISTRICT_LIST) {
          modifiedIndicators[dist.id][indId] += realizedEffect;
        }
      }
    }
  }

  // 2. Apply Synergies (fixed bonus, unscaled by lag, to district of first measure)
  const activeSynergies: string[] = [];
  for (const rule of SYNERGIES) {
    const [m1Id, m2Id] = rule.pair;
    const d1 = decisions.find((d) => d.measureId === m1Id);
    const d2 = decisions.find((d) => d.measureId === m2Id);

    if (d1 && d2) {
      activeSynergies.push(rule.descriptionRu);
      // For district measures, bonus is given in the district of the first measure
      const targetDistrict = d1.districtId;
      if (targetDistrict && modifiedIndicators[targetDistrict]) {
        for (const [indIdStr, bonusVal] of Object.entries(rule.bonus)) {
          const indId = indIdStr as IndicatorId;
          if (bonusVal !== undefined) {
            modifiedIndicators[targetDistrict][indId] += bonusVal;
          }
        }
      }
    }
  }

  // 3. Apply optional events (if any)
  for (const ev of events) {
    if (ev.cityWideImpacts) {
      for (const [indIdStr, val] of Object.entries(ev.cityWideImpacts)) {
        const indId = indIdStr as IndicatorId;
        if (val !== undefined) {
          for (const dist of DISTRICT_LIST) {
            modifiedIndicators[dist.id][indId] += val;
          }
        }
      }
    }
    if (ev.indicatorImpacts) {
      for (const [distIdStr, indMap] of Object.entries(ev.indicatorImpacts)) {
        const distId = distIdStr as DistrictId;
        if (modifiedIndicators[distId] && indMap) {
          for (const [indIdStr, val] of Object.entries(indMap)) {
            const indId = indIdStr as IndicatorId;
            if (val !== undefined) {
              modifiedIndicators[distId][indId] += val;
            }
          }
        }
      }
    }
  }

  // 4. Clip indicators to [0, 100] and compute district scores
  const districtsResult: Record<DistrictId, DistrictSimulationResult> = {} as any;
  let finalCityAvg = 0;
  let finalMinScore = Infinity;
  let weakestDistrictId: DistrictId = 'nura';
  let finalCritCount = 0;
  const criticalPairs: Array<{ districtId: DistrictId; indicatorId: IndicatorId; value: number }> = [];

  for (const dist of DISTRICT_LIST) {
    let dScore = 0;
    const finalInds: Record<IndicatorId, number> = {} as any;
    const deltas: Record<IndicatorId, number> = {} as any;
    const critList: IndicatorId[] = [];

    for (const ind of INDICATOR_LIST) {
      // Step 1 formula: clip(I_dk + delta, 0, 100)
      const rawVal = modifiedIndicators[dist.id][ind.id];
      const clippedVal = Math.min(100, Math.max(0, rawVal));
      finalInds[ind.id] = clippedVal;
      deltas[ind.id] = clippedVal - dist.indicators[ind.id];

      // Step 2 formula: D_d = sum(w_k * I'_dk)
      dScore += ind.weight * clippedVal;

      // N_crit check: strictly less than 40
      if (clippedVal < 40) {
        critList.push(ind.id);
        finalCritCount++;
        criticalPairs.push({
          districtId: dist.id,
          indicatorId: ind.id,
          value: clippedVal,
        });
      }
    }

    const initialScore = dist.baseDistrictScore;
    districtsResult[dist.id] = {
      districtId: dist.id,
      nameRu: dist.nameRu,
      populationShare: dist.populationShare,
      initialIndicators: { ...dist.indicators },
      finalIndicators: finalInds,
      indicatorDeltas: deltas,
      initialDistrictScore: initialScore,
      finalDistrictScore: dScore,
      scoreDelta: dScore - initialScore,
      criticalIndicators: critList,
    };

    // Step 3 formula: D_avg = sum(pop_d * D_d)
    finalCityAvg += dist.populationShare * dScore;

    if (dScore < finalMinScore) {
      finalMinScore = dScore;
      weakestDistrictId = dist.id;
    }
  }

  // Step 4 formula: Score = 0.7 * D_avg + 0.3 * min(D_d) - 1.0 * N_crit
  const finalScore = 0.7 * finalCityAvg + 0.3 * finalMinScore - 1.0 * finalCritCount;

  return {
    isValid: true,
    validation,
    decisions,
    districts: districtsResult,
    baseCityAverage: baseData.baseCityAverage,
    finalCityAverage: finalCityAvg,
    baseMinDistrictScore: baseData.baseMinDistrictScore,
    finalMinDistrictScore: finalMinScore,
    weakestDistrictId,
    baseCritCount: baseData.baseCritCount,
    finalCritCount,
    criticalPairs,
    baseScore: baseData.baseScore,
    finalScore,
    scoreDelta: finalScore - baseData.baseScore,
    activeSynergies,
    appliedEvents: events,
  };
}
