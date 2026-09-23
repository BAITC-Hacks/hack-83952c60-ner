// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PopulationCanvas } from '../src/population/PopulationCanvas';
import type { ParticleSwarmOptions, SwarmDiagnostics } from '../src/population/ParticleSwarm';
import type { MigrationFlow, TrafficLoad } from '../src/population/types';

const renderer = vi.hoisted(() => ({ construct: vi.fn(), start: vi.fn(), destroy: vi.fn(), setTrafficLoad: vi.fn() }));
vi.mock('../src/population/ParticleSwarm', () => ({
  ParticleSwarm: class {
    constructor(canvas: HTMLCanvasElement, options: ParticleSwarmOptions) { renderer.construct(canvas, options); }
    start = renderer.start;
    destroy = renderer.destroy;
    setTrafficLoad = renderer.setTrafficLoad;
  },
}));

const flows: MigrationFlow[] = [
  { from: 'nura', to: 'esil', purpose: 'school', mode: 'school', residents: 2000, particles: 2 },
  { from: 'esil', to: 'nura', purpose: 'work', mode: 'car', residents: 1000, particles: 1 },
];
const clear: TrafficLoad = { bridges: [], districtLoad: {} };

beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

describe('PopulationCanvas lifecycle', () => {
  it('preserves the running engine across fresh equivalent 1Hz snapshots and changed traffic', () => {
    const before = vi.fn();
    const after = vi.fn();
    const view = render(<PopulationCanvas flows={flows} trafficLoad={clear} onDiagnostics={before} />);
    const nextTraffic: TrafficLoad = { bridges: [], districtLoad: { nura: 1.6 } };
    const freshFlows = flows.map(flow => ({ ...flow })).reverse();
    view.rerender(<PopulationCanvas flows={freshFlows} trafficLoad={nextTraffic} onDiagnostics={after} />);
    expect(renderer.construct).toHaveBeenCalledTimes(1);
    expect(renderer.start).toHaveBeenCalledTimes(1);
    expect(renderer.destroy).not.toHaveBeenCalled();
    expect(renderer.setTrafficLoad).toHaveBeenLastCalledWith(nextTraffic);
    // A stable engine invokes the newest callback without recreating RAF/observers.
    const options = renderer.construct.mock.calls[0][1] as ParticleSwarmOptions;
    const diagnostic: SwarmDiagnostics = { particles: 3, representedPopulation: 3000, fps: 60, frameCostMs: 1, congestedParticles: 1, dpr: 1, reducedMotion: false };
    options.onDiagnostics?.(diagnostic);
    expect(before).not.toHaveBeenCalled();
    expect(after).toHaveBeenCalledWith(diagnostic);
    view.unmount();
    expect(renderer.destroy).toHaveBeenCalledTimes(1);
  });

  it('replaces and disposes the engine when represented flows actually change', () => {
    const view = render(<PopulationCanvas flows={flows} trafficLoad={clear} />);
    const changed = flows.map((flow, index) => index ? flow : { ...flow, particles: 3, residents: 3000 });
    view.rerender(<PopulationCanvas flows={changed} trafficLoad={clear} />);
    expect(renderer.construct).toHaveBeenCalledTimes(2);
    expect(renderer.start).toHaveBeenCalledTimes(2);
    expect(renderer.destroy).toHaveBeenCalledTimes(1);
    expect((renderer.construct.mock.calls[1][1] as ParticleSwarmOptions).flows).toBe(changed);
    view.unmount();
    expect(renderer.destroy).toHaveBeenCalledTimes(2);
  });
});
