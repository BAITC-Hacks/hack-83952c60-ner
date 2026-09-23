import { describe, expect, it } from 'vitest';
import { AGENT_COUNT, createTraffic, sampleAgent, sampleTrafficAgent, SCENARIO_METRICS, ScenarioId, signalGreen, stepTraffic, transitWeight, XYZ } from '../src/transport/simulation';

const scenarios: ScenarioId[] = ['baseline', 'interchange', 'transit', 'signals'];
const settle = (model: ReturnType<typeof createTraffic>, scenario: ScenarioId) => {
  for (let i = 0; i < 120; i++) stepTraffic(model, 1 / 60, scenario);
};

describe('transport agent model', () => {
  it('starts with a reproducible rush-hour queue and exactly 40% eligible for diversion', () => {
    const model = createTraffic();
    expect(model.agents).toHaveLength(420);
    expect(model).toEqual(createTraffic());
    expect(model.agents.filter(a => a.diverted)).toHaveLength(168);
    expect(model.agents.filter(a => a.transit)).toHaveLength(84);
    expect(model.agents.filter(a => a.converts)).toHaveLength(84);
    expect(model.occupancy[1]).toBeGreaterThan(24);
    expect(model.congestion[1]).toBe(1);
  });

  it('slows a queued agent to 10% of its free-flow speed', () => {
    const model = createTraffic();
    const position: XYZ = [0, 0, 0];
    const agent = model.agents.find(a => a.bridge === 1 && Math.abs(sampleAgent(a, a.progress, 0, position)[0]) < 17)!;
    const before = agent.progress;
    stepTraffic(model, .01, 'baseline');
    expect(agent.progress - before).toBeCloseTo(.01 * agent.speed * .1 / agent.length, 9);
  });

  it('clears the bottleneck in two seconds and supports reversing mid-transition', () => {
    const model = createTraffic();
    settle(model, 'interchange');
    expect(model.blend).toBeCloseTo(1);
    expect(model.congestion.every(n => n < .001)).toBe(true);
    for (let i = 0; i < 60; i++) stepTraffic(model, 1 / 60, 'baseline');
    expect(model.blend).toBeCloseTo(.5);
    stepTraffic(model, 0, 'interchange');
    expect(model.blend).toBeCloseTo(.5);
    stepTraffic(model, .2, 'interchange');
    expect(model.blend).toBeGreaterThan(.5);
    settle(model, 'baseline');
    expect(model.blend).toBe(0);
  });

  it('keeps all agents finite and circulating across long runs and repeated toggles', () => {
    const model = createTraffic(), position: XYZ = [0, 0, 0];
    let valid = true;
    // Four simulated minutes, without hundreds of thousands of assertion allocations.
    for (let frame = 0; frame < 2400; frame++) {
      stepTraffic(model, .1, scenarios[Math.floor(frame / 200) % scenarios.length]);
      if (frame % 10 === 0) for (const a of model.agents) {
        valid &&= a.progress >= 0 && a.progress < 1
          && sampleTrafficAgent(a, a.progress, model, position).every(Number.isFinite);
      }
    }
    expect(valid).toBe(true);
    expect(model.agents).toHaveLength(AGENT_COUNT);
    expect(model.completed).toBeGreaterThan(AGENT_COUNT);
  });

  it('raises diverted agents onto the same flyover without changing their route progress', () => {
    const model = createTraffic();
    const agent = model.agents.find(a => a.diverted && a.bridge === 1)!;
    const progress = (agent.lengths[2] + 26) / agent.length;
    const before = sampleAgent(agent, progress, 0, [0, 0, 0]);
    const after = sampleAgent(agent, progress, 1, [0, 0, 0]);
    expect(before[0]).toBeCloseTo(after[0]);
    expect(after[1] - before[1]).toBeCloseTo(5.8);
    expect(after[2] - before[2]).toBeCloseTo(-6);
  });

  it.each(scenarios)('reaches the %s synthetic targets and matching transit share', scenario => {
    const model = createTraffic(), agents = [...model.agents];
    settle(model, scenario);
    expect(model.metrics).toEqual(SCENARIO_METRICS[scenario]);
    expect(model.transitioning).toBe(false);
    expect(model.agents.every((agent, index) => agent === agents[index])).toBe(true);
    const share = model.agents.reduce((sum, agent) => sum + transitWeight(agent, model), 0) / AGENT_COUNT * 100;
    expect(share).toBeCloseTo(model.metrics.transitShare);
  });

  it('keeps both new scenarios on existing roads and assigns a visible dedicated transit lane', () => {
    const model = createTraffic(), agent = model.agents.find(a => a.transit && a.bridge === 1)!;
    const progress = (agent.lengths[2] + 26) / agent.length;
    const base = sampleTrafficAgent(agent, progress, model, [0, 0, 0]);
    settle(model, 'transit');
    const transit = sampleTrafficAgent(agent, progress, model, [0, 0, 0]);
    expect(transit[1]).toBeCloseTo(.42);
    expect(Math.abs(transit[2] - base[2])).toBeCloseTo(.4);
    expect(model.blend).toBe(0);
    settle(model, 'signals');
    expect(sampleTrafficAgent(agent, progress, model, [0, 0, 0])).toEqual(base);
    expect(model.blend).toBe(0);
  });

  it('gives public transport priority over cars in the dedicated-lane scenario', () => {
    const model = createTraffic(), point: XYZ = [0, 0, 0];
    settle(model, 'transit');
    const onCentralBridge = (a: (typeof model.agents)[number]) => a.bridge === 1 && Math.abs(sampleTrafficAgent(a, a.progress, model, point)[0]) < 17;
    const bus = model.agents.find(a => transitWeight(a, model) === 1 && onCentralBridge(a))!;
    const car = model.agents.find(a => transitWeight(a, model) === 0 && onCentralBridge(a))!;
    const beforeBus = bus.progress, beforeCar = car.progress;
    stepTraffic(model, .01, 'transit');
    const busRate = (bus.progress - beforeBus) * bus.length / bus.speed;
    const carRate = (car.progress - beforeCar) * car.length / car.speed;
    expect(busRate).toBeGreaterThan(carRate * 1.3);
  });

  it('slows approaches during a red phase and offsets junctions into a green wave', () => {
    expect(signalGreen(0, 0)).toBe(true);
    expect(signalGreen(5, 0)).toBe(false);
    expect(signalGreen(0, 1)).toBe(false);
    const rateAt = (elapsed: number) => {
      const model = createTraffic(); settle(model, 'signals'); model.elapsed = elapsed;
      const agent = model.agents.find(a => a.bridge === 0 && a.id % 2 === 0)!;
      agent.progress = (agent.lengths[2] + 47.5) / agent.length;
      const before = agent.progress;
      stepTraffic(model, .01, 'signals');
      return agent.progress - before;
    };
    expect(rateAt(5) / rateAt(0)).toBeCloseTo(.35);
  });

  it('preserves positions and metrics when changing a target midway through a transition', () => {
    const model = createTraffic();
    stepTraffic(model, 1, 'interchange');
    expect(model.transitioning).toBe(true);
    expect(model.metrics.speed).toBe(28);
    const metrics = { ...model.metrics };
    const positions = model.agents.map(a => sampleTrafficAgent(a, a.progress, model, [0, 0, 0]));
    stepTraffic(model, 0, 'transit');
    expect(model.metrics).toEqual(metrics);
    expect(model.agents.map(a => sampleTrafficAgent(a, a.progress, model, [0, 0, 0]))).toEqual(positions);
    settle(model, 'transit');
    expect(model.metrics).toEqual(SCENARIO_METRICS.transit);
    expect(model.weights).toEqual({ baseline: 0, interchange: 0, transit: 1, signals: 0 });
  });

  it('freezes when time does not advance and resets to the deterministic baseline', () => {
    const model = createTraffic();
    stepTraffic(model, .7, 'signals');
    // Refresh the instantaneous occupancy after the last movement step.
    stepTraffic(model, 0, 'signals');
    const snapshot = structuredClone(model);
    stepTraffic(model, 0, 'signals');
    expect(model).toEqual(snapshot);
    const reset = createTraffic();
    expect(reset).toEqual(createTraffic());
    expect(reset.metrics).toEqual(SCENARIO_METRICS.baseline);
    expect(reset.transitioning).toBe(false);
  });

  it('changes the actual simulated throughput for each intervention', () => {
    const completed = scenarios.map(scenario => {
      const model = createTraffic();
      for (let frame = 0; frame < 1200; frame++) stepTraffic(model, .1, scenario);
      return model.completed;
    });
    expect(new Set(completed).size).toBe(4);
    expect(completed.slice(1).every(count => count > completed[0])).toBe(true);
  });
});
