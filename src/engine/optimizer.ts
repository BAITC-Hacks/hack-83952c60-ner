import { t } from '../i18n';
import { DistrictId, SelectedDecision, SimulationResult } from './types';
import { MEASURE_LIST, MEASURES } from '../data/measures';
import { DISTRICT_LIST } from '../data/districts';
import { runSimulation } from './simulator';
import { validateDecisions } from './validator';

export interface ScoredScenario {
  decisions: SelectedDecision[];
  score: number;
  scoreDelta: number;
  totalCost: number;
  critCount: number;
  activeSynergies: string[];
}

/**
 * Heuristic/Greedy and smart search to find the highest-scoring valid combinations
 */
export function findTopScenarios(limit = 3): ScoredScenario[] {
  // Key high-yield combos
  const candidatePresets: SelectedDecision[][] = [
    // Doc 2 official example
    [
      { measureId: 'M7', districtId: 'nura' },
      { measureId: 'M8', districtId: 'nura' },
      { measureId: 'M10', districtId: 'nura' },
      { measureId: 'M12' },
      { measureId: 'M5', districtId: 'saryarka' },
    ],
    // High-synergy Social + Ecology + Safety combo
    [
      { measureId: 'M7', districtId: 'nura' },
      { measureId: 'M8', districtId: 'nura' },
      { measureId: 'M10', districtId: 'nura' },
      { measureId: 'M12' },
      { measureId: 'M6' },
    ],
    // Infrastructure focus with M9 and M5
    [
      { measureId: 'M7', districtId: 'nura' },
      { measureId: 'M9', districtId: 'nura' },
      { measureId: 'M10', districtId: 'nura' },
      { measureId: 'M12' },
      { measureId: 'M5', districtId: 'saryarka' },
    ],
    // Balanced Transport + Social + Safety
    [
      { measureId: 'M1', districtId: 'almaty' },
      { measureId: 'M2' },
      { measureId: 'M7', districtId: 'nura' },
      { measureId: 'M8', districtId: 'nura' },
      { measureId: 'M10', districtId: 'nura' },
    ],
    // Pure cost-efficient wide coverage
    [
      { measureId: 'M9', districtId: 'nura' },
      { measureId: 'M10', districtId: 'nura' },
      { measureId: 'M12' },
      { measureId: 'M8', districtId: 'nura' },
      { measureId: 'M5', districtId: 'saryarka' },
    ],
  ];

  const results: ScoredScenario[] = [];

  for (const preset of candidatePresets) {
    const sim = runSimulation(preset);
    if (sim.isValid) {
      results.push({
        decisions: preset,
        score: Number(sim.finalScore.toFixed(2)),
        scoreDelta: Number(sim.scoreDelta.toFixed(2)),
        totalCost: sim.validation.totalCost,
        critCount: sim.finalCritCount,
        activeSynergies: sim.activeSynergies,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

export interface RecommendationSwap {
  removeMeasureId: string;
  removeMeasureName: string;
  addDecision: SelectedDecision;
  addMeasureName: string;
  scoreGain: number;
  projectedScore: number;
  explanation: string;
}

/**
 * Given the current user decisions, computes the best single replacement to boost Score
 */
export function findBestImprovements(currentDecisions: SelectedDecision[]): RecommendationSwap[] {
  if (currentDecisions.length !== 5) return [];

  const currentSim = runSimulation(currentDecisions);
  if (!currentSim.isValid) return [];
  const currentScore = currentSim.finalScore;
  const recommendations: RecommendationSwap[] = [];

  const currentMeasureIds = new Set(currentDecisions.map((d) => d.measureId));

  // Try swapping each current decision with an unused measure
  for (let i = 0; i < currentDecisions.length; i++) {
    const toRemove = currentDecisions[i];
    const remMeasure = MEASURES[toRemove.measureId];

    for (const candMeasure of MEASURE_LIST) {
      if (currentMeasureIds.has(candMeasure.id)) continue;

      const targetDistricts: (DistrictId | undefined)[] =
        candMeasure.type === 'Район'
          ? DISTRICT_LIST.map((d) => d.id)
          : [undefined];

      for (const targetDist of targetDistricts) {
        const candidateDecisions = [...currentDecisions];
        candidateDecisions[i] = {
          measureId: candMeasure.id,
          ...(targetDist ? { districtId: targetDist } : {}),
        };

        const testSim = runSimulation(candidateDecisions);
        if (testSim.isValid && testSim.finalScore > currentScore + 0.05) {
          const gain = testSim.finalScore - currentScore;

          let explanation = t("Замена увеличит Score на +{0}.", [gain.toFixed(2)]);
          if (testSim.finalCritCount < currentSim.finalCritCount) {
            explanation += t(" Ликвидирует критические дефициты (<40) и снимает штраф!");
          }
          if (testSim.activeSynergies.length > currentSim.activeSynergies.length) {
            explanation += t(" Активирует синергетический бонус связки мер.");
          }

          recommendations.push({
            removeMeasureId: toRemove.measureId,
            removeMeasureName: remMeasure.nameRu,
            addDecision: { measureId: candMeasure.id, ...(targetDist ? { districtId: targetDist } : {}) },
            addMeasureName: candMeasure.nameRu,
            scoreGain: Number(gain.toFixed(2)),
            projectedScore: Number(testSim.finalScore.toFixed(2)),
            explanation,
          });
        }
      }
    }
  }

  recommendations.sort((a, b) => b.scoreGain - a.scoreGain);
  // Return top 3 distinct swaps
  return recommendations.slice(0, 3);
}
