import { describe, it, expect } from 'vitest';
import { calculateBaseScore, runSimulation } from '../src/engine/simulator';
import { validateDecisions } from '../src/engine/validator';
import { SelectedDecision } from '../src/engine/types';

describe('Astana Quality of Life Score Engine', () => {
  it('should compute exact base score and district metrics matching specification', () => {
    const base = calculateBaseScore();

    // Verification from Section 3: Base Score = 52.56 (0.7 * 56.86 + 0.3 * 49.18 - 2)
    expect(base.baseScore).toBeCloseTo(52.56, 1);
    expect(base.baseCritCount).toBe(2); // NuRa S1=38, S2=35
    expect(base.baseMinDistrictScore).toBeCloseTo(49.18, 1);
    expect(base.baseCityAverage).toBeCloseTo(56.86, 1);

    // Verify district base scores
    expect(base.districts.esil.initialDistrictScore).toBeCloseTo(62.99, 1);
    expect(base.districts.almaty.initialDistrictScore).toBeCloseTo(57.06, 1);
    expect(base.districts.saryarka.initialDistrictScore).toBeCloseTo(54.65, 1);
    expect(base.districts.baikonur.initialDistrictScore).toBeCloseTo(56.63, 1);
    expect(base.districts.nura.initialDistrictScore).toBeCloseTo(49.18, 1);
  });

  it('should accurately calculate the specification reference example set (Score ~56.5)', () => {
    const decisions: SelectedDecision[] = [
      { measureId: 'M7', districtId: 'nura' },      // Школа + детсад in NuRa (cost 24)
      { measureId: 'M8', districtId: 'nura' },      // Центр семейного здоровья in NuRa (cost 20)
      { measureId: 'M10', districtId: 'nura' },     // Освещение и камеры in NuRa (cost 12)
      { measureId: 'M12' },                         // Цифровая платформа Город (cost 14)
      { measureId: 'M5', districtId: 'saryarka' },  // Чистое топливо in Saryarka (cost 25)
    ];

    const validation = validateDecisions(decisions);
    expect(validation.isValid).toBe(true);
    expect(validation.totalCost).toBe(95);
    expect(validation.remainingBudget).toBe(5);

    const result = runSimulation(decisions);
    expect(result.isValid).toBe(true);
    // Score should be approximately 56.5 (+4.0 over base)
    expect(result.finalScore).toBeGreaterThanOrEqual(56.4);
    expect(result.finalScore).toBeLessThanOrEqual(56.7);
    expect(result.scoreDelta).toBeCloseTo(4.0, 0);

    // N_crit should be 0 because S1 (38 -> 48) and S2 (35 -> 43.75) in NuRa are fixed
    expect(result.finalCritCount).toBe(0);
    expect(result.criticalPairs.length).toBe(0);

    // Synergy M10 + M12 should be active
    expect(result.activeSynergies.length).toBeGreaterThan(0);
  });

  it('should validate the cheapest valid set mentioned in Section 4 (Cost 61)', () => {
    const decisions: SelectedDecision[] = [
      { measureId: 'M9', districtId: 'nura' },      // Спорт-хабы (cost 10)
      { measureId: 'M11', districtId: 'almaty' },   // Безопасные переходы (cost 10)
      { measureId: 'M10', districtId: 'saryarka' }, // Освещение Safe City (cost 12)
      { measureId: 'M12' },                         // Цифровая платформа Город (cost 14)
      { measureId: 'M4', districtId: 'esil' },      // Парк (cost 15)
    ];

    const validation = validateDecisions(decisions);
    expect(validation.isValid).toBe(true);
    expect(validation.totalCost).toBe(61);
    expect(validation.remainingBudget).toBe(39);
  });
});
