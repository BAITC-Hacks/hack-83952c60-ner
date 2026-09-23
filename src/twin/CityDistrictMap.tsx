import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowDownRight, BusFront, ChevronDown, Crosshair, Layers3, Leaf, Minus, Pause, Play, Settings2, ShieldCheck, UserRound, Users, UtilityPole, HeartPulse } from 'lucide-react';
import { DISTRICTS } from '../data/districts';
import { DistrictId } from '../engine/types';
import { City } from './model';
import { DISTRICT_SHAPES, MAP_LAYERS, MapLayer, mapDistricts, trafficProfile } from './mapData';
import type { DistrictScene, SceneSettings } from './districtScene';
import './district-map.css';

const ICONS = { population: Users, transport: BusFront, ecology: Leaf, social: HeartPulse, safety: ShieldCheck, services: UtilityPole };
const format = (n: number, digits = 1) => n.toLocaleString('ru-RU', { maximumFractionDigits: digits });
const DEFAULT_SETTINGS: SceneSettings = { motion: true, agents: true, hexagons: true, bloom: true };

export default function CityDistrictMap({ city, baseline, selected, onSelect, active }: {
  city: City; baseline: City; selected: DistrictId; onSelect: (id: DistrictId) => void; active: boolean;
}) {
  const [layer, setLayer] = useState<MapLayer>('transport');
  const [reference, setReference] = useState(true);
  const [hovered, setHovered] = useState<DistrictId | null>(null);
  const [open, setOpen] = useState<'layers' | 'settings' | 'account' | null>(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [reduced, setReduced] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const host = useRef<HTMLDivElement>(null), root = useRef<HTMLDivElement>(null);
  const scene = useRef<DistrictScene | null>(null);
  const lines = useRef<Partial<Record<DistrictId, SVGPathElement | null>>>({});
  const pins = useRef<Partial<Record<DistrictId, SVGCircleElement | null>>>({});
  const cards = useRef<Partial<Record<DistrictId, HTMLButtonElement | null>>>({});
  const data = useMemo(() => mapDistricts(city, baseline, layer, reference), [city, baseline, layer, reference]);
  const current = useRef({ data, selected, hovered, settings, active, reduced, onSelect });
  current.current = { data, selected, hovered, settings, active, reduced, onSelect };
  const LayerIcon = ICONS[layer];
  const animated = settings.motion && !reduced && active;
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    setReduced(media.matches);
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(null); root.current?.querySelector<HTMLButtonElement>(`[data-popup="${open}"]`)?.focus(); } };
    const outside = (e: PointerEvent) => { if (!(e.target as Element).closest('.dt-popup-anchor')) setOpen(null); };
    document.addEventListener('keydown', close); document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', outside); };
  }, [open]);
  useEffect(() => {
    if (!active || !host.current) return;
    if (!window.WebGL2RenderingContext) { setState('fallback'); return; }
    let cancelled = false;
    setState('loading');
    import('./districtScene').then(({ createDistrictScene }) => {
      if (cancelled || !host.current) return;
      try {
        scene.current = createDistrictScene(host.current, current.current.data, { ...current.current.settings, motion: current.current.settings.motion && !current.current.reduced },
          setHovered, id => current.current.onSelect(id), (id, x, y) => {
            const card = cards.current[id], line = lines.current[id], pin = pins.current[id];
            if (!card || !line) return;
            if (window.innerWidth > 1100) {
              const left = ['saryarka', 'nura', 'esil'].includes(id);
              const cx = card.offsetLeft + (left ? card.offsetWidth : 0), cy = card.offsetTop + card.offsetHeight / 2;
              line.setAttribute('d', `M${cx},${cy} L${cx + (left ? 22 : -22)},${cy} L${x},${y}`);
            } else {
              const top = DISTRICT_SHAPES.find(s => s.id === id)!.slot < 3;
              const cx = card.offsetLeft + card.offsetWidth / 2, cy = card.offsetTop + (top ? card.offsetHeight : 0);
              line.setAttribute('d', `M${cx},${cy} L${cx},${cy + (top ? 16 : -16)} L${x},${y}`);
            }
            pin?.setAttribute('cx', String(x)); pin?.setAttribute('cy', String(y));
          }, () => { scene.current?.dispose(); scene.current = null; setState('fallback'); });
        const c = current.current;
        scene.current.update(c.data, c.selected, c.hovered, { ...c.settings, motion: c.settings.motion && !c.reduced });
        setState('ready');
      } catch { host.current.replaceChildren(); setState('fallback'); }
    }).catch(() => { if (!cancelled) setState('fallback'); });
    return () => { cancelled = true; scene.current?.dispose(); scene.current = null; };
  }, [active]);
  useEffect(() => { scene.current?.update(data, selected, hovered, { ...settings, motion: animated }); }, [data, selected, hovered, settings, animated]);
  const unit = layer === 'transport' ? '%' : layer === 'population' ? 'чел.' : '/ 100';
  const count = data.reduce((total, d) => total + trafficProfile(d.load).count, 0);
  return <div className={`dt-map ${animated ? '' : 'dt-still'}`} ref={root}>
    <header className="dt-header">
      <div className="dt-title"><span className="dt-logo"><Layers3 size={23} strokeWidth={1.4} /></span><div><span className="dt-kicker">ASTANA / DIGITAL TWIN</span><h2>Город в разрезе<span className="dt-version" aria-hidden="true">06</span></h2></div></div>
      <div className="dt-header-actions">
        <div className="dt-popup-anchor dt-layer-control">
          <span className="dt-field-label">Слой карты:</span>
          <button className="dt-layer-trigger" data-popup="layers" aria-expanded={open === 'layers'} aria-controls="dt-layer-menu" onClick={() => setOpen(open === 'layers' ? null : 'layers')}><LayerIcon size={16} /><span>{MAP_LAYERS[layer]}</span><ChevronDown size={14} className={open === 'layers' ? 'dt-rotated' : ''} /></button>
          <select className="dt-sr-only" tabIndex={-1} aria-label="Слой карты" value={layer} onChange={e => setLayer(e.target.value as MapLayer)}>{Object.entries(MAP_LAYERS).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select>
          {open === 'layers' && <div className="dt-popover dt-layer-menu" id="dt-layer-menu" aria-label="Слои карты">{(Object.entries(MAP_LAYERS) as [MapLayer, string][]).map(([id, label]) => {
            const Icon = ICONS[id]; return <button key={id} aria-pressed={layer === id} onClick={() => { setLayer(id); setOpen(null); root.current?.querySelector<HTMLButtonElement>('[data-popup="layers"]')?.focus(); }}><Icon size={17} /><span>{label}</span>{id === layer && <span className="dt-check">●</span>}</button>;
          })}</div>}
        </div>
        <div className="dt-header-divider" />
        <div className="dt-popup-anchor"><button className="dt-icon-button" data-popup="settings" aria-label="Настройки визуализации" aria-expanded={open === 'settings'} onClick={() => setOpen(open === 'settings' ? null : 'settings')}><Settings2 size={19} /></button>
          {open === 'settings' && <div className="dt-popover dt-settings"><strong>Визуализация</strong>{([['agents','Транспортные агенты'],['hexagons','Соты при наведении'],['bloom','Неоновое свечение']] as const).map(([id, label]) => <label key={id}><span>{label}</span><input type="checkbox" checked={settings[id]} onChange={e => setSettings(s => ({ ...s, [id]: e.target.checked }))} /></label>)}<small>Наведение поднимает район. Нажатие выбирает его для управления.</small></div>}
        </div>
        <div className="dt-popup-anchor"><button className="dt-icon-button dt-account" data-popup="account" aria-label="Профиль оператора" aria-expanded={open === 'account'} onClick={() => setOpen(open === 'account' ? null : 'account')}><UserRound size={18} /><i /></button>
          {open === 'account' && <div className="dt-popover dt-settings"><strong>Оператор города</strong><p>Локальная сессия · Астана</p><small>Сценарии сохраняются в этом браузере.</small></div>}
        </div>
      </div>
    </header>
    <div className="dt-stage" aria-label={`Схематическая карта: ${MAP_LAYERS[layer]}`}>
      <div className="dt-stage-status"><span><i className="dt-status-dot" />{reference && layer === 'transport' ? 'ЗАФИКСИРОВАННЫЙ СРЕЗ' : `СЦЕНАРИЙ / МЕСЯЦ ${city.month}`}</span><span>АСТАНА · KZ <span className="dt-status-coords">51.1694° N / 71.4491° E</span></span></div>
      <div ref={host} className="dt-canvas" />
      {state !== 'ready' && <div className="dt-fallback"><svg viewBox="0 0 650 440" aria-hidden="true"><g transform="translate(0 90) scale(1 .7)">{DISTRICT_SHAPES.map(s => {
        const metric = data.find(d => d.id === s.id)!;
        return <g key={s.id} style={{ color: metric.color }}><polygon points={s.points.map(([x,y]) => `${x},${y+15}`).join(' ')} fill="#0d202c" stroke="currentColor" /><polygon points={s.points.map(p => p.join(',')).join(' ')} fill="#0c1821" stroke="currentColor" /></g>;
      })}</g></svg><span>{state === 'loading' ? 'Инициализация 3D-сцены…' : 'Упрощённый вид · WebGL недоступен'}</span></div>}
      <div className="dt-vignette" />
      <svg className="dt-leaders" aria-hidden="true" style={{ opacity: state === 'ready' ? 1 : 0 }}>{data.map(d => <g key={d.id} style={{ color: d.color }} className={hovered === d.id || selected === d.id ? 'is-active' : ''}><path ref={node => { lines.current[d.id] = node; }} /><circle ref={node => { pins.current[d.id] = node; }} r="3" /></g>)}</svg>
      <div className="dt-card-layer">{data.map((d, i) => {
        const focus = hovered === d.id || selected === d.id;
        return <button key={d.id} ref={node => { cards.current[d.id] = node; }} className={`dt-district-card dt-slot-${i} ${focus ? 'is-active' : ''}`} style={{ '--district-color': d.color } as React.CSSProperties}
          aria-label={`Район ${DISTRICTS[d.id].nameRu}`} aria-pressed={selected === d.id} onClick={() => onSelect(d.id)} onPointerEnter={() => setHovered(d.id)} onPointerLeave={() => setHovered(null)} onFocus={() => setHovered(d.id)} onBlur={() => setHovered(null)}>
          <span className="dt-card-heading"><span>{DISTRICTS[d.id].nameRu}</span><span className="dt-district-code">0{i + 1}<i /></span></span>
          <span className="dt-number" key={`${layer}-${reference}-${d.value}`}><span className="dt-number-roll">{format(d.value, layer === 'population' ? 0 : 1)}</span><small>{unit}</small></span>
          <span className={`dt-delta ${d.delta < 0 && layer === 'transport' ? 'is-improved' : ''}`}>{d.delta < 0 && layer === 'transport' ? <ArrowDownRight size={13} /> : <Minus size={12} />}<span>({d.delta > 0 ? '+' : ''}{format(d.delta, layer === 'population' ? 0 : 1)} к базе)</span><span className="dt-card-bars">▂▃▅▃▆</span></span>
        </button>;
      })}</div>
      <div className="dt-orientation" aria-hidden="true"><span>N</span><Crosshair size={30} strokeWidth={.8} /><span>45° / ISO</span></div>
      <div className="dt-water-label">ИШИМ <span>/ ВОДНАЯ АРТЕРИЯ</span></div>
      <div className="dt-scene-bottom"><span><span className="dt-live-dot" />{count} АГЕНТОВ <span className="dt-agent-types"><i /> АВТО <i /> АВТОБУСЫ</span></span><button className="dt-motion-button" aria-label={animated ? 'Приостановить анимацию карты' : 'Возобновить анимацию карты'} disabled={reduced} onClick={() => setSettings(s => ({ ...s, motion: !s.motion }))}>{animated ? <Pause size={12} /> : <Play size={12} />}{reduced ? 'БЕЗ АНИМАЦИИ' : animated ? 'ПОТОК АКТИВЕН' : 'ПОТОК НА ПАУЗЕ'}</button></div>
    </div>
    <footer className="dt-footer">
      <div className="dt-legend"><span className="dt-legend-title">[ {layer === 'transport' ? 'ИНДЕКС НАГРУЗКИ' : MAP_LAYERS[layer].toUpperCase()} ]</span>
        {layer === 'population' ? <span className="dt-legend-item" style={{ '--legend-color': '#65dce9' } as React.CSSProperties}><i />Число жителей</span> : <>{(layer === 'transport' ? [['#56efb0','<100%'],['#ffc466','100–140%'],['#ff5268','>140%']] : [['#ff5268','<45'],['#ffc466','45–65'],['#56efb0','≥65']]).map(([color, label]) => <span className="dt-legend-item" style={{ '--legend-color': color } as React.CSSProperties} key={color}><i />{label}</span>)}<span className="dt-better">{layer === 'transport' ? 'Меньше — лучше.' : 'Больше — лучше.'}</span></>}
      </div>
      <div className="dt-source">{layer === 'transport' && <><button aria-pressed={reference} onClick={() => setReference(true)}>Срез из задания</button><button aria-pressed={!reference} onClick={() => setReference(false)}>Текущий сценарий</button></>}<span title="Границы районов условные"><Activity size={12} /> УСЛОВНАЯ ГЕОМЕТРИЯ</span></div>
    </footer>
  </div>;
}
