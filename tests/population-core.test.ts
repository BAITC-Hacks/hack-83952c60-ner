import { describe, expect, it } from 'vitest';
import { generateAgents, generateFocusGroup } from '../src/population/agents';
import { BRIDGES, DISTRICTS_DATA, DISTRICT_IDS, PARTICLE_COUNT, POPULATION_SCALE, SOURCE_POPULATION } from '../src/population/data';
import { createMigrationMatrix, estimateTrafficLoad, PURPOSE_DESTINATION_WEIGHTS, selectBridge } from '../src/population/migration';
import { calculateCityPulse } from '../src/population/pulse';
import type { DistrictAggregate, TrafficLoad } from '../src/population/types';

const quietTraffic: TrafficLoad = { bridges: [], districtLoad: {} };
function districtWithStress(stress: number): DistrictAggregate {
  return { ...DISTRICTS_DATA[0], schoolDemand: 100, schoolPlaces: 100 - stress / 2, heatTargetC: 85, heatSupplyC: 85 - stress / 4 };
}
function trafficWithStress(stress: number): TrafficLoad {
  return { bridges: [{ id: 'central', loadRatio: 1 + stress / 100, delayMinutes: stress * .45, flowPerHour: 1000 }], districtLoad: {} };
}

describe('population aggregates and finite cohorts', () => {
  it('preserves the six supplied totals and exactly 1550 visual residents groups', () => {
    expect(DISTRICTS_DATA.map(district => district.population)).toEqual([380000, 340000, 330000, 235000, 155000, 110000]);
    expect(DISTRICTS_DATA.reduce((total, district) => total + district.population, 0)).toBe(SOURCE_POPULATION);
    expect(SOURCE_POPULATION).toBe(1_550_000);
    expect(PARTICLE_COUNT * POPULATION_SCALE).toBe(SOURCE_POPULATION);
  });
  it('generates reproducible sixty agents and thirty detailed focus residents', () => {
    const agents = generateAgents(100);
    expect(agents).toHaveLength(60);
    expect(new Set(agents.map(agent => agent.id)).size).toBe(60);
    expect(generateAgents(100)).toEqual(agents);
    expect(generateAgents(101)).not.toEqual(agents);
    const focus = generateFocusGroup(100);
    expect(focus).toHaveLength(30);
    for (const district of DISTRICT_IDS) {
      expect(agents.filter(agent => agent.homeDistrict === district)).toHaveLength(10);
      expect(focus.filter(agent => agent.homeDistrict === district)).toHaveLength(5);
    }
    expect(focus.filter(agent => agent.homeDistrict === 'nura' && agent.childrenAges.some(age => age >= 6))).toHaveLength(3);
    expect(new Set(focus.map(agent => agent.profession))).toContain('владелец кофейни');
    for (const agent of agents) {
      expect(agent.stress).toBeGreaterThanOrEqual(0);
      expect(agent.stress).toBeLessThanOrEqual(100);
      expect(agent.biography.length).toBeGreaterThan(60);
      expect(agent.hasChildren).toBe(agent.childrenAges.length > 0);
    }
  });
});

describe('migration conserves representative population', () => {
  it('has four valid stochastic 6×6 destination matrices', () => {
    expect(Object.keys(PURPOSE_DESTINATION_WEIGHTS)).toHaveLength(4);
    for (const rows of Object.values(PURPOSE_DESTINATION_WEIGHTS)) {
      expect(rows).toHaveLength(6);
      for (const row of rows) {
        expect(row).toHaveLength(6);
        expect(row.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 12);
        expect(row.every(weight => weight >= 0 && weight <= 1)).toBe(true);
      }
    }
  });
  it('neither duplicates nor loses residents in morning or evening assignments', () => {
    for (const hour of [0, 8, 12, 18, 23]) {
      const flows = createMigrationMatrix(hour);
      expect(flows.reduce((sum, flow) => sum + flow.particles, 0)).toBe(PARTICLE_COUNT);
      expect(flows.reduce((sum, flow) => sum + flow.residents, 0)).toBe(SOURCE_POPULATION);
      expect(flows.every(flow => Number.isInteger(flow.particles) && flow.particles > 0 && flow.residents === flow.particles * POPULATION_SCALE)).toBe(true);
    }
    const morning = createMigrationMatrix(8);
    for (const district of DISTRICTS_DATA) expect(morning.filter(flow => flow.from === district.id).reduce((sum, flow) => sum + flow.residents, 0)).toBe(district.population);
    const evening = createMigrationMatrix(18);
    for (let i = 0; i < morning.length; i++) {
      expect(evening[i].residents).toBe(morning[i].residents);
      if (morning[i].purpose !== 'leisure') {
        expect(evening[i].from).toBe(morning[i].to);
        expect(evening[i].to).toBe(morning[i].from);
      }
    }
  });
  it('routes cross-bank flows across one of the three shared bridges', () => {
    const flows = createMigrationMatrix();
    for (const flow of flows) {
      const origin = DISTRICTS_DATA.find(district => district.id === flow.from)!;
      const destination = DISTRICTS_DATA.find(district => district.id === flow.to)!;
      if (origin.bank !== destination.bank) expect(BRIDGES.map(bridge => bridge.id)).toContain(flow.bridgeId);
      else expect(flow.bridgeId).toBeUndefined();
      expect(selectBridge(flow.from, flow.to)).toBe(selectBridge(flow.to, flow.from));
    }
  });
  it('models congestion at a rush hour without treating every resident as a simultaneous driver', () => {
    const flows = createMigrationMatrix();
    const rush = estimateTrafficLoad(flows, 8);
    const night = estimateTrafficLoad(flows, 2);
    expect(rush.districtLoad.nura).toBeGreaterThan(1.4);
    expect(rush.bridges.some(bridge => bridge.loadRatio > 1)).toBe(true);
    expect(rush.bridges.reduce((sum, bridge) => sum + bridge.flowPerHour, 0)).toBeLessThan(SOURCE_POPULATION * .2);
    expect(night.bridges.every((bridge, index) => bridge.flowPerHour < rush.bridges[index].flowPerHour)).toBe(true);
    expect(() => createMigrationMatrix(24)).toThrow(RangeError);
    expect(() => estimateTrafficLoad([{ ...flows[0], residents: NaN }])).toThrow(RangeError);
  });
  it('assigns omitted bridge IDs consistently and rejects physically inconsistent custom flows', () => {
    const crossRiver = { from: 'nura' as const, to: 'saryarka' as const, purpose: 'work' as const, mode: 'car' as const, particles: 5, residents: 5000 };
    const assignedBridge = selectBridge(crossRiver.from, crossRiver.to)!;
    const inferred = estimateTrafficLoad([crossRiver], 8);
    expect(inferred).toEqual(estimateTrafficLoad([{ ...crossRiver, bridgeId: assignedBridge }], 8));
    expect(inferred.bridges.find(bridge => bridge.id === assignedBridge)?.flowPerHour).toBe(900);
    expect(inferred.bridges.filter(bridge => bridge.id !== assignedBridge).every(bridge => bridge.flowPerHour === 0)).toBe(true);
    expect(() => estimateTrafficLoad([{ ...crossRiver, to: 'esil', bridgeId: assignedBridge }])).toThrow(RangeError);
    expect(() => estimateTrafficLoad([{ ...crossRiver, bridgeId: '__proto__' }])).toThrow(RangeError);
    expect(() => estimateTrafficLoad([{ ...crossRiver, residents: 4999 }])).toThrow(RangeError);
    expect(() => estimateTrafficLoad([{ ...crossRiver, particles: .5, residents: 500 }])).toThrow(RangeError);
  });
});

