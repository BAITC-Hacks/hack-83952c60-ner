import { BRIDGES, DISTRICTS_DATA, DISTRICT_IDS, POPULATION_SCALE } from './data';
import type { DistrictId, MigrationFlow, TrafficLoad, TransportMode, TravelPurpose } from './types';

/** Строки — место проживания, столбцы — назначение; порядок DISTRICT_IDS.
 * Каждая строка суммируется в 1. Это сценарные вероятности, не измеренные потоки. */
export const PURPOSE_DESTINATION_WEIGHTS: Readonly<Record<TravelPurpose, readonly (readonly number[])[]>> = {
  work: [
    [.63, .08, .12, .07, .06, .04], [.43, .25, .15, .10, .04, .03],
    [.45, .12, .23, .12, .04, .04], [.28, .15, .22, .28, .03, .04],
    [.56, .10, .13, .07, .10, .04], [.51, .06, .20, .08, .04, .11],
  ],
  school: [
    [.55, .15, .17, .03, .05, .05], [.08, .76, .10, .03, .02, .01],
    [.14, .12, .64, .06, .02, .02], [.07, .14, .15, .59, .02, .03],
    [.41, .19, .13, .03, .21, .03], [.30, .09, .23, .08, .05, .25],
  ],
  market: [
    [.24, .18, .24, .25, .05, .04], [.08, .46, .19, .22, .03, .02],
    [.12, .18, .39, .25, .03, .03], [.07, .20, .20, .48, .02, .03],
    [.19, .24, .21, .24, .09, .03], [.19, .13, .28, .27, .03, .10],
  ],
  leisure: [
    [.56, .10, .10, .04, .12, .08], [.33, .35, .13, .05, .08, .06],
    [.35, .12, .34, .05, .08, .06], [.27, .17, .22, .22, .06, .06],
    [.46, .10, .10, .03, .25, .06], [.42, .07, .14, .04, .08, .25],
  ],
};

export function validateHour(hour: number): void {
  if (!Number.isFinite(hour) || hour < 0 || hour >= 24) throw new RangeError('hour должен быть в диапазоне [0, 24)');
}

export function selectBridge(from: DistrictId, to: DistrictId): string | undefined {
  const origin = DISTRICTS_DATA.find(d => d.id === from);
  const destination = DISTRICTS_DATA.find(d => d.id === to);
  if (!origin || !destination) throw new RangeError('Неизвестный район маршрута');
  if (origin.bank === destination.bank) return undefined;
  const midpoint = (origin.centroid[0] + destination.centroid[0]) / 2;
  return BRIDGES.reduce((best, bridge) => Math.abs(bridge.left[0] - midpoint) < Math.abs(best.left[0] - midpoint) ? bridge : best).id;
}

const PURPOSE_SHARES: Readonly<Record<TravelPurpose, number>> = { work: .48, school: .23, market: .19, leisure: .10 };

/** Разбиение агрегатов на потоки методом наибольших остатков.
 * Каждый житель включён ровно один раз, каждая частица = 1000 жителей.
 * Вечером рабочие/школьные/рыночные маршруты разворачиваются к месту проживания.
 * Это представительная визуальная когорта: не все жители одновременно на дороге. */
export function createMigrationMatrix(hour = 8): MigrationFlow[] {
  validateHour(hour);
  const reverse = hour >= 16 && hour < 21;
  const flows: MigrationFlow[] = [];
  DISTRICTS_DATA.forEach((district, originIndex) => {
    const total = district.population / POPULATION_SCALE;
    const candidates: Array<{ to: DistrictId; purpose: TravelPurpose; mode: TransportMode; exact: number; count: number }> = [];
    for (const purpose of Object.keys(PURPOSE_SHARES) as TravelPurpose[]) {
      DISTRICT_IDS.forEach((to, destinationIndex) => {
        const destinationWeight = PURPOSE_DESTINATION_WEIGHTS[purpose][originIndex][destinationIndex];
        const modes: Array<[TransportMode, number]> = purpose === 'school' ? [['school', 1]] : [['car', district.income === 'high' ? .72 : .57], ['bus', district.income === 'high' ? .28 : .43]];
        for (const [mode, share] of modes) {
          const exact = total * PURPOSE_SHARES[purpose] * destinationWeight * share;
          candidates.push({ to, purpose, mode, exact, count: Math.floor(exact) });
        }
      });
    }
    let remaining = total - candidates.reduce((sum, candidate) => sum + candidate.count, 0);
    const remainders = candidates.map((candidate, index) => ({ index, remainder: candidate.exact - candidate.count })).sort((a, b) => b.remainder - a.remainder || a.index - b.index);
    for (let index = 0; remaining > 0; index++, remaining--) candidates[remainders[index].index].count++;
    for (const candidate of candidates) {
      if (!candidate.count) continue;
      const inbound = reverse && candidate.purpose !== 'leisure';
      const from = inbound ? candidate.to : district.id;
      const to = inbound ? district.id : candidate.to;
      flows.push({ from, to, purpose: candidate.purpose, mode: candidate.mode, particles: candidate.count, residents: candidate.count * POPULATION_SCALE, ...(selectBridge(from, to) ? { bridgeId: selectBridge(from, to) } : {}) });
    }
  });
  return flows;
}

/** Доля когорты, совершающая поездку в текущий час. Все параметры — игровые. */
export function activityShare(hour: number): number {
  validateHour(hour);
  if (hour < 6 || hour >= 23) return .008;
  if (hour >= 7 && hour < 10) return .18;
  if (hour >= 16 && hour < 20) return .16;
  return .06;
}

export function estimateTrafficLoad(flows: readonly MigrationFlow[], hour = 8): TrafficLoad {
  const active = activityShare(hour);
  const bridgeVolumes: Record<string, number> = Object.fromEntries(BRIDGES.map(bridge => [bridge.id, 0]));
  const destinationVolumes: Partial<Record<DistrictId, number>> = {};
  for (const flow of flows) {
    if (!Number.isFinite(flow.residents) || flow.residents < 0) throw new RangeError('residents должен быть конечным неотрицательным числом');
    if (!DISTRICT_IDS.includes(flow.from) || !DISTRICT_IDS.includes(flow.to)) throw new RangeError('Неизвестный район потока');
    const volume = flow.residents * active;
    if (flow.bridgeId) {
      if (!(flow.bridgeId in bridgeVolumes)) throw new RangeError('Неизвестный мост потока');
      bridgeVolumes[flow.bridgeId] += volume;
    }
    destinationVolumes[flow.to] = (destinationVolumes[flow.to] ?? 0) + volume;
  }
  const districtLoad = Object.fromEntries(DISTRICTS_DATA.map(district => [district.id,
    (destinationVolumes[district.id] ?? 0) / (district.population * (district.id === 'nura' ? .028 : .16)),
  ]));
  const bridges = BRIDGES.map(bridge => {
    const flowPerHour = Math.round(bridgeVolumes[bridge.id]);
    const loadRatio = flowPerHour / bridge.capacityPerHour;
    // Квадратичное увеличение задержек после исчерпания пропускной способности.
    const delayMinutes = Math.min(90, Math.max(0, loadRatio - .75) * 8 + Math.max(0, loadRatio - 1) ** 2 * 30);
    return { id: bridge.id, loadRatio, delayMinutes, flowPerHour };
  });
  return { bridges, districtLoad };
}
