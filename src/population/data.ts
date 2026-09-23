import type { BridgeDefinition, DistrictAggregate, DistrictId } from './types';

/** Ввод пользователя суммируется в 1 550 000: сохраняем каждый район без округления. */
export const SOURCE_POPULATION = 1_550_000;
export const TARGET_POPULATION = SOURCE_POPULATION;
export const POPULATION_SCALE = 1_000;
export const PARTICLE_COUNT = TARGET_POPULATION / POPULATION_SCALE;
export const DISTRICT_IDS: readonly DistrictId[] = ['esil', 'saryarka', 'almaty', 'baikonur', 'nura', 'saraishyk'];

/** Игровые сценарные значения, а не официальная статистика или реальные границы. */
export const DISTRICTS_DATA: readonly DistrictAggregate[] = [
  { id: 'esil', name: 'Есиль', population: 380_000, profile: 'Высокий доход, дефицит школ, избыток офисов', centroid: [0.53, 0.72], bank: 'left', schoolDemand: 66_000, schoolPlaces: 46_000, kindergartenDemand: 27_000, kindergartenPlaces: 20_000, heatSupplyC: 84, heatTargetC: 85, income: 'high' },
  { id: 'saryarka', name: 'Сарыарка', population: 340_000, profile: 'Старый фонд, школы у дома, дефицит тепла', centroid: [0.22, 0.24], bank: 'right', schoolDemand: 49_000, schoolPlaces: 48_000, kindergartenDemand: 19_000, kindergartenPlaces: 17_000, heatSupplyC: 61, heatTargetC: 85, income: 'middle' },
  { id: 'almaty', name: 'Алматы', population: 330_000, profile: 'Высокая плотность, маятниковая миграция', centroid: [0.50, 0.29], bank: 'right', schoolDemand: 53_000, schoolPlaces: 43_000, kindergartenDemand: 22_000, kindergartenPlaces: 16_000, heatSupplyC: 78, heatTargetC: 85, income: 'middle' },
  { id: 'baikonur', name: 'Байконур', population: 235_000, profile: 'Промзоны, частный сектор, зависимость от газа и АЗС', centroid: [0.81, 0.23], bank: 'right', schoolDemand: 35_000, schoolPlaces: 30_000, kindergartenDemand: 14_000, kindergartenPlaces: 10_000, heatSupplyC: 73, heatTargetC: 85, income: 'low' },
  { id: 'nura', name: 'Нура', population: 155_000, profile: 'Молодые семьи, критический дефицит школ и садов', centroid: [0.22, 0.79], bank: 'left', schoolDemand: 35_000, schoolPlaces: 14_000, kindergartenDemand: 18_000, kindergartenPlaces: 7_000, heatSupplyC: 80, heatTargetC: 85, income: 'middle' },
  { id: 'saraishyk', name: 'Сарайшык', population: 110_000, profile: 'Новостройки, нехватка базовой инфраструктуры', centroid: [0.82, 0.77], bank: 'left', schoolDemand: 22_000, schoolPlaces: 11_000, kindergartenDemand: 11_000, kindergartenPlaces: 5_000, heatSupplyC: 75, heatTargetC: 85, income: 'middle' },
];
export const RAW_DISTRICTS_DATA = DISTRICTS_DATA;

/** Условные мосты через горизонтальную реку y=.5; пропускная способность в людях/час. */
export const BRIDGES: readonly BridgeDefinition[] = [
  { id: 'west', name: 'Западный мост', left: [0.30, 0.56], right: [0.30, 0.44], capacityPerHour: 14_000 },
  { id: 'central', name: 'Центральный мост', left: [0.53, 0.56], right: [0.53, 0.44], capacityPerHour: 25_000 },
  { id: 'east', name: 'Восточный мост', left: [0.74, 0.56], right: [0.74, 0.44], capacityPerHour: 15_000 },
];

/** Детерминированный PRNG: симуляция и тесты воспроизводятся без Math.random(). */
export function createSeededRandom(seed = 42): () => number {
  if (!Number.isFinite(seed)) throw new RangeError('seed должен быть конечным числом');
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