describe('pure city pulse', () => {
  it.each([[0, 'green'], [30, 'green'], [31, 'yellow'], [70, 'yellow'], [71, 'red'], [100, 'red']] as const)('applies exact status boundary %i', (stress, color) => {
    const result = calculateCityPulse([districtWithStress(stress)], trafficWithStress(stress));
    expect(result.stressIndex).toBe(stress);
    expect(result.color).toBe(color);
    expect(result.pulsing).toBe(color === 'red');
    expect(result.averageAgentStress).toBeNull();
  });
  it('weights district means by inhabitants, not the ten-person quota', () => {
    const agents = generateAgents().filter(agent => agent.homeDistrict === 'esil' || agent.homeDistrict === 'nura').map(agent => ({ ...agent, stress: agent.homeDistrict === 'esil' ? 0 : 100 }));
    const result = calculateCityPulse(agents, { hour: 12, trafficLoad: quietTraffic });
    expect(result.averageAgentStress).toBe(50);
    expect(result.populationWeightedAgentStress).toBeCloseTo(100 * 155000 / (380000 + 155000), 10);
    expect(result.districts.find(district => district.districtId === 'almaty')?.averageStress).toBeNull();
    expect(result.districts.find(district => district.districtId === 'nura')?.averageStress).toBe(100);
  });
  it('weights infrastructure deficits by population and caps severe deficits', () => {
    const calm = { ...districtWithStress(0), population: 300 };
    const stressed = { ...districtWithStress(100), id: 'nura' as const, population: 100, heatSupplyC: -100 };
    const result = calculateCityPulse([calm, stressed], quietTraffic);
    expect(result.components.schools).toBe(25);
    expect(result.components.heating).toBe(25);
    expect(result.stressIndex).toBe(14);
  });
  it('derives the city phase from local game time and actual morning congestion', () => {
    const phase = (hour: number, trafficLoad = trafficWithStress(80)) => calculateCityPulse([], { hour, trafficLoad }).state;
    expect(phase(2)).toBe('Город спит');
    expect(phase(23)).toBe('Город спит');
    expect(phase(8)).toBe('Утренний коллапс');
    expect(phase(8, quietTraffic)).toBe('Рабочий ритм');
    expect(phase(13)).toBe('Рабочий ритм');
    expect(phase(18)).toBe('Вечерний час пик');
  });
  it('handles empty/missing samples, zero school demand, and invalid numerics explicitly', () => {
    expect(calculateCityPulse([], quietTraffic).stressIndex).toBe(0);
    const zero = { ...districtWithStress(0), schoolDemand: 0, schoolPlaces: 10 };
    expect(calculateCityPulse([zero], quietTraffic).stressIndex).toBe(0);
    expect(calculateCityPulse([], { hour: 8, trafficLoad: quietTraffic }).averageAgentStress).toBeNull();
    expect(() => calculateCityPulse([{ ...zero, population: NaN }], quietTraffic)).toThrow(RangeError);
    expect(() => calculateCityPulse(generateAgents(), { hour: Infinity, trafficLoad: quietTraffic })).toThrow(RangeError);
    expect(() => calculateCityPulse([{ ...generateAgents()[0], stress: 101 }], { hour: 8, trafficLoad: quietTraffic })).toThrow(RangeError);
    expect(() => calculateCityPulse([zero, zero], quietTraffic)).toThrow(RangeError);
  });
  it('does not mutate JSON inputs and returns identical values for the same state', () => {
    const agents = generateAgents();
    const metrics = { hour: 8, trafficLoad: estimateTrafficLoad(createMigrationMatrix()) };
    const before = JSON.stringify({ agents, metrics });
    expect(calculateCityPulse(agents, metrics)).toEqual(calculateCityPulse(agents, metrics));
    expect(JSON.stringify({ agents, metrics })).toBe(before);
  });
});
