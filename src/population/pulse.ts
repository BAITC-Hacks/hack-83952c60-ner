import { DISTRICTS_DATA } from './data';
import { validateHour } from './migration';
import type { CitizenAgent, CityMetrics, CityPulse, DistrictAggregate, TrafficLoad } from './types';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
function finite(value: number, field: string, minimum = 0): number {
  if (!Number.isFinite(value) || value < minimum) throw new RangeError(`${field}: недопустимое число`);
  return value;
}

/** Чистый детерминированный расчёт. Частоты вызова 1–2 Гц достаточно.
 * 45% мосты (45 мин = 100), 35% школы (50% дефицита = 100),
 * 20% тепло (недогрев на 25°C = 100); районные значения взвешены населением.
 * Температура относится к подаче теплосети, не к воздуху в квартире.
 * StressIndex — инфраструктура; среднее по персонам возвращается отдельно.
 * В macro-варианте время не передаётся: state по умолчанию «Рабочий ритм». */
export function calculateCityPulse(agents: readonly CitizenAgent[], cityMetrics: CityMetrics): CityPulse;
export function calculateCityPulse(districtsData: readonly DistrictAggregate[], trafficLoad: TrafficLoad): CityPulse;
export function calculateCityPulse(
  input: readonly CitizenAgent[] | readonly DistrictAggregate[],
  metrics: CityMetrics | TrafficLoad,
): CityPulse {
  const cohortMode = 'trafficLoad' in metrics;
  const agents = cohortMode ? input as readonly CitizenAgent[] : [];
  const districts = cohortMode ? metrics.districts ?? DISTRICTS_DATA : input as readonly DistrictAggregate[];
  const trafficLoad = cohortMode ? metrics.trafficLoad : metrics;
  const hour = cohortMode ? metrics.hour : 12;
  validateHour(hour);
  const seen = new Set<string>();
  for (const district of districts) {
    if (seen.has(district.id)) throw new RangeError('Район в агрегатах повторён');
    seen.add(district.id);
    finite(district.population, 'population'); finite(district.schoolDemand, 'schoolDemand'); finite(district.schoolPlaces, 'schoolPlaces');
    finite(district.heatSupplyC, 'heatSupplyC', -273.15); finite(district.heatTargetC, 'heatTargetC', -273.15);
  }
  const samples = new Map<string, { count: number; sum: number }>();
  let agentSum = 0;
  for (const agent of agents) {
    finite(agent.stress, 'stress');
    if (agent.stress > 100) throw new RangeError('stress не может превышать 100');
    if (!seen.has(agent.homeDistrict)) throw new RangeError('Домашний район персоны отсутствует в агрегатах');
    const sample = samples.get(agent.homeDistrict) ?? { count: 0, sum: 0 };
    sample.count++; sample.sum += agent.stress; samples.set(agent.homeDistrict, sample); agentSum += agent.stress;
  }
  const bridgeIds = new Set<string>();
  for (const bridge of trafficLoad.bridges) {
    if (bridgeIds.has(bridge.id)) throw new RangeError('Мост в метриках повторён');
    bridgeIds.add(bridge.id);
    finite(bridge.delayMinutes, 'delayMinutes'); finite(bridge.flowPerHour, 'flowPerHour'); finite(bridge.loadRatio, 'loadRatio');
  }
  for (const value of Object.values(trafficLoad.districtLoad)) if (value !== undefined) finite(value, 'districtLoad');
  const bridgeVolume = trafficLoad.bridges.reduce((sum, bridge) => sum + bridge.flowPerHour, 0);
  // При нулевом потоке задержки относятся к пустой сети и не добавляют стресс.
  const bridgeStress = bridgeVolume > 0 ? trafficLoad.bridges.reduce((sum, bridge) => sum + clamp01(bridge.delayMinutes / 45) * bridge.flowPerHour, 0) / bridgeVolume * 100 : 0;
  let population = 0, schools = 0, heating = 0, weightedAgentSum = 0, sampledPopulation = 0;
  const districtPulses = districts.map(district => {
    const schoolStress = district.schoolDemand > 0 ? clamp01((district.schoolDemand - district.schoolPlaces) / district.schoolDemand / .5) * 100 : 0;
    const heatStress = clamp01((district.heatTargetC - district.heatSupplyC) / 25) * 100;
    const sample = samples.get(district.id);
    const averageStress = sample ? sample.sum / sample.count : null;
    population += district.population; schools += schoolStress * district.population; heating += heatStress * district.population;
    if (sample) { weightedAgentSum += averageStress! * district.population; sampledPopulation += district.population; }
    return { districtId: district.id, population: district.population, sampledAgents: sample?.count ?? 0, averageStress, infrastructureStress: .45 * bridgeStress + .35 * schoolStress + .20 * heatStress };
  });
  const components = { bridges: population > 0 ? bridgeStress : 0, schools: population > 0 ? schools / population : 0, heating: population > 0 ? heating / population : 0 };
  // Целочисленный индекс делает границы 0–30 / 31–70 / 71–100 однозначными.
  const stressIndex = Math.round(.45 * components.bridges + .35 * components.schools + .20 * components.heating);
  const color = stressIndex <= 30 ? 'green' : stressIndex <= 70 ? 'yellow' : 'red';
  const status = color === 'green' ? 'Город дышит спокойно' : color === 'yellow' ? 'Повышенное напряжение' : 'Инфраструктурный инфаркт';
  const congested = trafficLoad.bridges.some(bridge => bridge.flowPerHour > 0 && (bridge.delayMinutes >= 10 || bridge.loadRatio > 1)) || Object.values(trafficLoad.districtLoad).some(value => (value ?? 0) > 1);
  let state: CityPulse['state'] = 'Рабочий ритм';
  if (hour < 6 || hour >= 23) state = 'Город спит';
  else if (hour >= 6 && hour < 10 && congested) state = 'Утренний коллапс';
  else if (hour >= 16 && hour < 20) state = 'Вечерний час пик';
  return {
    stressIndex, averageAgentStress: agents.length ? agentSum / agents.length : null,
    // Если некоторые районы не имеют наблюдений, знаменатель — только население
    // представленных районов. Нулевой стресс за отсутствующую выборку не выдумывается.
    populationWeightedAgentStress: sampledPopulation > 0 ? weightedAgentSum / sampledPopulation : null,
    status, color, pulsing: color === 'red', state, components, districts: districtPulses,
  };
}
