import { describe, expect, it } from 'vitest';
import { AGENT_COUNT, createTraffic, sampleAgent, smooth, stepTraffic, XYZ } from '../src/transport/simulation';

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
    stepTraffic(model, .01, false);
    expect(agent.progress - before).toBeCloseTo(.01 * agent.speed * .1 / agent.length, 9);
  });

  it('clears the bottleneck in two seconds and supports reversing mid-transition', () => {
    const model = createTraffic();
    for (let i = 0; i < 120; i++) stepTraffic(model, 1 / 60, true);
    expect(model.blend).toBeCloseTo(1);
    expect(model.congestion.every(n => n < .001)).toBe(true);
    for (let i = 0; i < 60; i++) stepTraffic(model, 1 / 60, false);
    expect(smooth(model.blend)).toBeCloseTo(.5);
    stepTraffic(model, .2, true);
    expect(model.blend).toBeCloseTo(.6);
    for (let i = 0; i < 120; i++) stepTraffic(model, 1 / 60, false);
    expect(model.blend).toBe(0);
  });

  it('keeps all agents finite and circulating across long runs and repeated toggles', () => {
    const model = createTraffic(), position: XYZ = [0, 0, 0];
    let valid = true;
    // Four simulated minutes, without hundreds of thousands of assertion allocations.
    for (let frame = 0; frame < 2400; frame++) {
      stepTraffic(model, .1, Math.floor(frame / 200) % 2 === 1);
      if (frame % 10 === 0) for (const a of model.agents) {
        valid &&= a.progress >= 0 && a.progress < 1
          && sampleAgent(a, a.progress, smooth(model.blend), position).every(Number.isFinite);
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
});
