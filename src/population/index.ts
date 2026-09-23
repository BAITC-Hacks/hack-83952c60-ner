// Browser-safe entry: intentionally does not re-export the Node-only LLM service.
export * from './types';
export * from './data';
export * from './agents';
export * from './migration';
export * from './pulse';
export * from './simulation';
export * from './client';
export * from './selection';
export { ParticleSimulation, ParticleSwarm } from './ParticleSwarm';
export type { Particle, SwarmOptions, SwarmDiagnostics, ParticleSwarmOptions } from './ParticleSwarm';
export { PopulationCanvas } from './PopulationCanvas';
export { PopulationPanel } from './PopulationPanel';
