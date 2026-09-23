// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Layer } from '@deck.gl/core';
import type { MapLibreOverlay } from '@deck.gl/maplibre';
import { animateAtlasSwarm } from '../src/atlas/swarmLayer';
import type { AtlasSwarmParticle, AtlasSwarmSimulation } from '../src/atlas/swarm';

vi.mock('@deck.gl/layers', () => ({
  ScatterplotLayer: class {
    constructor(readonly props: Record<string, unknown>) {}
  },
}));

interface RenderedLayer {
  props: {
    id: string;
    data: AtlasSwarmParticle[];
    pickable: boolean;
    getPosition: (particle: AtlasSwarmParticle) => number[];
    updateTriggers: { getPosition: number };
  };
}

let pending: Map<number, FrameRequestCallback>;
let motion: EventTarget & { matches: boolean };
let hidden: boolean;
let nextFrame: number;
const disposers: Array<() => void> = [];

beforeEach(() => {
  pending = new Map(); nextFrame = 1; hidden = false;
  motion = Object.assign(new EventTarget(), { matches: false });
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  vi.stubGlobal('matchMedia', vi.fn(() => motion));
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    const id = nextFrame++; pending.set(id, callback); return id;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => { pending.delete(id); }));
});

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function fireFrame(now: number) {
  const entry = pending.entries().next().value;
  expect(entry).toBeDefined();
  const [id, callback] = entry!;
  pending.delete(id);
  callback(now);
}

function setup(options = { visible: true, paused: false, opacity: .85 }) {
  const particles: AtlasSwarmParticle[] = [{ position: [71.43, 51.12, 4], color: [255, 182, 46, 255] }];
  const step = vi.fn((seconds: number) => { particles[0].position[0] += seconds; });
  const swarm = { particles, step } as unknown as AtlasSwarmSimulation;
  const setProps = vi.fn();
  const baseLayers = [{ id: 'poi' }, { id: 'import' }] as unknown as Layer[];
  const dispose = animateAtlasSwarm({ setProps } as unknown as MapLibreOverlay, baseLayers, swarm, options);
  disposers.push(dispose);
  const layers = () => setProps.mock.calls.at(-1)![0].layers as Array<Layer | RenderedLayer>;
  return { particles, step, setProps, baseLayers, dispose, layers };
}

describe('atlas swarm layer lifecycle', () => {
  it('keeps the map data layers and a non-interactive static swarm when paused', () => {
    const view = setup({ visible: true, paused: true, opacity: .85 });
    expect(view.layers().slice(0, 2)).toEqual(view.baseLayers);
    expect(view.layers()[0]).toBe(view.baseLayers[0]);
    const particles = view.layers().slice(2) as RenderedLayer[];
    expect(particles).toHaveLength(2);
    expect(particles.every(layer => !layer.props.pickable)).toBe(true);
    expect(particles.every(layer => layer.props.data === view.particles)).toBe(true);
    expect(pending.size).toBe(0);
    expect(view.step).not.toHaveBeenCalled();
  });

  it('removes only the swarm when hidden and does not schedule animation', () => {
    const view = setup({ visible: false, paused: false, opacity: .85 });
    expect(view.layers()).toEqual(view.baseLayers);
    expect(pending.size).toBe(0);
    motion.dispatchEvent(new Event('change'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(pending.size).toBe(0);
    expect(view.step).not.toHaveBeenCalled();
  });

  it('uses one frame chain, throttles uploads and invalidates the stable position data', () => {
    const view = setup();
    expect(pending.size).toBe(1);
    fireFrame(100);
    fireFrame(116);
    expect(view.step).toHaveBeenCalledTimes(1);
    fireFrame(140);
    expect(view.step).toHaveBeenLastCalledWith(.04);
    expect(pending.size).toBe(1);
    const last = view.layers().at(-1) as RenderedLayer;
    expect(last.props.data).toBe(view.particles);
    expect(last.props.getPosition(view.particles[0])[0]).toBeCloseTo(71.47);
    expect(last.props.updateTriggers.getPosition).toBeGreaterThan(0);
    for (const [props] of view.setProps.mock.calls) {
      expect(props.layers[0]).toBe(view.baseLayers[0]);
      expect(props.layers[1]).toBe(view.baseLayers[1]);
    }
  });

  it('stops in a hidden tab and resumes without advancing by the time spent away', () => {
    hidden = true;
    const view = setup();
    expect(pending.size).toBe(0);
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    fireFrame(100);
    fireFrame(140);
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(pending.size).toBe(0);
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    fireFrame(120_000);
    expect(view.step).toHaveBeenLastCalledWith(0);
    expect(pending.size).toBe(1);
  });

  it('honors live reduced-motion preferences and releases listeners and pending frames', () => {
    motion.matches = true;
    const removeMotion = vi.spyOn(motion, 'removeEventListener');
    const removeVisibility = vi.spyOn(document, 'removeEventListener');
    const view = setup();
    expect(view.layers()).toHaveLength(4);
    expect(pending.size).toBe(0);
    motion.matches = false;
    motion.dispatchEvent(new Event('change'));
    expect(pending.size).toBe(1);
    fireFrame(100);
    motion.matches = true;
    motion.dispatchEvent(new Event('change'));
    expect(pending.size).toBe(0);
    motion.matches = false;
    motion.dispatchEvent(new Event('change'));
    const staleFrame = pending.values().next().value!;
    view.dispose();
    const calls = view.setProps.mock.calls.length;
    const steps = view.step.mock.calls.length;
    expect(pending.size).toBe(0);
    expect(removeMotion).toHaveBeenCalledWith('change', expect.any(Function));
    expect(removeVisibility).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    motion.dispatchEvent(new Event('change'));
    document.dispatchEvent(new Event('visibilitychange'));
    staleFrame(200);
    expect(pending.size).toBe(0);
    expect(view.setProps).toHaveBeenCalledTimes(calls);
    expect(view.step).toHaveBeenCalledTimes(steps);
  });
});
