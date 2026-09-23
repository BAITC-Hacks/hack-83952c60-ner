import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { densityCells, featureName, geometryBounds, parseGeoJSON, type AtlasFeature } from '../src/atlas/data';

const point = (coordinates = [71.43, 51.12], properties: Record<string, unknown> = {}): AtlasFeature => ({ type: 'Feature', geometry: { type: 'Point', coordinates }, properties });
const collection = (features: unknown[]) => ({ type: 'FeatureCollection', features });

describe('Atlas GIS data contracts', () => {
  it('accepts WGS84 geometries and normalizes valid null properties', () => {
    const input = collection([{ ...point(), properties: null }, { type: 'Feature', properties: { name: 'Линия' }, geometry: { type: 'MultiLineString', coordinates: [[[71.4, 51.1], [71.5, 51.2]]] } }]);
    const data = parseGeoJSON(input);
    expect(data.features[0].properties).toEqual({});
    expect(geometryBounds(data.features)).toEqual([[71.4, 51.1], [71.5, 51.2]]);
  });
  it.each([[NaN, 51], [71, Infinity], [510000, 5700000], [71, 90], ['71', 51]])('rejects invalid or projected coordinates %s', (...coords) => {
    expect(() => parseGeoJSON(collection([{ ...point(), geometry: { type: 'Point', coordinates: coords } }]))).toThrow('WGS84');
  });
  it('rejects unclosed polygon rings, invalid nesting and oversized collections', () => {
    expect(() => parseGeoJSON(collection([{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[71, 51], [72, 51], [72, 52], [71, 52]]] } }]))).toThrow('замкнуты');
    expect(() => parseGeoJSON(collection([{ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: [null] } }]))).toThrow('геометрия');
    expect(() => parseGeoJSON(collection(Array(50001).fill(point())))).toThrow('50 000');
    expect(() => parseGeoJSON(collection([]))).toThrow('непустая');
  });
  it('counts POIs, conserves totals and does not treat non-point geometries as population', () => {
    const p1 = point([71.430, 51.120]), p2 = point([71.4301, 51.1201]), p3 = point([71.49, 51.16]);
    const cells = densityCells([p1, p2, p3]);
    expect(cells).toHaveLength(2);
    expect(cells.map(c => c.count).sort()).toEqual([1, 2]);
    expect(densityCells([])).toEqual([]);
  });
  it('ships a valid attributable OSM snapshot with unique ids and bounded locations', () => {
    const data = parseGeoJSON(JSON.parse(readFileSync(new URL('../public/data/astana-infrastructure.geojson', import.meta.url), 'utf8')));
    expect(data.features.length).toBeGreaterThan(100);
    expect(new Set(data.features.map(f => f.id)).size).toBe(data.features.length);
    expect(data.metadata?.source).toContain('OpenStreetMap');
    expect(Date.parse(data.metadata!.osmTimestamp)).toBeGreaterThan(0);
    for (const f of data.features) {
      expect(['education', 'health']).toContain(f.properties.category);
      expect(f.properties.osmId).toMatch(/^(node|way|relation)\/\d+$/);
    }
    const bounds = geometryBounds(data.features)!;
    expect(bounds[0][0]).toBeGreaterThanOrEqual(71.18); expect(bounds[1][0]).toBeLessThanOrEqual(71.72);
    expect(bounds[0][1]).toBeGreaterThanOrEqual(50.98); expect(bounds[1][1]).toBeLessThanOrEqual(51.32);
    expect(densityCells(data.features).reduce((sum, c) => sum + c.count, 0)).toBe(data.features.length);
  });
  it('prefers a Russian name and falls back to a known amenity without inventing one', () => {
    expect(featureName(point(undefined, { name: 'School', 'name:ru': 'Школа №1' }))).toBe('Школа №1');
    expect(featureName(point(undefined, { amenity: 'hospital' }))).toBe('Больница');
    expect(featureName(point())).toBe('Объект без названия');
  });
});
