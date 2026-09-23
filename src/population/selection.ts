import type { AkimDecision, CitizenAgent, DistrictId } from './types';

export const POPULATION_DISTRICT_IDS: readonly DistrictId[] = [
  'saryarka', 'baikonur', 'almaty', 'saraishyk', 'esil', 'nura',
];

/** Eligibility is deterministic. Randomness only chooses among directly affected people. */
export function isDirectlyAffected(agent: CitizenAgent, decision: AkimDecision): boolean {
  if (!agent.interests.includes(decision.topic)) return false;
  const inDistrict = (id: DistrictId) => decision.districtIds.includes(id);
  const bridgeScoped = (decision.bridgeIds?.length ?? 0) > 0;
  const usesBridge = (routes: CitizenAgent['routes']) => !bridgeScoped || routes.some(
    route => route.bridgeId !== undefined && decision.bridgeIds!.includes(route.bridgeId),
  );

  if (decision.topic === 'schools') {
    // A parent working in Nura is not automatically a user of Nura's schools.
    const schoolRoutes = agent.routes.filter(route => route.purpose === 'school');
    return agent.hasChildren && agent.childrenAges.some(age => age >= 6 && age <= 17)
      && (inDistrict(agent.homeDistrict) || schoolRoutes.some(route => inDistrict(route.to)))
      && usesBridge(schoolRoutes);
  }

  if (decision.topic === 'transport') {
    return (inDistrict(agent.homeDistrict) || inDistrict(agent.workDistrict)
      || agent.routes.some(route => inDistrict(route.from) || inDistrict(route.to)))
      && usesBridge(agent.routes);
  }

  // Heating/gas affect the home; services/leisure also affect their actual destinations.
  const relevantRoutes = agent.routes.filter(route => decision.topic === 'services'
    ? route.purpose === 'market' : decision.topic === 'leisure' && route.purpose === 'leisure');
  return (inDistrict(agent.homeDistrict) || relevantRoutes.some(route => inDistrict(route.to)))
    && usesBridge(agent.routes);
}

export function selectAffectedAgents(
  agents: readonly CitizenAgent[],
  decision: AkimDecision,
  options: { min?: number; max?: number; random?: () => number } = {},
): CitizenAgent[] {
  const min = Math.max(1, Math.min(5, Math.floor(options.min ?? 3)));
  const max = Math.max(min, Math.min(5, Math.floor(options.max ?? 5)));
  const random = options.random ?? Math.random;
  const draw = () => {
    const value = random();
    return Number.isFinite(value) ? Math.min(1 - Number.EPSILON, Math.max(0, value)) : 0;
  };
  const seen = new Set<string>();
  const pool = agents.filter(agent => {
    if (seen.has(agent.id) || !isDirectlyAffected(agent, decision)) return false;
    seen.add(agent.id);
    return true;
  });
  // Fisher–Yates: no replacement, including when the eligible population is small.
  for (let index = pool.length - 1; index > 0; index--) {
    const swap = Math.floor(draw() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  const count = Math.min(pool.length, min + Math.floor(draw() * (max - min + 1)));
  return pool.slice(0, count); // Never pad the batch with unrelated residents.
}
