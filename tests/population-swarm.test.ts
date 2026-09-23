import { describe, expect, it } from 'vitest';
import { ParticleSimulation } from '../src/population/ParticleSwarm';
import { buildSwarmRoute, writeRoutePosition } from '../src/population/swarmGeometry';
import { BRIDGES, DISTRICTS_DATA, PARTICLE_COUNT } from '../src/population/data';
import { selectBridge } from '../src/population/migration';
import type { MigrationFlow, TrafficLoad } from '../src/population/types';

const clear: TrafficLoad = { bridges: [], districtLoad: {} };
const crossing: MigrationFlow = {
  from: 'esil', to: 'saryarka', purpose: 'work', mode: 'car',
  residents: 1000, particles: 1,
};

describe('population swarm geometry and fixed-size update kernel', () => {
  it('preserves particle count and buffers through traffic changes and long updates', () => {
    const sim = new ParticleSimulation({ trafficLoad: clear });
    const positions = sim.positions;
    const phase = sim.phase;
    expect(sim.particles).toHaveLength(PARTICLE_COUNT);
    for (let i = 0; i < 300; i++) sim.step(1 / 60);
    sim.setTrafficLoad({ bridges: BRIDGES.map(b => ({ id: b.id, loadRatio: 2, delayMinutes: 30, flowPerHour: 100000 })), districtLoad: { nura: 1.5 } });
    for (let i = 0; i < 300; i++) sim.step(1 / 60);
    expect(sim.positions).toBe(positions);
    expect(sim.phase).toBe(phase);
    expect(sim.particles).toHaveLength(PARTICLE_COUNT);
    expect(Array.from(sim.positions).every(Number.isFinite)).toBe(true);
  });

  it('crosses the river exactly on a bridge and keeps same-bank routes on their bank', () => {
    const route = buildSwarmRoute(crossing, DISTRICTS_DATA, BRIDGES);
    expect(route.bridgeId).toBe(selectBridge(crossing.from, crossing.to));
    const bridge = BRIDGES.find(b => b.id === route.bridgeId)!;
    const point = new Float32Array(2);
    writeRoutePosition(route, (route.bridgeStart + route.bridgeEnd) / 2, point);
    expect(point[0]).toBeCloseTo((bridge.left[0] + bridge.right[0]) / 2, 4);
    expect(point[1]).toBeCloseTo((bridge.left[1] + bridge.right[1]) / 2, 4);
    const sameBank = buildSwarmRoute({ from: 'esil', to: 'nura' }, DISTRICTS_DATA, BRIDGES);
    expect(Array.from(sameBank.y).every(y => y > 0.5)).toBe(true);
    const riverSamples = Array.from(route.y).map((y, i) => ({ y, x: route.x[i] })).filter(p => Math.abs(p.y - 0.5) < 0.01);
    for (const sample of riverSamples) {
      const t = (sample.y - bridge.left[1]) / (bridge.right[1] - bridge.left[1]);
      expect(sample.x).toBeCloseTo(bridge.left[0] + t * (bridge.right[0] - bridge.left[0]), 4);
    }
  });

  it('slows exactly to 15% only in bridge bottlenecks, with strict Nura threshold', () => {
    const sim = new ParticleSimulation({ flows: [crossing], trafficLoad: clear });
    const route = sim.routes[0];
    sim.phase[0] = (route.bridgeStart + route.bridgeEnd) / 2;
    sim.setTrafficLoad({ bridges: [{ id: route.bridgeId!, loadRatio: 1.1, delayMinutes: 20, flowPerHour: 10 }], districtLoad: {} });
    sim.step(1 / 60);
    expect(sim.speedRatio[0]).toBeCloseTo(0.15, 6);
    expect(sim.jammed[0]).toBe(1);
    sim.phase[0] = route.bridgeStart * 0.1;
    sim.step(1 / 60);
    expect(sim.speedRatio[0]).toBe(1);
    expect(sim.jammed[0]).toBe(0);
    const nura = new ParticleSimulation({ flows: [{ ...crossing, from: 'nura', to: 'esil' }], trafficLoad: clear });
    nura.setTrafficLoad({ bridges: [], districtLoad: { nura: 1.4 } });
    expect(nura.bottleneckMultiplier(0, 0.001)).toBe(1);
    nura.setTrafficLoad({ bridges: [], districtLoad: { nura: 1.401 } });
    expect(nura.bottleneckMultiplier(0, 0.001)).toBe(0.15);
    expect(nura.bottleneckMultiplier(0, nura.routes[0].length * 0.6)).toBe(1);
  });

  it('accumulates a queue without overtaking or coincident phases', () => {
    const sim = new ParticleSimulation({ flows: [{ ...crossing, particles: 120, residents: 120000 }], speed: 0.07, trafficLoad: clear });
    const route = sim.routes[0];
    const minGap = () => Math.min(...Array.from(sim.phase, (p, i) => {
      const gap = sim.phase[(i + 1) % sim.phase.length] - p;
      return gap > 0 ? gap : gap + route.cycleLength;
    }));
    const initialGap = minGap();
    sim.setTrafficLoad({ bridges: [{ id: route.bridgeId!, loadRatio: 1.8, delayMinutes: 30, flowPerHour: 10 }], districtLoad: {} });
    for (let i = 0; i < 1800; i++) sim.step(1 / 60);
    expect(minGap()).toBeGreaterThan(Math.min(0.003, route.cycleLength / 120 * 0.45) - 0.000001);
    expect(minGap()).toBeLessThan(initialGap * 0.6);
    expect(Array.from(sim.jammed).filter(Boolean).length).toBeGreaterThan(1);
  });

  it('moves in the matrix direction, recycles finite phases and clamps suspended-tab delta', () => {
    const route = buildSwarmRoute(crossing, DISTRICTS_DATA, BRIDGES);
    const a = new Float32Array(2);
    const b = new Float32Array(2);
    writeRoutePosition(route, route.length * 0.25, a);
    writeRoutePosition(route, route.length * 0.75, b);
    expect(b[1]).toBeLessThan(a[1]); // Esil→Saryarka always heads toward the right bank.
    const reverse = buildSwarmRoute({ ...crossing, from: 'saryarka', to: 'esil' }, DISTRICTS_DATA, BRIDGES);
    writeRoutePosition(reverse, reverse.length * 0.25, a);
    writeRoutePosition(reverse, reverse.length * 0.75, b);
    expect(b[1]).toBeGreaterThan(a[1]);
    writeRoutePosition(route, route.length + 0.00001, a);
    writeRoutePosition(route, 0.00001, b);
    expect(Array.from(a)).toEqual(Array.from(b));
    const local = buildSwarmRoute({ from: 'nura', to: 'nura' }, DISTRICTS_DATA, BRIDGES);
    writeRoutePosition(local, local.length - 0.00001, a);
    writeRoutePosition(local, 0.00001, b);
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(0.0001);
    const sim = new ParticleSimulation({ flows: [crossing], trafficLoad: clear, speed: 0.03 });
    const before = sim.phase[0];
    sim.step(100);
    expect(sim.phase[0] - before).toBeCloseTo(0.03 * 0.05, 8);
  });

  it('rejects flow counts that break the 1:1000 representation contract', () => {
    expect(() => new ParticleSimulation({ flows: [{ ...crossing, residents: 999 }] })).toThrow('exactly 1000');
    expect(() => new ParticleSimulation({ flows: [{ ...crossing, particles: -1 }] })).toThrow('nonnegative integer');
    expect(() => buildSwarmRoute({ from: 'nura', to: 'esil', bridgeId: BRIDGES[0].id }, DISTRICTS_DATA, BRIDGES)).toThrow('Same-bank');
    expect(() => buildSwarmRoute({ ...crossing, bridgeId: 'missing' }, DISTRICTS_DATA, BRIDGES)).toThrow('valid bridge');
  });
});
