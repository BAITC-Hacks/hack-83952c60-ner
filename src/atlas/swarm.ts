import { transitMap } from '../data/transitMap';
import { createSeededRandom } from '../population/data';
import { ParticleSimulation } from '../population/ParticleSwarm';
import type { TransportMode } from '../population/types';

type RoadPoint = [number, number];
interface RoadProjection {
  width: number;
  bounds: { west: number; south: number; east: number; north: number };
}

/** Inverse of scripts/build-transit-map.mjs; height is rounded and is not a scale. */
export function unprojectRoadPoint(x: number, y: number, projection: RoadProjection = transitMap): RoadPoint {
  const { width, bounds } = projection;
  const scale = width / ((bounds.east - bounds.west) * Math.cos((bounds.south + bounds.north) * Math.PI / 360));
  return [bounds.west + x / width * (bounds.east - bounds.west), bounds.north - y / scale];
}

/** The bundled snapshot contains absolute M/L paths; each M starts a separate way. */
export function parseRoadPaths(path: string): RoadPoint[][] {
  const paths: RoadPoint[][] = [];
  let current: RoadPoint[] = [];
  const number = '(-?(?:\\d+(?:\\.\\d*)?|\\.\\d+))';
  const coordinates = new RegExp(`([ML])${number},${number}`, 'g');
  for (const match of path.matchAll(coordinates)) {
    if (match[1] === 'M') {
      if (current.length > 1) paths.push(current);
      current = [];
    }
    const point: RoadPoint = [Number(match[2]), Number(match[3])];
    const previous = current[current.length - 1];
    if (!previous || previous[0] !== point[0] || previous[1] !== point[1]) current.push(point);
  }
  if (current.length > 1) paths.push(current);
  return paths;
}

interface Road {
  points: RoadPoint[];
  cumulative: Float64Array;
  length: number;
  weight: number;
}
interface Assignment { road: Road; start: number; direction: number }
export interface AtlasSwarmParticle {
  position: [number, number, number];
  color: [number, number, number, number];
}

const MODE_COLORS: Record<TransportMode, [number, number, number]> = {
  car: [255, 182, 46], bus: [59, 228, 237], school: [197, 131, 255],
};
const ROAD_WEIGHTS: Record<string, number> = {
  primary: 2, primary_link: 1.4, secondary: 1.6, secondary_link: 1.1,
  tertiary: 1.2, tertiary_link: .9, residential: .8,
};

function createRoads(): Road[] {
  return transitMap.roads.flatMap(({ kind, path }) => parseRoadPaths(path).flatMap(points => {
    const cumulative = new Float64Array(points.length);
    for (let i = 1; i < points.length; i++) {
      cumulative[i] = cumulative[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    }
    const length = cumulative[cumulative.length - 1];
    if (length < 2) return [];
    return [{ points: points.map(([x, y]) => unprojectRoadPoint(x, y)), cumulative, length, weight: length * (ROAD_WEIGHTS[kind] ?? .4) }];
  }));
}

/** The cohort retains the population model's counts, modes and phases. Street
 * assignments are seeded visual scenarios, not observed trips or routed district
 * origin/destination journeys. Schematic bridge congestion is deliberately absent. */
export class AtlasSwarmSimulation {
  readonly simulation: ParticleSimulation;
  readonly particles: AtlasSwarmParticle[];
  private readonly assignments: Assignment[];

  constructor(seed = 42) {
    this.simulation = new ParticleSimulation({ trafficLoad: { bridges: [], districtLoad: {} } });
    const random = createSeededRandom(seed);
    const roads = createRoads();
    if (!roads.length) throw new Error('The street snapshot contains no usable road paths');
    const cumulative = new Float64Array(roads.length);
    for (let i = 0; i < roads.length; i++) cumulative[i] = (cumulative[i - 1] ?? 0) + roads[i].weight;
    const total = cumulative[cumulative.length - 1];
    this.assignments = this.simulation.particles.map(() => {
      const weight = random() * total;
      let low = 0, high = roads.length - 1;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (cumulative[middle] < weight) low = middle + 1;
        else high = middle;
      }
      return { road: roads[low], start: random(), direction: random() < .5 ? -1 : 1 };
    });
    this.particles = this.simulation.particles.map(particle => ({
      position: [0, 0, 4], color: [...MODE_COLORS[particle.mode], 255],
    }));
    this.updatePositions();
  }

  step(seconds: number): void {
    this.simulation.step(seconds);
    this.updatePositions();
  }

  private updatePositions(): void {
    for (let i = 0; i < this.particles.length; i++) {
      const { road, start, direction } = this.assignments[i];
      const source = this.simulation.particles[i];
      const route = this.simulation.routes[source.routeIndex];
      const progress = ((start + direction * this.simulation.phase[i] / route.length) % 1 + 1) % 1;
      const distance = progress * road.length;
      let low = 1, high = road.cumulative.length - 1;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (road.cumulative[middle] < distance) low = middle + 1;
        else high = middle;
      }
      const previous = low - 1;
      const t = (distance - road.cumulative[previous]) / (road.cumulative[low] - road.cumulative[previous]);
      const particle = this.particles[i];
      particle.position[0] = road.points[previous][0] + t * (road.points[low][0] - road.points[previous][0]);
      particle.position[1] = road.points[previous][1] + t * (road.points[low][1] - road.points[previous][1]);
      // Each disconnected way recycles independently; fade before the endpoint jump.
      particle.color[3] = Math.round(255 * Math.min(1, progress / .08, (1 - progress) / .08));
    }
  }
}
