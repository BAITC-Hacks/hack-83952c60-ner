/** Deterministic, synthetic traffic model. Coordinates are schematic, in scene units. */
export const AGENT_COUNT = 420;
export const BRIDGES = [-24, 0, 24] as const;
export const TRANSITION_SECONDS = 2;
export type XYZ = [number, number, number];
export type CameraView = 'orbit' | 'junction';
export type ScenarioId = 'baseline' | 'interchange' | 'transit' | 'signals';
export interface TrafficMetrics {
  speed: number; delay: number; throughput: number; impact: number;
  transitShare: number; reroutedShare: number; peakDelayReduction: number;
}
/** Illustrative scenario targets, not measured transport forecasts. */
export const SCENARIO_METRICS: Record<ScenarioId, TrafficMetrics> = {
  baseline: { speed: 12, delay: 48, throughput: 1920, impact: 0, transitShare: 20, reroutedShare: 0, peakDelayReduction: 0 },
  interchange: { speed: 44, delay: 9, throughput: 4800, impact: 8.4, transitShare: 40, reroutedShare: 40, peakDelayReduction: 73 },
  transit: { speed: 32, delay: 18, throughput: 3960, impact: 6.8, transitShare: 60, reroutedShare: 0, peakDelayReduction: 58 },
  signals: { speed: 28, delay: 25, throughput: 3240, impact: 4.6, transitShare: 20, reroutedShare: 0, peakDelayReduction: 42 },
};
type ScenarioWeights = Record<ScenarioId, number>;
const SCENARIOS = Object.keys(SCENARIO_METRICS) as ScenarioId[];
const baselineWeights = (): ScenarioWeights => ({ baseline: 1, interchange: 0, transit: 0, signals: 0 });
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
  scenario: ScenarioId;
  weights: ScenarioWeights;
  transitionFrom: ScenarioWeights;
  transitionElapsed: number;
  transitioning: boolean;
  metrics: TrafficMetrics;
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
  const model: TrafficModel = { agents, occupancy: [0, 0, 0], congestion: [0, 1, 0], blend: 0, elapsed: 0, completed: 0,
    scenario: 'baseline', weights: baselineWeights(), transitionFrom: baselineWeights(), transitionElapsed: TRANSITION_SECONDS,
    transitioning: false, metrics: { ...SCENARIO_METRICS.baseline } };
  stepTraffic(model, 0, 'baseline');
  return model;
}

/** Road spline: straight streets joined with short quadratic Bézier corners. */
export function sampleAgent(agent: Agent, progress: number, blend: number, out: XYZ, transitLaneBlend = 0): XYZ {
  const distance = ((progress % 1 + 1) % 1) * agent.length;
  let segment = 1;
  while (segment < agent.lengths.length - 1 && distance > agent.lengths[segment]) segment++;
  const a = agent.nodes[segment - 1], b = agent.nodes[segment];
  const t = (distance - agent.lengths[segment - 1]) / Math.max(.001, agent.lengths[segment] - agent.lengths[segment - 1]);
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = .42;
  out[2] = a[2] + (b[2] - a[2]) * t;
  const radius = 1.2;
  const corner = distance - agent.lengths[segment - 1] < radius && segment > 1 ? segment - 1
    : agent.lengths[segment] - distance < radius && segment < agent.nodes.length - 1 ? segment : -1;
  if (corner > 0) {
    const before = agent.nodes[corner - 1], at = agent.nodes[corner], after = agent.nodes[corner + 1];
    const u = (distance - agent.lengths[corner] + radius) / (radius * 2), v = 1 - u;
    const incoming = Math.max(.001, agent.lengths[corner] - agent.lengths[corner - 1]);
    const outgoing = Math.max(.001, agent.lengths[corner + 1] - agent.lengths[corner]);
    for (const axis of [0, 2] as const) {
      const start = at[axis] + (before[axis] - at[axis]) * radius / incoming;
      const end = at[axis] + (after[axis] - at[axis]) * radius / outgoing;
      out[axis] = v * v * start + 2 * v * u * at[axis] + u * u * end;
    }
  }
  // The same route parameter survives scenario changes: agents never teleport or respawn.
  if (segment === 3) out[2] += (agent.id % 2 === 0 ? .4 : -.4) * Math.sin(Math.PI * t) ** 2 * transitLaneBlend;
  if (agent.diverted && segment === 3) {
    const arch = Math.sin(Math.PI * t) ** 2;
    out[1] += arch * 5.8 * blend;
    out[2] += (-6 - BRIDGES[agent.bridge]) * arch * blend;
  }
  return out;
}

