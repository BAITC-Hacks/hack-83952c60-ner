import { BRIDGES, DISTRICTS_DATA, POPULATION_SCALE } from './data';
import { createMigrationMatrix, estimateTrafficLoad, selectBridge } from './migration';
import { buildSwarmRoute, writeRoutePosition } from './swarmGeometry';
import type { SwarmRoute } from './swarmGeometry';
import type { BridgeDefinition, DistrictAggregate, MigrationFlow, TrafficLoad, TransportMode } from './types';

export interface Particle {
  readonly id: number;
  readonly routeIndex: number;
  readonly mode: TransportMode;
  readonly representedResidents: number;
}

interface RouteState {
  geometry: SwarmRoute;
  start: number;
  count: number;
  headway: number;
  bridgeCongested: boolean;
  nuraCongested: boolean;
}

export interface SwarmOptions {
  flows?: readonly MigrationFlow[];
  districts?: readonly DistrictAggregate[];
  bridges?: readonly BridgeDefinition[];
  trafficLoad?: TrafficLoad;
  /** Schematic coordinate units per second, independent of resolution and FPS. */
  speed?: number;
  /** Minimum distance along a route; queues form when leaders slow down. */
  headway?: number;
}

/** Headless O(N) update kernel. All frame-mutated buffers have fixed size. */
export class ParticleSimulation {
  readonly particles: readonly Particle[];
  readonly routes: readonly SwarmRoute[];
  readonly positions: Float32Array;
  readonly phase: Float64Array;
  readonly speedRatio: Float32Array;
  readonly jammed: Uint8Array;
  private readonly routeStates: RouteState[];
  private readonly advances: Float64Array;
  private readonly baseSpeed: number;

  constructor(options: SwarmOptions = {}) {
    const districts = options.districts ?? DISTRICTS_DATA;
    const bridges = options.bridges ?? BRIDGES;
    const flows = options.flows ?? createMigrationMatrix();
    this.baseSpeed = options.speed ?? 0.027;
    if (!Number.isFinite(this.baseSpeed) || this.baseSpeed <= 0) throw new Error('speed must be positive');
    const desiredHeadway = options.headway ?? 0.003;
    if (!Number.isFinite(desiredHeadway) || desiredHeadway <= 0) throw new Error('headway must be positive');

    const grouped = new Map<string, { geometry: SwarmRoute; flows: MigrationFlow[] }>();
    for (const flow of flows) {
      if (!Number.isSafeInteger(flow.particles) || flow.particles < 0) throw new Error('particles must be a nonnegative integer');
      if (flow.residents !== flow.particles * POPULATION_SCALE) throw new Error(`Each particle must represent exactly ${POPULATION_SCALE} residents`);
      if (!flow.particles) continue;
      const bridgeId = flow.bridgeId ?? selectBridge(flow.from, flow.to, districts, bridges);
      const key = `${flow.from}:${flow.to}:${bridgeId ?? ''}`;
      let group = grouped.get(key);
      if (!group) {
        group = { geometry: buildSwarmRoute({ ...flow, bridgeId }, districts, bridges), flows: [] };
        grouped.set(key, group);
      }
      group.flows.push(flow);
    }
    const particles: Particle[] = [];
    this.routeStates = [];
    for (const group of grouped.values()) {
      const routeIndex = this.routeStates.length;
      const start = particles.length;
      for (const flow of group.flows) for (let i = 0; i < flow.particles; i++) {
        particles.push(Object.freeze({ id: particles.length, routeIndex, mode: flow.mode, representedResidents: POPULATION_SCALE }));
      }
      const count = particles.length - start;
      this.routeStates.push({
        geometry: group.geometry, start, count,
        headway: Math.min(desiredHeadway, group.geometry.cycleLength / count * 0.45),
        bridgeCongested: false, nuraCongested: false,
      });
    }
    this.particles = Object.freeze(particles);
    this.routes = this.routeStates.map(r => r.geometry);
    this.phase = new Float64Array(particles.length);
    this.positions = new Float32Array(particles.length * 2);
    this.speedRatio = new Float32Array(particles.length);
    this.jammed = new Uint8Array(particles.length);
    this.advances = new Float64Array(particles.length);
    for (const route of this.routeStates) for (let j = 0; j < route.count; j++) {
      const index = route.start + j;
      this.phase[index] = route.geometry.cycleLength * (j + 0.5) / route.count;
      writeRoutePosition(route.geometry, this.phase[index], this.positions, index * 2);
      this.speedRatio[index] = 1;
    }
    this.setTrafficLoad(options.trafficLoad ?? estimateTrafficLoad(flows));
  }

