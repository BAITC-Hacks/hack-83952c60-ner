import type { BridgeDefinition, DistrictAggregate, MigrationFlow, Point } from './types';
import { selectBridge } from './migration';

/** Arc-length lookup tables are built once. No spline evaluation occurs in RAF. */
export interface SwarmRoute {
  key: string;
  from: MigrationFlow['from'];
  to: MigrationFlow['to'];
  bridgeId?: string;
  x: Float32Array;
  y: Float32Array;
  length: number;
  cycleLength: number;
  closed: boolean;
  bridgeStart: number;
  bridgeEnd: number;
}

const SAMPLES = 256;
const hypot = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function cubic(points: Point[], start: Point, a: Point, b: Point, end: Point): void {
  for (let i = 1; i <= 40; i++) {
    const t = i / 40;
    const s = 1 - t;
    points.push([
      s * s * s * start[0] + 3 * s * s * t * a[0] + 3 * s * t * t * b[0] + t * t * t * end[0],
      s * s * s * start[1] + 3 * s * s * t * a[1] + 3 * s * t * t * b[1] + t * t * t * end[1],
    ]);
  }
}

export function buildSwarmRoute(
  flow: Pick<MigrationFlow, 'from' | 'to' | 'bridgeId'>,
  districts: readonly DistrictAggregate[],
  bridges: readonly BridgeDefinition[],
): SwarmRoute {
  const from = districts.find(d => d.id === flow.from);
  const to = districts.find(d => d.id === flow.to);
  if (!from || !to) throw new Error(`Unknown route: ${flow.from} → ${flow.to}`);
  if (from.bank === to.bank && flow.bridgeId !== undefined) throw new Error('Same-bank routes cannot specify a bridge');
  const points: Point[] = [from.centroid];
  let bridgeStartIndex = -1;
  let bridgeEndIndex = -1;
  let bridgeId: string | undefined;
  const closed = from.id === to.id;

  if (closed) {
    // A continuous local loop stays on its bank and returns to its start.
    const side = from.bank === 'left' ? 1 : -1;
    const radiusY = Math.min(0.035, Math.abs(from.centroid[1] - 0.5) * 0.3);
    for (let i = 1; i <= 96; i++) {
      const angle = (i / 96) * Math.PI * 2;
      points.push([from.centroid[0] + Math.sin(angle) * 0.04,
        from.centroid[1] + side * radiusY * (1 - Math.cos(angle))]);
    }
  } else if (from.bank !== to.bank) {
    const resolvedBridgeId = flow.bridgeId ?? selectBridge(flow.from, flow.to, districts, bridges);
    const bridge = bridges.find(b => b.id === resolvedBridgeId);
    if (!bridge) throw new Error(`A cross-river route requires a valid bridge: ${flow.bridgeId ?? flow.from}`);
    bridgeId = bridge.id;
    const entrance = from.bank === 'left' ? bridge.left : bridge.right;
    const exit = from.bank === 'left' ? bridge.right : bridge.left;
    const side = from.bank === 'left' ? 1 : -1;
    cubic(points, from.centroid,
      [(from.centroid[0] + entrance[0]) / 2, from.centroid[1]],
      [entrance[0], entrance[1] + side * 0.055], entrance);
    bridgeStartIndex = points.length - 1;
    // The actual river crossing is a straight bridge segment, never a spline shortcut.
    for (let i = 1; i <= 24; i++) {
      const t = i / 24;
      points.push([entrance[0] + t * (exit[0] - entrance[0]), entrance[1] + t * (exit[1] - entrance[1])]);
    }
    bridgeEndIndex = points.length - 1;
    cubic(points, exit, [exit[0], exit[1] - side * 0.055],
      [(exit[0] + to.centroid[0]) / 2, to.centroid[1]], to.centroid);
  } else {
    // Bézier convex hull remains on the same side of the river.
    const midX = (from.centroid[0] + to.centroid[0]) / 2;
    cubic(points, from.centroid, [midX, from.centroid[1]], [midX, to.centroid[1]], to.centroid);
  }

  const cumulative = new Float64Array(points.length);
  for (let i = 1; i < points.length; i++) cumulative[i] = cumulative[i - 1] + hypot(points[i], points[i - 1]);
  const length = cumulative[cumulative.length - 1];
  if (length <= 0) throw new Error('Route length must be positive');
  const x = new Float32Array(SAMPLES + 1);
  const y = new Float32Array(SAMPLES + 1);
  let segment = 1;
  for (let i = 0; i <= SAMPLES; i++) {
    const distance = length * i / SAMPLES;
    while (segment < points.length - 1 && cumulative[segment] < distance) segment++;
    const gap = cumulative[segment] - cumulative[segment - 1];
    const t = gap ? (distance - cumulative[segment - 1]) / gap : 0;
    x[i] = points[segment - 1][0] + (points[segment][0] - points[segment - 1][0]) * t;
    y[i] = points[segment - 1][1] + (points[segment][1] - points[segment - 1][1]) * t;
  }
  return {
    key: `${from.id}:${to.id}:${bridgeId ?? 'local'}`,
    from: from.id, to: to.id, bridgeId, x, y, length, closed,
    cycleLength: length,
    bridgeStart: bridgeStartIndex < 0 ? -1 : cumulative[bridgeStartIndex],
    bridgeEnd: bridgeEndIndex < 0 ? -1 : cumulative[bridgeEndIndex],
  };
}

/** Directed stream glyphs recycle at the destination; Canvas fades both endpoints.
 * They represent a repeated aggregate flow, not tracked individual round trips. */
export function writeRoutePosition(route: SwarmRoute, phase: number, output: Float32Array, offset = 0): void {
  const wrapped = ((phase % route.cycleLength) + route.cycleLength) % route.cycleLength;
  const distance = wrapped;
  const index = Math.min(route.x.length - 2, Math.floor(distance / route.length * (route.x.length - 1)));
  const t = distance / route.length * (route.x.length - 1) - index;
  output[offset] = route.x[index] + (route.x[index + 1] - route.x[index]) * t;
  output[offset + 1] = route.y[index] + (route.y[index + 1] - route.y[index]) * t;
}
