import { describe, expect, it } from 'vitest';
import { AtlasSwarmSimulation, parseRoadPaths, unprojectRoadPoint } from '../src/atlas/swarm';
import { transitMap } from '../src/data/transitMap';
import { PARTICLE_COUNT, SOURCE_POPULATION } from '../src/population/data';

describe('geographic population swarm', () => {
  it('reverses the snapshot projection without using its rounded height', () => {
    const { bounds, width } = transitMap;
    const longitude = 71.4304, latitude = 51.1282;
    const scale = width / ((bounds.east - bounds.west) * Math.cos((bounds.south + bounds.north) * Math.PI / 360));
    const x = (longitude - bounds.west) / (bounds.east - bounds.west) * width;
    const y = (bounds.north - latitude) * scale;
    const point = unprojectRoadPoint(x, y);
    expect(point[0]).toBeCloseTo(longitude, 10);
    expect(point[1]).toBeCloseTo(latitude, 10);
    expect(unprojectRoadPoint(0, 0)).toEqual([bounds.west, bounds.north]);
  });

  it('keeps disconnected ways separate and removes zero length segments', () => {
    expect(parseRoadPaths('M0,0L0,0L10,0M100,100L100,110M5,5')).toEqual([
      [[0, 0], [10, 0]], [[100, 100], [100, 110]],
    ]);
    expect(parseRoadPaths('M1,1L1,1')).toEqual([]);
  });

  it('preserves the cohort, stable rendering buffers and geographic bounds through updates', () => {
    const swarm = new AtlasSwarmSimulation();
    const particles = swarm.particles;
    const first = particles[0], position = first.position, color = first.color;
    const before = [...position];
    expect(particles).toHaveLength(PARTICLE_COUNT);
    expect(swarm.simulation.particles.reduce((total, particle) => total + particle.representedResidents, 0)).toBe(SOURCE_POPULATION);
    for (let frame = 0; frame < 240; frame++) swarm.step(1 / 60);
    expect(swarm.particles).toBe(particles);
    expect(particles[0]).toBe(first);
    expect(first.position).toBe(position);
    expect(first.color).toBe(color);
    expect(position).not.toEqual(before);
    expect(Array.from(swarm.simulation.jammed).every(value => value === 0)).toBe(true);
    const { bounds } = transitMap;
    for (const particle of particles) {
      const [lon, lat, altitude] = particle.position;
      expect(Number.isFinite(lon) && Number.isFinite(lat)).toBe(true);
      // Snapshot vertices are rounded to one pixel decimal, including clipped edges.
      expect(lon).toBeGreaterThanOrEqual(bounds.west - .0001);
      expect(lon).toBeLessThanOrEqual(bounds.east + .0001);
      expect(lat).toBeGreaterThanOrEqual(bounds.south - .0001);
      expect(lat).toBeLessThanOrEqual(bounds.north + .0001);
      expect(altitude).toBe(4);
      expect(particle.color[3]).toBeGreaterThanOrEqual(0);
      expect(particle.color[3]).toBeLessThanOrEqual(255);
    }
  });

  it('reproduces the street allocation and motion from the same seed', () => {
    const first = new AtlasSwarmSimulation(81), second = new AtlasSwarmSimulation(81);
    const other = new AtlasSwarmSimulation(82);
    first.step(.05); second.step(.05);
    expect(first.particles).toEqual(second.particles);
    expect(first.particles).not.toEqual(other.particles);
  });
});