  setTrafficLoad(traffic: TrafficLoad): void {
    for (let r = 0; r < this.routeStates.length; r++) {
      const route = this.routeStates[r];
      route.bridgeCongested = traffic.bridges.some(b => b.id === route.geometry.bridgeId && b.loadRatio > 1);
      route.nuraCongested = (traffic.districtLoad.nura ?? 0) > 1.4
        && (route.geometry.from === 'nura' || route.geometry.to === 'nura');
      // Static reduced-motion views must also show current bottlenecks immediately.
      for (let i = route.start; i < route.start + route.count; i++) {
        this.jammed[i] = this.bottleneckMultiplier(r, this.phase[i]) < 1 ? 1 : 0;
      }
    }
  }

  /** Public for diagnostics/tests; 140% is not congested until exceeded. */
  bottleneckMultiplier(routeIndex: number, phase: number): number {
    const route = this.routeStates[routeIndex];
    const geometry = route.geometry;
    const p = ((phase % geometry.cycleLength) + geometry.cycleLength) % geometry.cycleLength;
    const d = p;
    const atBridge = route.bridgeCongested && d >= geometry.bridgeStart && d <= geometry.bridgeEnd;
    const atNura = route.nuraCongested && (geometry.closed
      || (geometry.from === 'nura' && d < geometry.length * 0.2)
      || (geometry.to === 'nura' && d > geometry.length * 0.8));
    return atBridge || atNura ? 0.15 : 1;
  }

  step(seconds: number): void {
    // A suspended tab must never jump minutes ahead or tunnel through a bottleneck.
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const dt = Math.min(seconds, 0.05);
    const freeAdvance = this.baseSpeed * dt;
    for (let r = 0; r < this.routeStates.length; r++) {
      const route = this.routeStates[r];
      const end = route.start + route.count;
      // Synchronous headway constraints preserve cyclic ordering without sorting.
      for (let i = route.start; i < end; i++) {
        const multiplier = this.bottleneckMultiplier(r, this.phase[i]);
        let advance = freeAdvance * multiplier;
        if (route.count > 1) {
          const leader = i + 1 === end ? route.start : i + 1;
          let gap = this.phase[leader] - this.phase[i];
          if (gap <= 0) gap += route.geometry.cycleLength;
          advance = Math.min(advance, Math.max(0, gap - route.headway));
        }
        this.advances[i] = advance;
        this.speedRatio[i] = advance / freeAdvance;
        this.jammed[i] = multiplier < 1 || (advance < freeAdvance * 0.8 && (route.bridgeCongested || route.nuraCongested)) ? 1 : 0;
      }
      for (let i = route.start; i < end; i++) {
        this.phase[i] = (this.phase[i] + this.advances[i]) % route.geometry.cycleLength;
        writeRoutePosition(route.geometry, this.phase[i], this.positions, i * 2);
      }
    }
  }
}

export interface SwarmDiagnostics {
  particles: number;
  representedPopulation: number;
  fps: number;
  frameCostMs: number;
  congestedParticles: number;
  dpr: number;
  reducedMotion: boolean;
}

export interface ParticleSwarmOptions extends SwarmOptions {
  maxDpr?: number;
  showLabels?: boolean;
  onDiagnostics?: (diagnostics: SwarmDiagnostics) => void;
}

