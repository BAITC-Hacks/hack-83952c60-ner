import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseGeoJSON, featureName, type AtlasFeature } from '../src/atlas/data';
import { createAtlasOpinionPlaces } from '../src/atlas/opinions';
import { generateAgents } from '../src/population/agents';
import { DISTRICTS_DATA } from '../src/population/data';

const snapshot = parseGeoJSON(JSON.parse(readFileSync(new URL('../public/data/astana-infrastructure.geojson', import.meta.url), 'utf8')));

describe('Atlas simulated place opinions', () => {
  it('anchors all infrastructure discussions to exact supplied OSM features', () => {
    const places = createAtlasOpinionPlaces(snapshot.features);
    expect(places).toHaveLength(21);
    const infrastructure = places.filter(place => place.category !== 'public');
    expect(infrastructure).toHaveLength(18);
    for (const place of infrastructure) {
      const feature = snapshot.features.find(candidate => candidate.id === place.id)!;
      expect(feature.geometry.type).toBe('Point');
      if (feature.geometry.type === 'Point') expect(place.position).toEqual(feature.geometry.coordinates);
      expect(place.name).toBe(featureName(feature));
      expect(place.category).toBe(feature.properties.category);
    }
    expect(Math.max(...places.map(place => place.position[0])) - Math.min(...places.map(place => place.position[0]))).toBeGreaterThan(.08);
    expect(Math.max(...places.map(place => place.position[1])) - Math.min(...places.map(place => place.position[1]))).toBeGreaterThan(.08);
  });

  it('retains deterministic agent identities, traits, and distinct authors within each discussion', () => {
    const agents = generateAgents(42);
    const places = createAtlasOpinionPlaces(snapshot.features);
    for (const place of places) {
      expect(place.comments.length).toBeGreaterThanOrEqual(2);
      expect(place.comments.length).toBeLessThanOrEqual(4);
      expect(new Set(place.comments.map(comment => comment.agentId)).size).toBe(place.comments.length);
      for (const comment of place.comments) {
        const agent = agents.find(candidate => candidate.id === comment.agentId)!;
        expect(agent).toBeDefined();
        expect(comment.agentName).toBe(agent.name);
        expect(comment.profession).toBe(agent.profession);
        expect(comment.stress).toBe(agent.stress);
        expect(comment.districtName).toBe(DISTRICTS_DATA.find(district => district.id === agent.homeDistrict)!.name);
      }
    }
    const comments = places.flatMap(place => place.comments);
    expect(new Set(comments.map(comment => comment.id)).size).toBe(comments.length);
    expect(new Set(comments.map(comment => comment.text)).size).toBe(comments.length);
    expect(new Set(comments.map(comment => comment.sentiment))).toEqual(new Set(['positive', 'neutral', 'negative']));
    expect(new Set(comments.map(comment => comment.districtName)).size).toBe(6);
  });

  it('does not depend on feature order or mutate the snapshot', () => {
    const input = structuredClone(snapshot.features);
    const initial = structuredClone(input);
    const places = createAtlasOpinionPlaces(input);
    expect(createAtlasOpinionPlaces([...input].reverse())).toEqual(places);
    expect(input).toEqual(initial);
    places[0].position[0] = 0;
    places[0].comments[0].text = 'changed';
    expect(createAtlasOpinionPlaces(input)[0].position[0]).not.toBe(0);
    expect(createAtlasOpinionPlaces(input)[0].comments[0].text).not.toBe('changed');
  });

  it('omits absent or invalid institutions instead of inventing replacement locations', () => {
    expect(createAtlasOpinionPlaces([]).map(place => place.id)).toEqual(['public/baiterek', 'public/old-center', 'public/expo']);
    const feature = structuredClone(snapshot.features.find(candidate => candidate.id === 'node/4931111296')!);
    const malformed: AtlasFeature[] = [
      { ...feature, geometry: { type: 'Point', coordinates: [NaN, 51.12] } },
      { ...feature, geometry: { type: 'Point', coordinates: [72, 52] } },
      { ...feature, geometry: { type: 'LineString', coordinates: [[71.43, 51.12], [71.44, 51.13]] } },
      { ...feature, properties: { ...feature.properties, category: 'unknown' } },
    ];
    for (const input of malformed) expect(createAtlasOpinionPlaces([input])).toHaveLength(3);
    expect(createAtlasOpinionPlaces([feature])).toHaveLength(4);
  });
});
