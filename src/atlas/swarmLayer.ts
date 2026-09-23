import type { Layer } from '@deck.gl/core';
import { ScatterplotLayer } from '@deck.gl/layers';
import type { MapLibreOverlay } from '@deck.gl/maplibre';
import { AtlasSwarmSimulation, type AtlasSwarmParticle } from './swarm';

/** Share the atlas camera and WebGL context; the swarm never captures map input. */
export function animateAtlasSwarm(
  overlay: MapLibreOverlay,
  baseLayers: Layer[],
  swarm: AtlasSwarmSimulation,
  options: { visible: boolean; paused: boolean; opacity: number },
): () => void {
  let frame = 0, previous = 0, version = 0;
  let disposed = false;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const draw = () => {
    const shared = {
      data: swarm.particles,
      pickable: false,
      billboard: true,
      radiusUnits: 'pixels' as const,
      getPosition: (particle: AtlasSwarmParticle) => particle.position,
      getFillColor: (particle: AtlasSwarmParticle) => particle.color,
      updateTriggers: { getPosition: version, getFillColor: version },
      // An overlay stays readable even beside extruded buildings and columns.
      parameters: { depthCompare: 'always' as const, depthWriteEnabled: false },
    };
    overlay.setProps({ layers: [
      ...baseLayers,
      ...(options.visible ? [
        new ScatterplotLayer<AtlasSwarmParticle>({ ...shared, id: 'atlas-swarm-glow', getRadius: 5, opacity: options.opacity * .18 }),
        new ScatterplotLayer<AtlasSwarmParticle>({ ...shared, id: 'atlas-swarm', getRadius: 1.8, opacity: options.opacity }),
      ] : []),
    ] });
  };
  const schedule = () => {
    if (!disposed && !frame && options.visible && !options.paused && !motion.matches && !document.hidden) frame = requestAnimationFrame(tick);
  };
  const tick = (now: number) => {
    frame = 0;
    if (disposed) return;
    // Cap uploads at 30 Hz without tying simulation speed to display refresh rate.
    if (!previous || now - previous >= 1000 / 30) {
      swarm.step(previous ? (now - previous) / 1000 : 0);
      previous = now;
      version++;
      draw();
    }
    schedule();
  };
  const resume = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
    schedule();
  };
  draw();
  schedule();
  document.addEventListener('visibilitychange', resume);
  motion.addEventListener('change', resume);
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    document.removeEventListener('visibilitychange', resume);
    motion.removeEventListener('change', resume);
  };
}
