import { DistrictId } from '../engine/types';
import { City, LABELS } from './model';

export type MapLayer = 'population' | 'transport' | 'ecology' | 'social' | 'safety' | 'services';
export const MAP_LAYERS: Record<MapLayer, string> = { ...LABELS, population: 'Население', transport: 'Нагрузка транспорта' };
export const MAP_COLORS = { green: '#56efb0', amber: '#ffc466', red: '#ff5268', cyan: '#65dce9' };
export interface MapDistrict { id: DistrictId; value: number; delta: number; load: number; color: string }
export const DISTRICT_SHAPES: { id: DistrictId; points: [number, number][]; anchor: [number, number]; slot: number }[] = [
  { id: 'saryarka', points: [[65,55],[250,40],[280,150],[180,205],[45,160]], anchor: [160,113], slot: 0 },
  { id: 'baikonur', points: [[260,40],[425,65],[425,200],[290,155]], anchor: [343,118], slot: 1 },
  { id: 'almaty', points: [[437,70],[610,105],[585,260],[437,205]], anchor: [520,167], slot: 2 },
  { id: 'nura', points: [[47,177],[177,220],[255,290],[215,405],[65,345]], anchor: [147,292], slot: 3 },
  { id: 'esil', points: [[190,220],[289,172],[425,220],[407,380],[230,408],[272,285]], anchor: [330,290], slot: 4 },
  { id: 'saraishyk', points: [[439,224],[586,280],[560,400],[422,380]], anchor: [500,320], slot: 5 },
];
export const REFERENCE_TRAFFIC: Record<DistrictId, { value: number; delta: number }> = {
  saryarka: { value: 79.6, delta: -49 }, baikonur: { value: 128.6, delta: 0 },
  almaty: { value: 132.9, delta: 0 }, saraishyk: { value: 132.9, delta: 0 },
  esil: { value: 140.2, delta: 0 }, nura: { value: 152, delta: 0 },
};
export function mapColor(value: number, layer: MapLayer) {
  if (layer === 'population') return MAP_COLORS.cyan;
  if (layer === 'transport') return value < 100 ? MAP_COLORS.green : value <= 140 ? MAP_COLORS.amber : MAP_COLORS.red;
  return value < 45 ? MAP_COLORS.red : value < 65 ? MAP_COLORS.amber : MAP_COLORS.green;
}
export function mapDistricts(city: City, baseline: City, layer: MapLayer, reference: boolean): MapDistrict[] {
  return DISTRICT_SHAPES.map(({ id }) => {
    const current = city.districts[id], base = baseline.districts[id];
    const metric = (d: typeof current) => layer === 'transport' ? d.load : layer === 'population' ? d.population : d.quality[layer];
    const data = reference && layer === 'transport' ? REFERENCE_TRAFFIC[id] : { value: metric(current), delta: metric(current) - metric(base) };
    return { id, ...data, load: reference && layer === 'transport' ? data.value : current.load, color: mapColor(data.value, layer) };
  });
}
/** Density is proportional to load; the requested Nura slice has twice Saryarka's agents. */
export function trafficProfile(load: number) {
  return { count: Math.max(14, Math.min(224, Math.round(load / 20) * 14)), speed: Math.max(.018, .105 * Math.min(1, 80 / Math.max(1, load)) ** 2) };
}
