/** Deterministic, synthetic traffic model. Coordinates are schematic, in scene units. */
export const AGENT_COUNT = 420;
export const BRIDGES = [-24, 0, 24] as const;
export const TRANSITION_SECONDS = 2;
export type XYZ = [number, number, number];
export type CameraView = 'orbit' | 'junction';
export interface Agent {
  id: number;
  bridge: number;
  progress: number;
  speed: number;
  transit: boolean;
  diverted: boolean;
  converts: boolean;
  nodes: XYZ[];
  lengths: number[];
  length: number;
}
export interface TrafficModel {
  agents: Agent[];
  occupancy: number[];
  congestion: number[];
  blend: number;
  elapsed: number;
  completed: number;
}
export const smooth = (t: number) => t * t * (3 - 2 * t);
export function seededRandom(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function createTraffic(): TrafficModel {
  const random = seededRandom(2026);
  const agents: Agent[] = [];
  for (let id = 0; id < AGENT_COUNT; id++) {
    const bridge = id % 10 < 6 ? 1 : id % 2 === 0 ? 0 : 2;
    const direction = id % 2 === 0 ? 1 : -1;
    const originZ = [-36, -12, 12, 36][id % 4];
    const destinationZ = [-36, -12, 12, 36][(id + 2) % 4];
    const lane = direction * 0.46;
    const nodes: XYZ[] = [
      [-38 * direction, .42, originZ + lane], [-26 * direction, .42, originZ + lane],
      [-26 * direction, .42, BRIDGES[bridge] + lane], [26 * direction, .42, BRIDGES[bridge] + lane],
      [26 * direction, .42, destinationZ + lane], [38 * direction, .42, destinationZ + lane],
    ];
    const lengths = [0];
    for (let i = 1; i < nodes.length; i++) lengths.push(lengths[i - 1] + Math.hypot(nodes[i][0] - nodes[i - 1][0], nodes[i][2] - nodes[i - 1][2]));
    const length = lengths.at(-1)!;
    // Seed the central approach at peak-hour density; subsequent queues are occupancy-driven.
    const progress = bridge === 1 && id % 3 !== 0
      ? (lengths[2] + 11 + random() * 30) / length : random();
    agents.push({ id, bridge, progress, speed: 3.5 + random() * 2.2, transit: id % 5 === 0,
      diverted: id % 5 < 2, converts: id % 5 === 1, nodes, lengths, length });
  }
  const model = { agents, occupancy: [0, 0, 0], congestion: [0, 1, 0], blend: 0, elapsed: 0, completed: 0 };
  stepTraffic(model, 0, false);
  return model;
}

/** Allocation-free polyline sampling, with rounded spline-like corners and an elevated bypass. */
export function sampleAgent(agent: Agent, progress: number, blend: number, out: XYZ): XYZ {
  const distance = ((progress % 1 + 1) % 1) * agent.length;
  let segment = 1;
  while (segment < agent.lengths.length - 1 && distance > agent.lengths[segment]) segment++;
  const a = agent.nodes[segment - 1], b = agent.nodes[segment];
  const t = (distance - agent.lengths[segment - 1]) / Math.max(.001, agent.lengths[segment] - agent.lengths[segment - 1]);
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = .42;
  out[2] = a[2] + (b[2] - a[2]) * t;
  // The same route parameter survives project toggles: agents never teleport or respawn.
  if (agent.diverted && segment === 3) {
    const arch = Math.sin(Math.PI * t) ** 2;
    out[1] += arch * 5.8 * blend;
    out[2] += (-6 - BRIDGES[agent.bridge]) * arch * blend;
  }
  return out;
}

const scratch: XYZ = [0, 0, 0];
export function stepTraffic(model: TrafficModel, dt: number, project: boolean) {
  model.elapsed += dt;
  model.blend = Math.max(0, Math.min(1, model.blend + (project ? 1 : -1) * dt / TRANSITION_SECONDS));
  const blend = smooth(model.blend);
  model.occupancy.fill(0);
  for (const agent of model.agents) {
    sampleAgent(agent, agent.progress, blend, scratch);
    if (Math.abs(scratch[0]) < 18 && !(agent.diverted && blend > .5)) model.occupancy[agent.bridge]++;
  }
  for (let i = 0; i < 3; i++) {
    const capacity = (i === 1 ? 24 : 45) + 210 * blend;
    model.congestion[i] = model.occupancy[i] > capacity ? 1 - blend : 0;
  }
  for (const agent of model.agents) {
    sampleAgent(agent, agent.progress, blend, scratch);
    const queue = Math.abs(scratch[0]) < 18 ? model.congestion[agent.bridge] : 0;
    const factor = 1 - .9 * queue;
    agent.progress += dt * agent.speed * (1 + blend * .9) * factor / agent.length;
    if (agent.progress >= 1) { model.completed++; agent.progress %= 1; }
  }
}
