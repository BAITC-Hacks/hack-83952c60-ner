import { generateAgents } from './agents';
import { DISTRICTS_DATA, POPULATION_SCALE } from './data';
import { createMigrationMatrix, estimateTrafficLoad } from './migration';
import { calculateCityPulse } from './pulse';
import type { CitizenAgent, CityMetrics, CityPulse, DistrictAggregate, MigrationFlow, TrafficLoad } from './types';

export interface PopulationSnapshot {
  hour: number;
  population: number;
  visualParticles: number;
  districts: readonly DistrictAggregate[];
  agents: CitizenAgent[];
  focusGroup: CitizenAgent[];
  flows: MigrationFlow[];
  trafficLoad: TrafficLoad;
  pulse: CityPulse;
}

/** Pure, slow simulation tick. Call at 1 Hz of game time, never from the render loop.
 * The LLM cannot change stress or infrastructure and is never called here.
 */
export function stepCitizens(
  agents: readonly CitizenAgent[], metrics: CityMetrics, elapsedGameSeconds: number,
): CitizenAgent[] {
  if (!Number.isFinite(elapsedGameSeconds) || elapsedGameSeconds < 0) {
    throw new RangeError('elapsedGameSeconds must be finite and nonnegative');
  }
  if (!Number.isFinite(metrics.hour) || metrics.hour < 0 || metrics.hour >= 24) {
    throw new RangeError('hour must be in [0, 24)');
  }
  const districts = metrics.districts ?? DISTRICTS_DATA;
  // Validates infrastructure and yields bounded values before any state transition.
  const infrastructure = calculateCityPulse(districts, metrics.trafficLoad);
  const districtStress = new Map(infrastructure.districts.map(d => [d.districtId, d.infrastructureStress]));
  const night = metrics.hour < 6 || metrics.hour >= 23;
  const morning = metrics.hour >= 6 && metrics.hour < 10;
  const evening = metrics.hour >= 16 && metrics.hour < 20;
  // Exponential smoothing is stable at arbitrary tick sizes: a 15-minute game-time response.
  const blend = 1 - Math.exp(-elapsedGameSeconds / 900);
  return agents.map(agent => {
    if (!Number.isFinite(agent.stress)) throw new RangeError('Agent stress must be finite');
    const base = districtStress.get(agent.homeDistrict);
    if (base === undefined) throw new RangeError(`Unknown home district: ${agent.homeDistrict}`);
    const working = agent.profession !== 'пенсионер' && agent.profession !== 'мама в декрете';
    const schoolChild = agent.childrenAges.some(age => age >= 6 && age <= 17);
    const currentAction: CitizenAgent['currentAction'] = night ? 'дома'
      : morning && schoolChild ? 'везёт детей в школу'
      : morning && working ? 'едет на работу'
      : evening && working ? 'едет домой'
      : working ? 'работает'
      : metrics.hour >= 11 && metrics.hour < 13 ? 'стоит в очереди' : 'дома';
    const target = night ? base * .35 : Math.min(100, base + (morning || evening ? 10 : 0));
    return {
      ...agent,
      currentAction,
      stress: Math.max(0, Math.min(100, agent.stress + (target - agent.stress) * blend)),
    };
  });
}

/** JSON-serializable initial snapshot. Everything is reproducible from hour + seed. */
export function createPopulationSnapshot(options: { hour?: number; seed?: number; trafficLoad?: TrafficLoad } = {}): PopulationSnapshot {
  const hour = options.hour ?? 8;
  const flows = createMigrationMatrix(hour);
  const trafficLoad = options.trafficLoad ?? estimateTrafficLoad(flows, hour);
  const metrics = { hour, trafficLoad, districts: DISTRICTS_DATA };
  const agents = stepCitizens(generateAgents(options.seed ?? 42), metrics, 0);
  return {
    hour,
    population: DISTRICTS_DATA.reduce((sum, d) => sum + d.population, 0),
    visualParticles: flows.reduce((sum, flow) => sum + flow.residents / POPULATION_SCALE, 0),
    districts: DISTRICTS_DATA,
    agents,
    focusGroup: agents.filter(agent => agent.focusGroup),
    flows,
    trafficLoad,
    pulse: calculateCityPulse(agents, metrics),
  };
}