const COLORS = { car: '#ffb62e', bus: '#3be4ed', school: '#c583ff', jam: '#ff435a' } as const;

/** Browser renderer. Canvas 2D is sufficient for 1550 sprites; profile target devices. */
export class ParticleSwarm {
  readonly simulation: ParticleSimulation;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly background: HTMLCanvasElement;
  private readonly sprites: Record<keyof typeof COLORS, HTMLCanvasElement>;
  private readonly observer: ResizeObserver;
  private readonly motion: MediaQueryList;
  private readonly options: ParticleSwarmOptions;
  private raf = 0;
  private running = false;
  private destroyed = false;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private lastTime = 0;
  private sampleStart = 0;
  private sampleFrames = 0;
  private sampleCost = 0;
  private fps = 0;
  private frameCost = 0;

  constructor(canvas: HTMLCanvasElement, options: ParticleSwarmOptions = {}) {
    this.canvas = canvas;
    this.options = options;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas 2D is unavailable');
    this.context = context;
    this.simulation = new ParticleSimulation(options);
    this.background = document.createElement('canvas');
    const sprite = (color: string) => {
      const result = document.createElement('canvas');
      result.width = result.height = 32;
      const ctx = result.getContext('2d')!;
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.15, color);
      gradient.addColorStop(0.4, `${color}aa`);
      gradient.addColorStop(1, `${color}00`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
      return result;
    };
    this.sprites = { car: sprite(COLORS.car), bus: sprite(COLORS.bus), school: sprite(COLORS.school), jam: sprite(COLORS.jam) };
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.motion.addEventListener('change', this.onMotionChange);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(canvas);
    this.resize();
  }

  start(): void {
    if (this.destroyed) return;
    this.running = true;
    this.schedule();
  }

  stop(): void {
    this.running = false;
    this.cancelFrame();
  }

  destroy(): void {
    this.stop();
    this.destroyed = true;
    this.observer.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.motion.removeEventListener('change', this.onMotionChange);
    this.background.width = this.background.height = 1;
  }

  setTrafficLoad(traffic: TrafficLoad): void {
    if (this.destroyed) return;
    this.simulation.setTrafficLoad(traffic);
    if (this.motion.matches || !this.running) this.draw();
  }

  getDiagnostics(): SwarmDiagnostics {
    let congested = 0;
    for (let i = 0; i < this.simulation.jammed.length; i++) congested += this.simulation.jammed[i];
    return {
      particles: this.simulation.particles.length,
      representedPopulation: this.simulation.particles.length * POPULATION_SCALE,
      fps: this.motion.matches || document.hidden || !this.running ? 0 : Math.round(this.fps),
      frameCostMs: Math.round(this.frameCost * 100) / 100,
      congestedParticles: congested, dpr: Math.round(this.dpr * 100) / 100, reducedMotion: this.motion.matches,
    };
  }

  private cancelFrame(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.lastTime = 0;
    this.sampleStart = 0;
    this.sampleFrames = 0;
    this.sampleCost = 0;
  }

  private schedule(): void {
    if (this.running && !this.raf && !document.hidden && !this.motion.matches) this.raf = requestAnimationFrame(this.frame);
  }

  private onVisibilityChange = (): void => {
    if (document.hidden) this.cancelFrame(); else this.schedule();
  };

  private onMotionChange = (): void => {
    this.cancelFrame();
    this.draw();
    this.schedule();
    this.options.onDiagnostics?.(this.getDiagnostics());
  };

