import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';

export type Category = 'education' | 'health';
export type AtlasFeature = Feature<Geometry, Record<string, unknown>>;
export interface AtlasDataset extends FeatureCollection<Geometry, Record<string, unknown>> {
  metadata?: { source: string; fetchedAt: string; osmTimestamp: string; bbox: number[]; description: string };
}
export const ASTANA_CENTER: [number, number] = [71.4304, 51.1282];
export const CITY_BOUNDS: [[number, number], [number, number]] = [[71.18, 50.98], [71.72, 51.32]];
export const COLORS: Record<Category, [number, number, number, number]> = {
  education: [163, 141, 255, 230], health: [255, 140, 117, 230],
};
export const CATEGORIES = { education: 'Образование', health: 'Медицина' };
export const AMENITIES: Record<string, string> = { school: 'Школа', kindergarten: 'Детский сад', university: 'Университет', college: 'Колледж', hospital: 'Больница', clinic: 'Клиника', doctors: 'Врачебная практика' };
export function featureName(feature: AtlasFeature) {
  const p = feature.properties ?? {};
  return String(p['name:ru'] || p.name || p['name:kk'] || AMENITIES[String(p.amenity)] || p.class || 'Объект без названия');
}

/** Strict, bounded WGS84 input: reject malformed geometry before it reaches WebGL. */
export function parseGeoJSON(value: unknown): AtlasDataset {
  if (!value || typeof value !== 'object') throw new Error('Ожидается GeoJSON FeatureCollection.');
  const data = value as AtlasDataset;
  if (data.type !== 'FeatureCollection' || !Array.isArray(data.features) || !data.features.length) throw new Error('Нужна непустая коллекция GeoJSON FeatureCollection.');
  if (data.features.length > 50000) throw new Error('Максимум 50 000 объектов в одном файле.');
  let positions = 0;
  const position = (p: unknown) => {
    if (!Array.isArray(p) || p.length < 2 || p.length > 3 || p.some(v => typeof v !== 'number' || !Number.isFinite(v)) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 85.051129) throw new Error('Координаты должны быть WGS84: [долгота, широта], широта в пределах ±85.05°.');
    if (++positions > 500000) throw new Error('Слишком сложная геометрия: максимум 500 000 вершин.');
  };
  const line = (p: unknown, ring = false) => {
    if (!Array.isArray(p) || p.length < (ring ? 4 : 2)) throw new Error('Недостаточно вершин в линии или полигоне.');
    p.forEach(position);
    if (ring && (p[0][0] !== p[p.length - 1][0] || p[0][1] !== p[p.length - 1][1])) throw new Error('Кольца полигонов должны быть замкнуты.');
  };
  const list = (p: unknown, fn: (p: unknown) => void) => {
    if (!Array.isArray(p) || !p.length) throw new Error('Пустая геометрия не поддерживается.');
    p.forEach(fn);
  };
  data.features.forEach(f => {
    if (!f || f.type !== 'Feature' || !f.geometry || (f.properties !== null && (typeof f.properties !== 'object' || Array.isArray(f.properties)))) throw new Error('Каждый Feature должен содержать geometry и properties (объект или null).');
    if (f.properties === null) f.properties = {};
    const g = f.geometry;
    switch (g.type) {
      case 'Point': position(g.coordinates); break;
      case 'MultiPoint': list(g.coordinates, position); break;
      case 'LineString': line(g.coordinates); break;
      case 'MultiLineString': list(g.coordinates, p => line(p)); break;
      case 'Polygon': list(g.coordinates, p => line(p, true)); break;
      case 'MultiPolygon': list(g.coordinates, p => list(p, ring => line(ring, true))); break;
      default: throw new Error('Поддерживаются Point, LineString, Polygon и их Multi-варианты.');
    }
  });
  return data;
}

export function geometryBounds(features: AtlasFeature[]): [[number, number], [number, number]] | null {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  const walk = (coords: Position | Position[] | Position[][] | Position[][][]) => {
    if (typeof coords[0] === 'number') {
      const [lon, lat] = coords as Position;
      west = Math.min(west, lon); east = Math.max(east, lon); south = Math.min(south, lat); north = Math.max(north, lat);
    } else for (const next of coords) walk(next as Position);
  };
  features.forEach(f => { if (f.geometry.type !== 'GeometryCollection') walk(f.geometry.coordinates); });
  return Number.isFinite(west) ? [[west, south], [east, north]] : null;
}

export interface DensityCell { position: [number, number]; count: number }
/** Approx. 500 m grid at Astana's latitude, counting mapped POIs, never population. */
export function densityCells(features: AtlasFeature[]): DensityCell[] {
  const cells = new Map<string, DensityCell>();
  for (const f of features) {
    if (f.geometry.type !== 'Point') continue;
    const [lon, lat] = f.geometry.coordinates;
    const x = Math.floor((lon - 71) / .00715), y = Math.floor((lat - 51) / .0045), key = `${x}:${y}`;
    const cell = cells.get(key) ?? { position: [71 + (x + .5) * .00715, 51 + (y + .5) * .0045], count: 0 };
    cell.count++; cells.set(key, cell);
  }
  return [...cells.values()];
}

export function downloadGeoJSON(data: FeatureCollection, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/geo+json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
