import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { ParticleSwarm } from './ParticleSwarm';
import type { SwarmDiagnostics } from './ParticleSwarm';
import type { MigrationFlow, TrafficLoad } from './types';

export interface PopulationCanvasProps {
  trafficLoad: TrafficLoad;
  flows?: readonly MigrationFlow[];
  className?: string;
  style?: CSSProperties;
  onDiagnostics?: (diagnostics: SwarmDiagnostics) => void;
}

/** Resize/visibility/motion observers and RAF are all released on unmount. */
export function PopulationCanvas({ trafficLoad, flows, className, style, onDiagnostics }: PopulationCanvasProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<ParticleSwarm | null>(null);
  const diagnosticsCallback = useRef(onDiagnostics);
  const traffic = useRef(trafficLoad);
  const latestFlows = useRef(flows);
  // Simulation snapshots are new JSON objects each second. Reference identity must
  // not reset particle positions; only a changed route/mode/count rebuilds the kernel.
  const flowKey = flows === undefined ? 'default' : JSON.stringify(flows.map(flow => JSON.stringify([
    flow.from, flow.to, flow.mode, flow.purpose, flow.particles, flow.residents, flow.bridgeId ?? null,
  ])).sort());
  diagnosticsCallback.current = onDiagnostics;
  traffic.current = trafficLoad;
  latestFlows.current = flows;

  useEffect(() => {
    if (!canvas.current) return;
    const swarm = new ParticleSwarm(canvas.current, {
      flows: latestFlows.current, trafficLoad: traffic.current,
      onDiagnostics: value => diagnosticsCallback.current?.(value),
    });
    engine.current = swarm;
    swarm.start();
    return () => { swarm.destroy(); engine.current = null; };
  }, [flowKey]);

  useEffect(() => { engine.current?.setTrafficLoad(trafficLoad); }, [trafficLoad]);

  return <canvas ref={canvas} className={className}
    style={{ display: 'block', width: '100%', height: 420, ...style }}
    role="img" aria-label="Схема потоков населения Астаны: жёлтые — автомобили, бирюзовые — автобусы, фиолетовые — школьный трафик, красные — заторы. Один маркер соответствует тысяче жителей." />;
}