  private resize = (): void => {
    if (this.destroyed) return;
    const bounds = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, bounds.width);
    this.height = Math.max(1, bounds.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, Math.max(1, this.options.maxDpr ?? 1.75));
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.background.width = this.canvas.width;
    this.background.height = this.canvas.height;
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.paintBackground();
    this.draw();
  };

  private paintBackground(): void {
    const ctx = this.background.getContext('2d')!;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#091524';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#12334d';
    ctx.fillRect(0, this.height * 0.475, this.width, this.height * 0.05);
    ctx.strokeStyle = '#274257';
    ctx.lineWidth = 1;
    for (const route of this.simulation.routes) {
      ctx.beginPath();
      ctx.moveTo(route.x[0] * this.width, route.y[0] * this.height);
      for (let i = 1; i < route.x.length; i++) ctx.lineTo(route.x[i] * this.width, route.y[i] * this.height);
      ctx.stroke();
    }
    ctx.strokeStyle = '#657b93';
    ctx.lineWidth = 8;
    for (const bridge of this.options.bridges ?? BRIDGES) {
      ctx.beginPath();
      ctx.moveTo(bridge.left[0] * this.width, bridge.left[1] * this.height);
      ctx.lineTo(bridge.right[0] * this.width, bridge.right[1] * this.height);
      ctx.stroke();
    }
    if (this.options.showLabels !== false) {
      ctx.fillStyle = '#d8e7f3';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const district of this.options.districts ?? DISTRICTS_DATA) {
        ctx.fillText(district.name, district.centroid[0] * this.width, district.centroid[1] * this.height - 13);
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = '#9bb8d0';
      ctx.fillText('Ишим · схема потоков', 12, this.height * 0.5 + 4);
    }
  }

  private draw(): void {
    const ctx = this.context;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.background, 0, 0, this.width, this.height);
    // Source-over retains the mode/red hue under dense queues; additive blending
    // would wash overlapping glows to white and hide congestion severity.
    ctx.globalCompositeOperation = 'source-over';
    const sim = this.simulation;
    for (let i = 0; i < sim.particles.length; i++) {
      const particle = sim.particles[i];
      // Matrix direction is authoritative: no invented reverse leg. A glyph is
      // an aggregate stream proxy; it fades out and recycles at the origin.
      const route = sim.routes[particle.routeIndex];
      const distance = sim.phase[i];
      const fadeDistance = Math.min(0.03, route.length * 0.15);
      const opacity = route.closed ? 1 : Math.min(1, distance / fadeDistance, (route.length - distance) / fadeDistance);
      const sample = Math.min(route.x.length - 2, Math.floor(distance / route.length * (route.x.length - 1)));
      const dx = (route.x[sample + 1] - route.x[sample]) * this.width;
      const dy = (route.y[sample + 1] - route.y[sample]) * this.height;
      const tangentLength = Math.hypot(dx, dy) || 1;
      const lane = route.closed ? 0 : 1.8 * opacity;
      ctx.globalAlpha = opacity;
      ctx.drawImage(this.sprites[sim.jammed[i] ? 'jam' : particle.mode],
        sim.positions[i * 2] * this.width - dy / tangentLength * lane - 4.5,
        sim.positions[i * 2 + 1] * this.height + dx / tangentLength * lane - 4.5, 9, 9);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private frame = (now: number): void => {
    this.raf = 0;
    if (!this.running || this.destroyed || document.hidden || this.motion.matches) return;
    const started = performance.now();
    const dt = this.lastTime ? (now - this.lastTime) / 1000 : 1 / 60;
    this.lastTime = now;
    this.simulation.step(dt);
    this.draw();
    this.sampleFrames++;
    this.sampleCost += performance.now() - started;
    if (!this.sampleStart) this.sampleStart = now - dt * 1000;
    if (now - this.sampleStart >= 1000) {
      this.fps = this.sampleFrames * 1000 / (now - this.sampleStart);
      this.frameCost = this.sampleCost / this.sampleFrames;
      this.sampleStart = now;
      this.sampleFrames = 0;
      this.sampleCost = 0;
      // Callback is throttled to once per second; React stays outside the frame loop.
      this.options.onDiagnostics?.(this.getDiagnostics());
    }
    this.schedule();
  };
}
