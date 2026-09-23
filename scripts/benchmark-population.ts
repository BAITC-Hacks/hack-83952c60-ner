/** CPU kernel only; a render benchmark must be measured separately on target devices. */
import { performance } from 'node:perf_hooks';
import { ParticleSimulation } from '../src/population/ParticleSwarm';
import { calculateCityPulse } from '../src/population/pulse';
import { createPopulationSnapshot } from '../src/population/simulation';

const snapshot = createPopulationSnapshot();
const swarm = new ParticleSimulation({ flows: snapshot.flows, trafficLoad: snapshot.trafficLoad });
for (let i = 0; i < 300; i++) swarm.step(1 / 60);
const timings: number[] = [];
for (let i = 0; i < 1200; i++) {
  const started = performance.now();
  swarm.step(1 / 60);
  timings.push(performance.now() - started);
}
timings.sort((a, b) => a - b);
const pulseStarted = performance.now();
for (let i = 0; i < 1000; i++) calculateCityPulse(snapshot.agents, { hour: snapshot.hour, trafficLoad: snapshot.trafficLoad });
console.log(JSON.stringify({
  runtime: process.version,
  particles: swarm.particles.length,
  routes: swarm.routes.length,
  kernelMedianMs: timings[Math.floor(timings.length * .5)],
  kernelP95Ms: timings[Math.floor(timings.length * .95)],
  pulseMeanMs: (performance.now() - pulseStarted) / 1000,
  note: 'CPU update only. Excludes Canvas, GPU compositing and mobile hardware. Not a 60 FPS guarantee.',
}, null, 2));
