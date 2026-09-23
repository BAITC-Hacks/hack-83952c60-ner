// Browser-safe entry: intentionally does not re-export the Node-only LLM service.
export * from './types';
export * from './data';
export * from './agents';
export * from './migration';
export * from './pulse';
export * from './simulation';
export * from './client';
export { PopulationCanvas } from './PopulationCanvas';
export { PopulationPanel } from './PopulationPanel';
