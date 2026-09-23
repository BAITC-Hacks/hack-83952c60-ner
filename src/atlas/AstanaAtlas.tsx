import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as LibreMap } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { MapLibreOverlay } from '@deck.gl/maplibre';
import { ColumnLayer, GeoJsonLayer } from '@deck.gl/layers';
import { ArrowLeft, ArrowUpRight, Box, Building2, Check, ChevronRight, Crosshair, Database, Download, Eye, EyeOff, GraduationCap, HeartPulse, Layers3, Map, MapPin, Minus, Pause, Play, Plus, Search, SlidersHorizontal, Trees, Upload, Users, Waves, X } from 'lucide-react';
import { AMENITIES, ASTANA_CENTER, CITY_BOUNDS, COLORS, CATEGORIES, densityCells, downloadGeoJSON, featureName, geometryBounds, parseGeoJSON, type AtlasDataset, type AtlasFeature, type Category, type DensityCell } from './data';
import { AtlasSwarmSimulation } from './swarm';
import { animateAtlasSwarm } from './swarmLayer';
import { PARTICLE_COUNT, POPULATION_SCALE } from '../population/data';
import 'maplibre-gl/dist/maplibre-gl.css';
import './atlas.css';

maplibregl.setWorkerUrl(workerUrl);

type BaseLayer = 'buildings' | 'roads' | 'green' | 'water' | 'labels';
const BASE_LAYERS: { id: BaseLayer; label: string; detail: string; color: string; icon: typeof Building2 }[] = [
  { id: 'buildings', label: 'Здания', detail: 'Контуры и объёмы', color: '#76b7c2', icon: Building2 },
  { id: 'roads', label: 'Уличная сеть', detail: 'Дороги и пешеходные пути', color: '#c7cfdd', icon: Map },
  { id: 'green', label: 'Зелёные территории', detail: 'Парки и землепользование', color: '#75b692', icon: Trees },
  { id: 'water', label: 'Вода', detail: 'Есиль, озёра и каналы', color: '#649dbc', icon: Waves },
  { id: 'labels', label: 'Подписи', detail: 'Улицы и ориентиры', color: '#b3baca', icon: MapPin },
];
const PRESETS = [
  { name: 'Байтерек', position: [71.4304, 51.1282] as [number, number], zoom: 15.3 },
  { name: 'Старый центр', position: [71.4278, 51.1666] as [number, number], zoom: 14 },
  { name: 'EXPO', position: [71.4155, 51.0891] as [number, number], zoom: 14.6 },
];
function groupForLayer(layer: { id: string; type: string; 'source-layer'?: string }): BaseLayer | undefined {
  if (layer.id === 'atlas-buildings' || layer['source-layer'] === 'building') return 'buildings';
  if (layer.type === 'symbol') return 'labels';
  if (/transportation/.test(layer['source-layer'] ?? '')) return 'roads';
  if (/water/.test(layer['source-layer'] ?? '')) return 'water';
  if (/landcover|landuse|park/.test(layer['source-layer'] ?? '')) return 'green';
}
const number = (n: number) => n.toLocaleString('ru-RU');