const scratch: XYZ = [0, 0, 0];
/** A continuous weight lets a car become transit without replacing the agent. */
export function transitWeight(agent: Agent, model: TrafficModel): number {
  if (agent.transit) return 1;
  if (agent.id % 5 === 1) return model.weights.interchange + model.weights.transit;
  return agent.id % 5 === 2 ? model.weights.transit : 0;
}

export function sampleTrafficAgent(agent: Agent, progress: number, model: TrafficModel, out: XYZ): XYZ {
  return sampleAgent(agent, progress, model.blend, out, agent.id % 5 < 3 ? model.weights.transit : 0);
}

/** Offset junction phases form a green wave on the existing bridge approaches. */
export function signalGreen(elapsed: number, bridge: number, direction = 1): boolean {
  return ((elapsed - bridge * .8 * direction) % 6 + 6) % 6 < 4.2;
}

export function stepTraffic(model: TrafficModel, dt: number, scenario: ScenarioId) {
  if (scenario !== model.scenario) {
    model.scenario = scenario;
    model.transitionFrom = { ...model.weights };
    model.transitionElapsed = 0;
    model.transitioning = true;
  }
  model.elapsed += dt;
  model.transitionElapsed = Math.min(TRANSITION_SECONDS, model.transitionElapsed + dt);
  if (TRANSITION_SECONDS - model.transitionElapsed < 1e-9) model.transitionElapsed = TRANSITION_SECONDS;
  const amount = smooth(model.transitionElapsed / TRANSITION_SECONDS);
  for (const id of SCENARIOS) model.weights[id] = model.transitionFrom[id] * (1 - amount) + (scenario === id ? amount : 0);
  model.transitioning = model.transitionElapsed < TRANSITION_SECONDS;
  model.blend = model.weights.interchange;
  for (const key of Object.keys(model.metrics) as Array<keyof TrafficMetrics>) {
    model.metrics[key] = SCENARIOS.reduce((total, id) => total + SCENARIO_METRICS[id][key] * model.weights[id], 0);
  }
  const { interchange, transit, signals } = model.weights;
  model.occupancy.fill(0);
  for (const agent of model.agents) {
    sampleTrafficAgent(agent, agent.progress, model, scratch);
    if (Math.abs(scratch[0]) < 18) {
      // Transit represents more passengers per road-space unit; flyover trips leave bridge demand.
      const demand = (1 - (agent.diverted ? interchange : 0)) * (1 - (agent.id % 5 < 3 ? transit * .7 : 0));
      model.occupancy[agent.bridge] += demand;
    }
  }
  for (let i = 0; i < 3; i++) {
    const capacity = (i === 1 ? 24 : 45) + 210 * interchange + 65 * transit + 75 * signals;
    model.congestion[i] = model.occupancy[i] > capacity ? 1 - interchange - .65 * transit - .5 * signals : 0;
  }
  for (const agent of model.agents) {
    sampleTrafficAgent(agent, agent.progress, model, scratch);
    const queue = Math.abs(scratch[0]) < 18 ? model.congestion[agent.bridge] : 0;
    const priority = agent.id % 5 < 3 ? transit : 0;
    const factor = 1 - .9 * queue * (1 - priority * .92);
    const atSignal = Math.abs(Math.abs(scratch[0]) - 22) < 2;
    const signalFactor = atSignal && !signalGreen(model.elapsed, agent.bridge, agent.id % 2 === 0 ? 1 : -1) ? 1 - signals * .65 : 1;
    agent.progress += dt * agent.speed * (1 + interchange * .9 + transit * .25 + priority * .45 + signals * .5) * factor * signalFactor / agent.length;
    if (agent.progress >= 1) { model.completed += Math.floor(agent.progress); agent.progress %= 1; }
  }
}