export default function AstanaAtlas() {
  const host = useRef<HTMLDivElement>(null), mapRef = useRef<LibreMap | null>(null), overlay = useRef<MapLibreOverlay | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const defaultVisibility = useRef<Record<string, NonNullable<maplibregl.LayerSpecification['layout']>['visibility']>>({});
  const [ready, setReady] = useState(false), [retry, setRetry] = useState(0), [mapError, setMapError] = useState('');
  const [dataset, setDataset] = useState<AtlasDataset | null>(null), [dataError, setDataError] = useState('');
  const [imported, setImported] = useState<{ name: string; data: AtlasDataset } | null>(null), [importVisible, setImportVisible] = useState(true);
  const [notice, setNotice] = useState(''), [selected, setSelected] = useState<{ feature: AtlasFeature; source: string } | null>(null);
  const [tab, setTab] = useState<'layers' | 'data'>('layers'), [query, setQuery] = useState(''), [searchOpen, setSearchOpen] = useState(false);
  const [base, setBase] = useState<Record<BaseLayer, boolean>>({ buildings: true, roads: true, green: true, water: true, labels: true });
  const [categories, setCategories] = useState<Record<Category, boolean>>({ education: true, health: true });
  const [mode, setMode] = useState<'points' | 'density'>('points'), [is3D, setIs3D] = useState(true), [opacity, setOpacity] = useState(.85);
  const [showSwarm, setShowSwarm] = useState(true), [swarmPaused, setSwarmPaused] = useState(false);
  const swarm = useRef<AtlasSwarmSimulation | null>(null);
  const [camera, setCamera] = useState({ lon: ASTANA_CENTER[0], lat: ASTANA_CENTER[1], zoom: 13.1 });
  const [sidebar, setSidebar] = useState(() => window.innerWidth > 800);
  const filtered = useMemo(() => (dataset?.features ?? []).filter(f => categories[f.properties.category as Category] && (!query.trim() || `${featureName(f)} ${f.properties['addr:street'] ?? ''} ${AMENITIES[String(f.properties.amenity)] ?? ''}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')))), [dataset, categories, query]);
  const cells = useMemo(() => densityCells(filtered), [filtered]);
  const counts = useMemo(() => ({ education: dataset?.features.filter(f => f.properties.category === 'education').length ?? 0, health: dataset?.features.filter(f => f.properties.category === 'health').length ?? 0 }), [dataset]);

  useEffect(() => { setSelected(null); }, [categories, mode, importVisible]);

  useEffect(() => {
    const previous = document.title;
    document.title = 'ASTANA · Карта города';
    return () => { document.title = previous; };
  }, []);

  useEffect(() => {
    const abort = new AbortController(); setDataError('');
    fetch(`${import.meta.env.BASE_URL}data/astana-infrastructure.geojson`, { signal: abort.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => setDataset(parseGeoJSON(data)))
      .catch(() => { if (!abort.signal.aborted) setDataError('Не удалось загрузить снимок инфраструктуры. Повторите загрузку.'); });
    return () => abort.abort();
  }, [retry]);

  useEffect(() => {
    if (!host.current) return;
    setReady(false); setMapError('');
    let map: LibreMap | undefined;
    let disposed = false;
    const timer = window.setTimeout(() => { if (!disposed) setMapError('Карта загружается дольше обычного. Проверьте доступ к tiles.openfreemap.org и повторите.'); }, 25000);
    try {
      map = new maplibregl.Map({ container: host.current, style: 'https://tiles.openfreemap.org/styles/dark', center: ASTANA_CENTER, zoom: 13.1, pitch: 48, bearing: -20, maxPitch: 65, minZoom: 9, maxZoom: 19, maxBounds: [[70.8, 50.7], [72.1, 51.6]], attributionControl: false });
      mapRef.current = map;
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
      map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
      map.on('error', () => { if (!disposed) setMapError('Часть картографических данных недоступна. Проверьте соединение; можно повторить загрузку.'); });
      map.on('load', () => {
        if (disposed || !map) return;
        clearTimeout(timer);
        map.setPaintProperty('water', 'fill-color', '#183347');
        map.setPaintProperty('building', 'fill-color', '#41616d');
        map.setPaintProperty('building', 'fill-opacity', .65);
        const originalLayers = map.getStyle().layers;
        defaultVisibility.current = Object.fromEntries(originalLayers.map(l => [l.id, l.layout?.visibility ?? 'visible']));
        for (const layer of originalLayers) {
          if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', '#101b23');
          if (layer.type === 'line' && groupForLayer(layer) === 'roads') map.setPaintProperty(layer.id, 'line-color', /casing/.test(layer.id) ? '#1b2a33' : '#425460');
          if (layer.type === 'symbol' && layer.layout?.['text-field']) {
            map.setPaintProperty(layer.id, 'text-color', '#a6b8bf');
            map.setPaintProperty(layer.id, 'text-halo-color', '#14212b');
            map.setPaintProperty(layer.id, 'text-halo-width', 1);
            if (layer.id !== 'highway_name_motorway') map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:ru'], ['get', 'name:nonlatin'], ['get', 'name'], ['get', 'name:latin'], '']);
          }
        }
        if (map.getLayer('landuse_park')) map.setPaintProperty('landuse_park', 'fill-color', '#203b34');
        const firstLabel = map.getStyle().layers.find(l => l.type === 'symbol')?.id;
        map.addLayer({ id: 'atlas-buildings', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 13,
          paint: { 'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8], 0, '#365360', 25, '#5c8692', 80, '#a3c6cb'],
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8], 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-opacity': .85 } }, firstLabel);
        const deck = new MapLibreOverlay({ interleaved: true, layers: [], onError: () => setMapError('Не удалось отрисовать слой deck.gl. Попробуйте перезагрузить карту.') });
        overlay.current = deck; map.addControl(deck);
        setReady(true); setMapError('');
      });
      map.on('moveend', () => { if (map) { const c = map.getCenter(); setCamera({ lon: c.lng, lat: c.lat, zoom: map.getZoom() }); } });
      map.on('pitchend', () => { if (map) setIs3D(map.getPitch() > 10); });
      map.on('click', event => {
        if (!map || overlay.current?.pickObject({ x: event.point.x, y: event.point.y, radius: 4 })) return;
        const feature = map.queryRenderedFeatures(event.point).find(f => f.source === 'openmaptiles' && f.layer.type !== 'symbol' && ['building', 'transportation', 'water', 'landuse', 'park'].includes(f.sourceLayer ?? ''));
        if (feature) setSelected({ feature: { type: 'Feature', id: feature.id, geometry: feature.geometry, properties: { ...feature.properties, tileLayer: feature.sourceLayer } }, source: 'Векторные тайлы OSM' });
        else setSelected(null);
      });
    } catch { setMapError('WebGL недоступен. Включите аппаратное ускорение браузера и повторите загрузку.'); clearTimeout(timer); }
    const resize = new ResizeObserver(() => map?.resize()); resize.observe(host.current);
    return () => { disposed = true; clearTimeout(timer); resize.disconnect(); overlay.current = null; map?.remove(); mapRef.current = null; };
  }, [retry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const layer of map.getStyle().layers) {
      const group = groupForLayer(layer);
      if (group) map.setLayoutProperty(layer.id, 'visibility', base[group] && (layer.id !== 'atlas-buildings' || is3D) ? defaultVisibility.current[layer.id] ?? 'visible' : 'none');
    }
  }, [base, ready, is3D]);

  useEffect(() => {
    if (!ready || !overlay.current) return;
    const poi = new GeoJsonLayer({ id: 'atlas-poi', data: { type: 'FeatureCollection' as const, features: filtered }, visible: mode === 'points', opacity, pickable: true, stroked: true, filled: true,
      pointType: 'circle', pointRadiusMinPixels: 4, pointRadiusMaxPixels: 12, getPointRadius: 22,
      getFillColor: (f: AtlasFeature) => COLORS[f.properties.category as Category] ?? [121, 219, 208, 230], getLineColor: [240, 240, 255, 210], getLineWidth: 1, lineWidthUnits: 'pixels',
      onClick: info => { if (info.object) setSelected({ feature: info.object, source: 'Снимок OpenStreetMap' }); return true; },
    });
    const density = new ColumnLayer<DensityCell>({ id: 'atlas-density', data: cells, visible: mode === 'density', opacity, pickable: true, diskResolution: 6, radius: 220, extruded: is3D,
      getPosition: d => d.position, getElevation: d => d.count * 65, getFillColor: d => [Math.min(225, 95 + d.count * 9), Math.max(105, 210 - d.count * 5), 230, 220],
      onClick: info => { if (info.object) setSelected({ source: 'Расчёт по отфильтрованному снимку OSM', feature: { type: 'Feature', geometry: { type: 'Point', coordinates: info.object.position }, properties: { name: 'Ячейка инфраструктуры', 'Объектов в ячейке': info.object.count, 'Размер сетки': '≈ 500 × 500 м', 'Высота столбца': '65 м на объект; условная визуализация' } } }); return true; },
    });
    const custom = new GeoJsonLayer({ id: 'atlas-import', data: imported?.data, visible: !!imported && importVisible, opacity, pickable: true, filled: true, stroked: true, getFillColor: [70, 224, 183, 110], getLineColor: [101, 245, 204, 255], lineWidthMinPixels: 2, pointRadiusMinPixels: 6,
      onClick: info => { if (info.object) setSelected({ feature: info.object, source: imported?.name ?? 'GeoJSON' }); return true; },
    });
    const highlight = new GeoJsonLayer({ id: 'atlas-selection', data: selected ? { type: 'FeatureCollection', features: [selected.feature] } : { type: 'FeatureCollection', features: [] }, pickable: false, filled: true, stroked: true, getFillColor: [122, 247, 216, 60], getLineColor: [144, 255, 221, 255], lineWidthMinPixels: 3, pointRadiusMinPixels: 10 });
    overlay.current.setProps({ getTooltip: ({ object }) => object ? { text: object.type === 'Feature' ? featureName(object) : `${object.count} объектов · ячейка ≈ 500 м`, style: { backgroundColor: '#15252c', color: '#edfff9', fontSize: '12px' } } : null });
    swarm.current ??= new AtlasSwarmSimulation();
    return animateAtlasSwarm(overlay.current, [poi, density, custom, highlight], swarm.current, { visible: showSwarm, paused: swarmPaused, opacity });
  }, [filtered, cells, mode, opacity, is3D, imported, importVisible, selected, ready, showSwarm, swarmPaused]);

  const fitCity = () => mapRef.current?.fitBounds(CITY_BOUNDS, { padding: 45, duration: 1000, pitch: 0, bearing: 0 });
  const focusFeature = (feature: AtlasFeature) => {
    setSearchOpen(false);
    setSelected({ feature, source: 'Снимок OpenStreetMap' });
    const bounds = geometryBounds([feature]); if (bounds) mapRef.current?.fitBounds(bounds, { maxZoom: 16, padding: 100, duration: 900 });
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Размер файла должен быть меньше 20 МБ.');
      const data = parseGeoJSON(JSON.parse(await file.text()));
      const bounds = geometryBounds(data.features);
      if (bounds && (bounds[0][0] < 70.8 || bounds[1][0] > 72.1 || bounds[0][1] < 50.7 || bounds[1][1] > 51.6)) throw new Error('Этот атлас предназначен для Астаны. Объекты должны находиться в пределах 70.8–72.1° E, 50.7–51.6° N.');
      setImported({ name: file.name, data }); setImportVisible(true); setSelected(null); setTab('layers');
      setNotice(`Добавлено ${number(data.features.length)} объектов. Файл остаётся в этой вкладке до её закрытия.`);
      if (bounds) mapRef.current?.fitBounds(bounds, { padding: 80, maxZoom: 16, duration: 900 });
    } catch (e) { setNotice(e instanceof SyntaxError ? 'Файл не содержит корректный JSON.' : e instanceof Error ? e.message : 'Не удалось прочитать файл.'); }
    if (fileInput.current) fileInput.current.value = '';
  };
  const exportData = () => {
    const exported: AtlasDataset = { type: 'FeatureCollection', features: [...filtered, ...(importVisible ? imported?.data.features ?? [] : [])], metadata: dataset?.metadata ? {
      ...dataset.metadata,
      description: `Filtered OSM infrastructure, © OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright.${imported && importVisible ? ` Also includes user data from ${imported.name}, under its own source terms.` : ''} Vector basemap not included.`,
    } : undefined };
    downloadGeoJSON(exported, 'astana-visible-layers.geojson');
  };
  const date = dataset?.metadata?.osmTimestamp ? new Date(dataset.metadata.osmTimestamp).toLocaleDateString('ru-RU') : '—';

  return <main className="atlas" lang="ru">
    <header className="at-header">
      <a className="at-brand" href="#/astana-map"><span className="at-logo"><Layers3 size={22} /></span><span>ASTANA<span className="at-brand-sub">CITY ATLAS</span></span><span className="at-beta">GIS / 01</span></a>
      <nav aria-label="Режим приложения"><a href="#">Аким на 5 часов</a><a href="#/digital-twin">Симулятор города</a><a href="#/population">Пульс города</a><a href="#/transport">Транспорт · 3D</a><a href="#/astana-map" aria-current="page">Карта Астаны <ArrowUpRight size={13} /></a></nav>
      <div className="at-live"><i /> Открытая география</div>
    </header>
    <div className={`at-workspace ${sidebar ? '' : 'at-collapsed'}`}>
      <aside className="at-sidebar" aria-label="Панель слоёв">
        <div className="at-project"><span className="at-eyebrow">ГОРОД КАК СИСТЕМА ДАННЫХ</span><h1>Астана<span>Казахстан <span>51°07′ N · 71°25′ E</span></span></h1><p>Исследуйте город. От здания до общей картины.</p></div>
        <div className="at-tabs" role="tablist" aria-label="Инструменты карты"><button role="tab" aria-selected={tab === 'layers'} onClick={() => setTab('layers')}><Layers3 size={15} /> Слои</button><button role="tab" aria-selected={tab === 'data'} onClick={() => setTab('data')}><Database size={15} /> Данные</button></div>
        <div className="at-side-scroll">
          {tab === 'layers' ? <>
            <div className="at-section-label">НАСЕЛЕНИЕ <span>СЦЕНАРНАЯ МОДЕЛЬ</span></div>
            <div className="at-swarm-settings">
              <button className={`at-layer ${showSwarm ? '' : 'at-muted-layer'}`} aria-label="Рой жителей" aria-pressed={showSwarm} onClick={() => setShowSwarm(v => !v)}><span className="at-layer-icon at-swarm-icon"><Users size={18} /></span><span><b>Рой жителей</b><small>{number(PARTICLE_COUNT)} частиц на улицах города</small></span>{showSwarm ? <Eye size={15} /> : <EyeOff size={15} />}</button>
              <div className="at-swarm-actions"><span>1 частица ≈ {number(POPULATION_SCALE)} жителей</span><button disabled={!showSwarm} onClick={() => setSwarmPaused(v => !v)} aria-label={swarmPaused ? 'Продолжить движение роя' : 'Приостановить движение роя'}>{swarmPaused ? <Play size={12} /> : <Pause size={12} />}{swarmPaused ? 'Продолжить' : 'Пауза'}</button></div>
              <p>Сценарная визуализация на улицах OSM, не данные о реальных поездках.</p>
            </div>
            <div className="at-section-label">БАЗОВАЯ КАРТА <span>OSM / VECTOR</span></div>
            <div className="at-layer-list at-basemap">{BASE_LAYERS.map(({ id, label, detail, color, icon: Icon }) => <button className={`at-layer ${base[id] ? '' : 'at-muted-layer'}`} key={id} title={detail} aria-pressed={base[id]} onClick={() => { setBase(s => ({ ...s, [id]: !s[id] })); setSelected(null); }}><span className="at-layer-icon" style={{ color }}><Icon size={17} /></span><span><b>{label}</b><small>{detail}</small></span>{base[id] ? <Eye size={15} /> : <EyeOff size={15} />}</button>)}</div>
            <div className="at-section-label">ИНФРАСТРУКТУРА <span>{dataset ? number(dataset.features.length) : '…'} ОБЪЕКТОВ</span></div>
            <div className="at-layer-list">{(['education', 'health'] as Category[]).map(category => <button className={`at-layer ${categories[category] ? '' : 'at-muted-layer'}`} key={category} aria-pressed={categories[category]} onClick={() => setCategories(s => ({ ...s, [category]: !s[category] }))}><span className={`at-layer-icon at-${category}`}>{category === 'education' ? <GraduationCap size={18} /> : <HeartPulse size={18} />}</span><span><b>{CATEGORIES[category]}</b><small>{number(counts[category])} объектов в снимке</small></span>{categories[category] ? <Eye size={15} /> : <EyeOff size={15} />}</button>)}</div>
            {dataError && <div className="at-inline-error" role="alert">{dataError}<button onClick={() => setRetry(r => r + 1)}>Повторить</button></div>}
            <div className="at-settings"><div className="at-section-label"><span><SlidersHorizontal size={13} /> ВИЗУАЛИЗАЦИЯ</span></div><div className="at-segment"><button aria-pressed={mode === 'points'} onClick={() => setMode('points')}>Объекты</button><button aria-pressed={mode === 'density'} onClick={() => setMode('density')}>Плотность</button></div><p>{mode === 'density' ? 'Число объектов в сетке ≈ 500 м. Это плотность инфраструктуры, не населения.' : 'Реальные точки OSM; для площадных объектов показан центр контура.'}</p><label className="at-range">Непрозрачность <span>{Math.round(opacity * 100)}%</span><input aria-label="Непрозрачность слоёв данных" type="range" min="0.15" max="1" step="0.05" value={opacity} onChange={e => setOpacity(Number(e.target.value))} /></label></div>
            {imported && <div className="at-imported"><div className="at-section-label">МОЙ СЛОЙ <button aria-label="Удалить импортированный слой" onClick={() => { setImported(null); setSelected(null); }}><X size={14} /></button></div><button className="at-layer" aria-pressed={importVisible} onClick={() => setImportVisible(v => !v)}><Database size={18} /><span><b>{imported.name}</b><small>{number(imported.data.features.length)} объектов</small></span>{importVisible ? <Eye size={15} /> : <EyeOff size={15} />}</button></div>}
            <button className="at-add-data" onClick={() => fileInput.current?.click()}><Plus size={16} /> Добавить GeoJSON <Upload size={14} /></button>
          </> : <div className="at-data-panel"><span className="at-eyebrow">ПРОИСХОЖДЕНИЕ ДАННЫХ</span><h2>Реальная география.<br />Открытые источники.</h2><article><Map size={20} /><h3>Картографическая основа</h3><p>Векторные тайлы OpenFreeMap на основе OpenStreetMap. Улицы, здания, вода и землепользование подгружаются по масштабу для всей территории карты.</p><a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap <ArrowUpRight size={12} /></a></article><article><Database size={20} /><h3>Инфраструктура · {number(dataset?.features.length ?? 0)}</h3><p>Снимок объектов образования и медицины OSM в прямоугольнике 71.18–71.72° E, 50.98–51.32° N. Дата базы: {date}. Это не полный реестр и не административная граница.</p><p>Объекты OSM могут пересекаться: например, здание и учреждение на одной территории. Число объектов не равно числу организаций.</p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap · ODbL <ArrowUpRight size={12} /></a></article><article><Box size={20} /><h3>Как устроен 3D-вид</h3><p>Контуры зданий привязаны к координатам. Высоты берутся из тайлов и могут быть оценочными; при отсутствии значения используется 8 м. Это не кадастровая или архитектурная модель.</p></article><article><Upload size={20} /><h3>Ваши городские данные</h3><p>GeoJSON в WGS84, до 20 МБ и 50 000 объектов. Точки, линии, полигоны и Multi-геометрии в пределах Астаны. Импорт локальный и не сохраняется после ухода из вкладки.</p></article><button className="at-add-data" onClick={() => fileInput.current?.click()}><Plus size={16} /> Загрузить GeoJSON</button></div>}
        </div>
        <div className="at-side-footer"><span><i /> MapLibre + deck.gl</span><button onClick={exportData} disabled={!dataset && !imported} title="Экспорт отфильтрованной инфраструктуры и включённого импортированного слоя"><Download size={14} /> GeoJSON</button></div>
      </aside>
      <section className="at-map-area" aria-label="Интерактивная карта Астаны">
        <div className="at-map-canvas" ref={host} />
        <div className="at-map-top"><button className="at-square" aria-label={sidebar ? 'Скрыть панель слоёв' : 'Показать панель слоёв'} onClick={() => setSidebar(s => !s)}>{sidebar ? <ArrowLeft size={17} /> : <Layers3 size={17} />}</button><div className="at-search"><Search size={17} /><input aria-label="Поиск по инфраструктуре" value={query} onFocus={() => setSearchOpen(true)} onKeyDown={e => { if (e.key === 'Escape') setSearchOpen(false); }} onChange={e => { setQuery(e.target.value); setSearchOpen(true); setSelected(null); }} placeholder="Найти школу, клинику, университет…" />{query && <button aria-label="Очистить поиск" onClick={() => { setQuery(''); setSearchOpen(false); }}><X size={14} /></button>}
          {searchOpen && query.trim() && <div className="at-search-results"><small>Найдено: {number(filtered.length)} · в активных слоях</small>{filtered.slice(0, 7).map((f, i) => <button key={String(f.id ?? i)} onClick={() => focusFeature(f)}><MapPin size={14} /><span>{featureName(f)}<small>{AMENITIES[String(f.properties.amenity)]}</small></span><ChevronRight size={13} /></button>)}{!filtered.length && <p>В снимке нет совпадений. Попробуйте другое название или включите слой.</p>}</div>}
        </div><button className="at-city-button" onClick={fitCity}><Crosshair size={15} /> Весь город</button></div>
        <div className="at-map-caption"><span className="at-eyebrow">ASTANA / SPATIAL EXPLORER</span><h2>{showSwarm ? 'Город в движении.' : 'Город в деталях.'}</h2><p>{showSwarm ? 'Рой жителей на карте Астаны.' : 'Реальные контуры. Новые связи.'}</p></div>
        <div className="at-presets">{PRESETS.map(p => <button key={p.name} onClick={() => mapRef.current?.flyTo({ center: p.position, zoom: p.zoom, pitch: is3D ? 48 : 0, duration: 1200 })}><MapPin size={12} />{p.name}</button>)}</div>
        <div className="at-swarm-toolbar" aria-label="Управление роем">
          <button className={showSwarm ? 'at-swarm-enabled' : ''} aria-label={showSwarm ? 'Скрыть рой жителей' : 'Показать рой жителей'} aria-pressed={showSwarm} onClick={() => setShowSwarm(v => !v)}><Users size={14} /> Рой <b>{number(PARTICLE_COUNT)}</b></button>
          {showSwarm && <button aria-label={swarmPaused ? 'Запустить рой' : 'Пауза роя'} aria-pressed={swarmPaused} onClick={() => setSwarmPaused(v => !v)}>{swarmPaused ? <Play size={13} /> : <Pause size={13} />}<span>{swarmPaused ? 'Продолжить' : 'Пауза'}</span></button>}
        </div>
        <div className="at-map-controls"><button className="at-square" aria-label="Приблизить карту" onClick={() => mapRef.current?.zoomIn()}><Plus size={19} /></button><button className="at-square" aria-label="Отдалить карту" onClick={() => mapRef.current?.zoomOut()}><Minus size={19} /></button><span /><button className="at-square at-north" aria-label="Ориентировать карту на север" onClick={() => mapRef.current?.easeTo({ bearing: 0, duration: 600 })}>N<span>↑</span></button><button className={`at-square ${is3D ? 'at-control-active' : ''}`} aria-label="Трёхмерный вид" aria-pressed={is3D} onClick={() => { setIs3D(v => !v); mapRef.current?.easeTo({ pitch: is3D ? 0 : 48, duration: 700 }); }}>{is3D ? '3D' : '2D'}</button></div>
        {!ready && !mapError && <div className="at-loading" role="status"><div className="at-loader" />Загружаем географию Астаны…</div>}
        {mapError && <div className="at-map-error" role="alert"><strong>Карта доступна не полностью</strong><p>{mapError}</p><button onClick={() => setRetry(r => r + 1)}>Повторить загрузку</button></div>}
        {notice && <div className="at-notice" role="status"><span>{notice}</span><button aria-label="Закрыть уведомление" onClick={() => setNotice('')}><X size={15} /></button></div>}
        {selected && <div className="at-inspector"><div className="at-section-label">КАРТОЧКА ОБЪЕКТА <button aria-label="Закрыть карточку объекта" onClick={() => setSelected(null)}><X size={16} /></button></div><h3>{featureName(selected.feature)}</h3><span className="at-source-tag">{selected.source}</span><dl>{Object.entries(selected.feature.properties).filter(([, value]) => value !== null && value !== '').slice(0, 24).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd></div>)}</dl>{selected.source === 'Векторные тайлы OSM' && <p className="at-inspector-note">Геометрия может быть обрезана границей тайла. render_height — высота из тайлов, в том числе оценочная.</p>}{typeof selected.feature.properties.osmId === 'string' && /^(node|way|relation)\/\d+$/.test(selected.feature.properties.osmId) && <a href={`https://www.openstreetmap.org/${selected.feature.properties.osmId}`} target="_blank" rel="noreferrer">Открыть объект в OpenStreetMap <ArrowUpRight size={13} /></a>}</div>}
        <div className="at-map-bottom"><div className="at-legend-stack">{showSwarm && <div className="at-legend at-swarm-legend" aria-label="Виды потоков роя"><span><i className="at-dot-car" /> Автомобили</span><span><i className="at-dot-bus" /> Автобусы</span><span><i className="at-dot-school" /> С детьми</span><small>{number(PARTICLE_COUNT)} частиц · сценарная модель{swarmPaused ? ' · пауза' : ''}</small></div>}<div className="at-legend">{mode === 'points' ? <><span><i className="at-dot-education" /> Образование</span><span><i className="at-dot-health" /> Медицина</span></> : <><span className="at-density-key"><i /> {cells.length ? 1 : 0}–{Math.max(0, ...cells.map(c => c.count))} объектов в ячейке</span><small>Сетка ≈ 500 м · высота: 65 м на объект</small></>}</div></div><div className="at-map-stats"><span><b>{number(filtered.length)}</b> объектов после фильтра</span><span><Check size={13} /> WGS 84</span><span>OSM · {date}</span></div></div>
      </section>
    </div>
    <footer className="at-status"><span><i className={ready && !mapError ? 'at-status-ok' : ''} />{mapError ? 'Ошибка загрузки карты' : ready ? 'Карта подключена' : 'Подключение к карте…'}</span><span>Объекты OSM · полнота зависит от источника</span><span>{camera.lat.toFixed(4)}° N &nbsp; {camera.lon.toFixed(4)}° E <b>z {camera.zoom.toFixed(1)}</b></span></footer>
    <input ref={fileInput} type="file" accept=".geojson,.json,application/geo+json,application/json" hidden onChange={e => void importFile(e.target.files?.[0])} />
  </main>;
}
