import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowDownRight, BusFront, ChevronDown, Crosshair, Layers3, Leaf, Minus, Pause, Play, Settings2, ShieldCheck, UserRound, Users, UtilityPole, HeartPulse, X, RotateCcw, Check, ArrowUpRight } from 'lucide-react';
import { DISTRICTS } from '../data/districts';
import { DistrictId } from '../engine/types';
import { City } from './model';
import { DISTRICT_SHAPES, MAP_LAYERS, MapLayer, mapDistricts, trafficProfile, mapColor } from './mapData';
import { AUDIT_ACTIONS, AuditAction, applyAuditAction, auditDistrict, initialAuditState } from './mapAudit';
import AnimatedMetric from './AnimatedMetric';
import DistrictFlows, { DistrictFlowsHandle, flowLabel } from './DistrictFlows';
import type { DistrictScene, SceneSettings } from './districtScene';
import './district-map.css';
import './district-audit.css';
import { getLanguage, t, useLanguage } from '../i18n';
import { ChartTooltip } from '../components/ChartTooltip';

const ICONS = { population: Users, transport: BusFront, ecology: Leaf, social: HeartPulse, safety: ShieldCheck, services: UtilityPole };
const format = (n: number, digits = 1) => n.toLocaleString(getLanguage(), { maximumFractionDigits: digits });
const DEFAULT_SETTINGS: SceneSettings = { motion: true, agents: true, hexagons: true, bloom: true };

export default function CityDistrictMap({ city, baseline, selected, onSelect, active }: {
  city: City; baseline: City; selected: DistrictId; onSelect: (id: DistrictId) => void; active: boolean;
}) {
  useLanguage();
  const [layer, setLayer] = useState<MapLayer>('transport');
  const [reference, setReference] = useState(true);
  const [focused, setFocused] = useState<DistrictId | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [audit, setAudit] = useState(initialAuditState);
  const [toast, setToast] = useState<{ district: DistrictId; reduction: number; action: AuditAction } | null>(null);
  const [hovered, setHovered] = useState<DistrictId | null>(null);
  const [open, setOpen] = useState<'layers' | 'settings' | 'account' | null>(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [reduced, setReduced] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const host = useRef<HTMLDivElement>(null), root = useRef<HTMLDivElement>(null);
  const scene = useRef<DistrictScene | null>(null);
  const flows = useRef<DistrictFlowsHandle>(null);
  const drawer = useRef<HTMLElement>(null);
  const lines = useRef<Partial<Record<DistrictId, SVGPathElement | null>>>({});
  const pins = useRef<Partial<Record<DistrictId, SVGCircleElement | null>>>({});
  const cards = useRef<Partial<Record<DistrictId, HTMLButtonElement | null>>>({});
  const data = useMemo(() => mapDistricts(city, baseline, layer, reference).map(district => {
    const reduction = Math.min(district.load, auditDistrict(district.id, audit).loadReduction);
    const value = layer === 'transport' ? district.value - reduction : district.value;
    return { ...district, load: district.load - reduction, value, delta: district.delta - (layer === 'transport' ? reduction : 0), color: mapColor(value, layer) };
  }), [city, baseline, layer, reference, audit]);
  const selectDistrict = (id: DistrictId) => { setFocused(id); setFocusRequest(value => value + 1); setToast(null); onSelect(id); };
  const clearFocus = () => { setFocused(null); setHovered(null); setToast(null); if (focused) cards.current[focused]?.focus(); };
  const current = useRef({ data, focused, hovered, settings, active, reduced, selectDistrict, clearFocus });
  current.current = { data, focused, hovered, settings, active, reduced, selectDistrict, clearFocus };
  const LayerIcon = ICONS[layer];
  const animated = settings.motion && !reduced && active;
  const focusedMetric = data.find(d => d.id === focused);
  const details = focused ? auditDistrict(focused, audit) : null;
  const focusLoad = focusedMetric?.load ?? 0;
  const focusColor = mapColor(focusLoad, 'transport');
  const changed = audit.remainingBudget < initialAuditState().remainingBudget;
  const build = (action: AuditAction) => {
    if (!focused) return;
    const next = applyAuditAction(audit, focused, action);
    if (next === audit) return;
    setAudit(next);
    setToast({ district: focused, action, reduction: auditDistrict(focused, next).bridgeReduction });
  };
  useEffect(() => {
    if (focusRequest && current.current.active) drawer.current?.focus({ preventScroll: true });
  }, [focusRequest]);
  useEffect(() => {
    if (!focused || !active) return;
    const escape = (event: KeyboardEvent) => {
      const hintOpen = drawer.current?.querySelector('.chart-tooltip-target[aria-describedby]');
      if (event.key === 'Escape' && !open && !hintOpen) current.current.clearFocus();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [focused, active, open]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6500);
    return () => window.clearTimeout(timer);
  }, [toast]);
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
          setHovered, id => current.current.selectDistrict(id), (id, x, y) => {
            flows.current?.project(id, x, y);
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
          }, () => { scene.current?.dispose(); scene.current = null; setState('fallback'); }, () => current.current.clearFocus());
        const c = current.current;
        scene.current.update(c.data, c.focused, c.hovered, { ...c.settings, motion: c.settings.motion && !c.reduced });
        setState('ready');
      } catch { host.current.replaceChildren(); setState('fallback'); }
    }).catch(() => { if (!cancelled) setState('fallback'); });
    return () => { cancelled = true; scene.current?.dispose(); scene.current = null; };
  }, [active]);
  useEffect(() => { scene.current?.update(data, focused, hovered, { ...settings, motion: animated }); }, [data, focused, hovered, settings, animated]);
  const unit = layer === 'transport' ? '%' : layer === 'population' ? t('чел.') : '/ 100';
  const count = data.reduce((total, d) => total + trafficProfile(d.load).count, 0);
  return <div className={`dt-map ${focused ? 'dt-has-focus' : ''} ${animated ? '' : 'dt-still'}`} ref={root}>
    <header className="dt-header">
      <div className="dt-title"><span className="dt-logo"><Layers3 size={23} strokeWidth={1.4} /></span><div><span className="dt-kicker">{t('АСТАНА / ЦИФРОВОЙ ДВОЙНИК')}</span><h2>{t('Город в разрезе')}<span className="dt-version" aria-hidden="true">06</span></h2></div></div>
      <div className="dt-header-actions">
        <div className="dt-popup-anchor dt-layer-control">
          <span className="dt-field-label">{t('Слой карты')}:</span>
          <button className="dt-layer-trigger" data-popup="layers" aria-expanded={open === 'layers'} aria-controls="dt-layer-menu" onClick={() => setOpen(open === 'layers' ? null : 'layers')}><LayerIcon size={16} /><span>{t(MAP_LAYERS[layer])}</span><ChevronDown size={14} className={open === 'layers' ? 'dt-rotated' : ''} /></button>
          <select className="dt-sr-only" tabIndex={-1} aria-label={t('Слой карты')} value={layer} onChange={e => setLayer(e.target.value as MapLayer)}>{Object.entries(MAP_LAYERS).map(([id, label]) => <option value={id} key={id}>{t(label)}</option>)}</select>
          {open === 'layers' && <div className="dt-popover dt-layer-menu" id="dt-layer-menu" aria-label={t('Слои карты')}>{(Object.entries(MAP_LAYERS) as [MapLayer, string][]).map(([id, label]) => {
            const Icon = ICONS[id]; return <button key={id} aria-pressed={layer === id} onClick={() => { setLayer(id); setOpen(null); root.current?.querySelector<HTMLButtonElement>('[data-popup="layers"]')?.focus(); }}><Icon size={17} /><span>{t(label)}</span>{id === layer && <span className="dt-check">●</span>}</button>;
          })}</div>}
        </div>
        <div className="dt-header-divider" />
        <div className="dt-popup-anchor"><button className="dt-icon-button" data-popup="settings" aria-label={t('Настройки визуализации')} aria-expanded={open === 'settings'} onClick={() => setOpen(open === 'settings' ? null : 'settings')}><Settings2 size={19} /></button>
          {open === 'settings' && <div className="dt-popover dt-settings"><strong>{t('Визуализация')}</strong>{([['agents','Транспортные агенты'],['hexagons','Соты при наведении'],['bloom','Неоновое свечение']] as const).map(([id, label]) => <label key={id}><span>{t(label)}</span><input type="checkbox" checked={settings[id]} onChange={e => setSettings(s => ({ ...s, [id]: e.target.checked }))} /></label>)}<small>{t('Наведение поднимает район. Нажатие выбирает его для управления.')}</small></div>}
        </div>
        <div className="dt-popup-anchor"><button className="dt-icon-button dt-account" data-popup="account" aria-label={t('Профиль оператора')} aria-expanded={open === 'account'} onClick={() => setOpen(open === 'account' ? null : 'account')}><UserRound size={18} /><i /></button>
          {open === 'account' && <div className="dt-popover dt-settings"><strong>{t('Оператор города')}</strong><p>{t('Локальная сессия · Астана')}</p><small>{t('Сценарии сохраняются в этом браузере.')}</small></div>}
        </div>
      </div>
    </header>
    <div className="dt-focus-layout">
    <div className="dt-stage" aria-label={t('Схематическая карта: {0}', [MAP_LAYERS[layer]])}>
      <div className="dt-stage-status"><span><i className="dt-status-dot" />{changed ? t('МИКРОСЦЕНАРИЙ / ПРОГНОЗ') : reference && layer === 'transport' ? t('ЗАФИКСИРОВАННЫЙ СРЕЗ') : t('СЦЕНАРИЙ / МЕСЯЦ {0}', [city.month])}</span>{!focused && <span>{t('АСТАНА')} · KZ <span className="dt-status-coords">51.1694° N / 71.4491° E</span></span>}</div>
      {focused && <button className="dt-reset-focus" onClick={clearFocus}><X size={13} />{t('Сбросить фокус')}</button>}
      <div ref={host} className="dt-canvas" />
      {state !== 'ready' && <div className="dt-fallback"><svg viewBox="0 0 650 440" aria-label={t('Районы Астаны')} onClick={event => { if (event.target === event.currentTarget) clearFocus(); }}><g transform="translate(0 90) scale(1 .7)"><path className="dt-fallback-river" d="M 38 168 C 95 183 142 204 182 212 C 218 198 257 162 284 163 C 353 184 389 207 432 214 C 495 241 546 264 601 277" />{[...DISTRICT_SHAPES].sort((a,b) => Number(a.id === focused) - Number(b.id === focused)).map(s => {
        const metric = data.find(d => d.id === s.id)!;
        return <g key={s.id} className={`dt-district-shape ${focused === s.id ? 'is-focused' : ''} ${focused && focused !== s.id ? 'is-muted' : ''}`} style={{ color: metric.color, transformOrigin: `${s.anchor[0]}px ${s.anchor[1]}px` }} role="button" tabIndex={0} aria-label={t('Открыть аудит района {0}', [DISTRICTS[s.id].nameRu])} aria-pressed={focused === s.id}
          onClick={() => selectDistrict(s.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectDistrict(s.id); } }} onPointerEnter={() => setHovered(s.id)} onPointerLeave={() => setHovered(null)}>
          <polygon points={s.points.map(([x,y]) => `${x},${y+15}`).join(' ')} fill="#0d202c" stroke="currentColor" /><polygon className="dt-polygon-top" points={s.points.map(p => p.join(',')).join(' ')} fill="#0c1821" stroke="currentColor" />
          <text x={s.anchor[0]} y={s.anchor[1] - 10} textAnchor="middle">{t(DISTRICTS[s.id].nameRu)}</text>
        </g>;
      })}</g></svg><span>{t(state === 'loading' ? 'Инициализация 3D-сцены…' : 'Упрощённый вид · WebGL недоступен')}</span></div>}
      <div className="dt-vignette" />
      <DistrictFlows ref={flows} district={focused} audit={audit} projected={state === 'ready'} color={focusedMetric?.color ?? focusColor} />
      <svg className="dt-leaders" aria-hidden="true" style={{ opacity: state === 'ready' ? 1 : 0 }}>{data.map(d => <g key={d.id} style={{ color: d.color }} className={hovered === d.id || selected === d.id ? 'is-active' : ''}><path ref={node => { lines.current[d.id] = node; }} /><circle ref={node => { pins.current[d.id] = node; }} r="3" /></g>)}</svg>
      <div className="dt-card-layer">{data.map((d, i) => {
        const focus = hovered === d.id || (focused ?? selected) === d.id;
        return <button key={d.id} ref={node => { cards.current[d.id] = node; }} className={`dt-district-card dt-slot-${i} ${focus ? 'is-active' : ''} ${focused && focused !== d.id ? 'is-muted' : ''}`} style={{ '--district-color': d.color } as React.CSSProperties}
          aria-label={t('Район {0}', [DISTRICTS[d.id].nameRu])} aria-pressed={(focused ?? selected) === d.id} onClick={() => selectDistrict(d.id)} onPointerEnter={() => setHovered(d.id)} onPointerLeave={() => setHovered(null)} onFocus={() => setHovered(d.id)} onBlur={() => setHovered(null)}>
          <span className="dt-card-heading"><span>{t(DISTRICTS[d.id].nameRu)}</span><span className="dt-district-code">0{i + 1}<i /></span></span>
          <span className="dt-number"><AnimatedMetric key={`${layer}-${reference}`} value={d.value} animate={animated} digits={layer === 'population' ? 0 : 1} /><small>{unit}</small></span>
          <span className={`dt-delta ${d.delta < 0 && layer === 'transport' ? 'is-improved' : ''}`}>{d.delta < 0 && layer === 'transport' ? <ArrowDownRight size={13} /> : <Minus size={12} />}<span>({t('{0} к базе', [`${d.delta > 0 ? '+' : ''}${format(d.delta, layer === 'population' ? 0 : 1)}`])})</span><span className="dt-card-bars">▂▃▅▃▆</span></span>
        </button>;
      })}</div>
      <div className="dt-orientation" aria-hidden="true"><span>N</span><Crosshair size={30} strokeWidth={.8} /><span>45° / ISO</span></div>
      <div className="dt-water-label">{t('ИШИМ')} <span>/ {t('ВОДНАЯ АРТЕРИЯ')}</span></div>
      <div className="dt-scene-bottom"><span><span className="dt-live-dot" />{t('{0} АГЕНТОВ', [count])} <span className="dt-agent-types"><i /> {t('АВТО')} <i /> {t('АВТОБУСЫ')}</span></span><button className="dt-motion-button" aria-label={t(animated ? 'Приостановить анимацию карты' : 'Возобновить анимацию карты')} disabled={reduced} onClick={() => setSettings(s => ({ ...s, motion: !s.motion }))}>{animated ? <Pause size={12} /> : <Play size={12} />}{t(reduced ? 'БЕЗ АНИМАЦИИ' : animated ? 'ПОТОК АКТИВЕН' : 'ПОТОК НА ПАУЗЕ')}</button></div>
      {toast && <div className="dt-audit-toast" role="status"><Check size={19} /><span>{t('Транзитный трафик через мосты снижен на {0}%', [toast.reduction])}<small>{t('Прогноз микросценария')} · {t(DISTRICTS[toast.district].nameRu)}</small></span><button aria-label={t('Закрыть уведомление')} onClick={() => setToast(null)}><X size={14} /></button></div>}
    </div>
    {focused && details && <aside ref={drawer} tabIndex={-1} className="dt-audit" aria-label={t('Аудит района {0}', [DISTRICTS[focused].nameRu])} style={{ '--audit-color': focusColor } as React.CSSProperties}>
      <div className="dt-audit-top"><span><i />{t('АУДИТ РАЙОНА')}</span><button onClick={clearFocus} aria-label={t('Закрыть аудит района')}><X size={18} /></button></div>
      <div className="dt-audit-heading"><div><span>{t('В ФОКУСЕ')}</span><h3>{t(DISTRICTS[focused].nameRu)}</h3></div><ArrowUpRight size={28} strokeWidth={1} /></div>
      <div className="dt-audit-load"><strong><AnimatedMetric value={focusLoad} animate={animated} /> <small>%</small></strong><span>{t('Нагрузка транспорта')}<small>{t(focusLoad > 140 ? 'КРИТИЧЕСКИЙ ПЕРЕГРУЗ' : focusLoad >= 100 ? 'ПОВЫШЕННАЯ НАГРУЗКА' : 'В ПРЕДЕЛАХ НОРМЫ')}</small></span></div>
      {details.loadReduction > 0 && <p className="dt-audit-gain"><ArrowDownRight size={14} />{t('−{0} п.п. нагрузки к исходному значению', [format(details.loadReduction)])}</p>}
      <section className="dt-audit-deficits"><h4>{t('Почему жители едут в другие районы')}</h4>{([
        ['Дефицит школьных мест', details.schoolDeficit, '#b99aff', 'Дефицит школьных мест: {0}%. Меньше — лучше: больше детей могут учиться в своём районе.'],
        ['Рабочие места шаговой доступности', details.nearbyJobs, '#63ddfa', 'Рабочие места рядом: {0}%. Больше — лучше: меньше поездок на работу в другие районы.'],
        ['Доступность АЗС и сервисных хабов', details.serviceAccess, '#ffa65d', 'Доступность местных сервисов: {0}%. Больше — лучше: меньше поездок за услугами в другие районы.'],
      ] as const).map(([label, value, hue, description]) => <ChartTooltip key={label} label={t(label)} description={t(description, [format(value)])}><div className="dt-audit-indicator" style={{ '--indicator-color': hue } as React.CSSProperties}><div><label>{t(label)}</label><strong>{format(value)}%</strong></div><progress max="100" value={value} aria-label={t(label)} /></div></ChartTooltip>)}</section>
      <div className="dt-audit-routes">{details.flows.map(flow => <div key={flow.kind}><span>{flowLabel(flow)}</span><small>→ {t(DISTRICTS[flow.target].nameRu)}</small></div>)}</div>
      <section className="dt-audit-actions"><div className="dt-audit-budget"><h4>{t('Оперативные решения')}</h4><span><output aria-label={t('Бюджет эксперимента')}>{audit.remainingBudget}</output> {t('млрд ₸')}</span></div>
        {(Object.entries(AUDIT_ACTIONS) as [AuditAction, typeof AUDIT_ACTIONS[AuditAction]][]).map(([action, definition]) => {
          const built = audit.built[focused]?.[action];
          const insufficient = audit.remainingBudget < definition.cost;
          return <button key={action} className={`dt-build-action dt-build-action--${action}`} disabled={built || insufficient} onClick={() => build(action)} aria-label={t('+ {0} (−{1} млрд ₸)', [definition.label, definition.cost])}>
            <span className="dt-build-icon">{built ? <Check size={18} /> : action === 'schools' ? '🏫' : '⛽'}</span><span><strong>{t(definition.label)}</strong><small>{t(built ? 'Построено в микросценарии' : insufficient ? 'Недостаточно средств' : 'Построить · −{0} млрд ₸', [definition.cost])}</small></span>{!built && <span>+</span>}
          </button>;
        })}
      </section>
      <p className="dt-audit-note">{t('Условный прогноз. Отдельный бюджет эксперимента; решения не меняют долгосрочный сценарий города.')}</p>
      {changed && <button className="dt-reset-audit" onClick={() => { setAudit(initialAuditState()); setToast(null); }}><RotateCcw size={12} />{t('Сбросить решения')}</button>}
    </aside>}
    </div>
    <footer className="dt-footer">
      <div className="dt-legend"><span className="dt-legend-title">[ {layer === 'transport' ? t('ИНДЕКС НАГРУЗКИ') : t(MAP_LAYERS[layer]).toUpperCase()} ]</span>
        {layer === 'population' ? <span className="dt-legend-item" style={{ '--legend-color': '#65dce9' } as React.CSSProperties}><i />{t('Число жителей')}</span> : <>{(layer === 'transport' ? [['#56efb0','<100%'],['#ffc466','100–140%'],['#ff5268','>140%']] : [['#ff5268','<45'],['#ffc466','45–65'],['#56efb0','≥65']]).map(([color, label]) => <span className="dt-legend-item" style={{ '--legend-color': color } as React.CSSProperties} key={color}><i />{t(label)}</span>)}<span className="dt-better">{t(layer === 'transport' ? 'Меньше — лучше.' : 'Больше — лучше.')}</span></>}
      </div>
      <div className="dt-source">{layer === 'transport' && <><button aria-pressed={reference} onClick={() => setReference(true)}>{t('Срез из задания')}</button><button aria-pressed={!reference} onClick={() => setReference(false)}>{t('Текущий сценарий')}</button></>}<span title={t('Границы районов условные')}><Activity size={12} /> {t('УСЛОВНАЯ ГЕОМЕТРИЯ')}</span></div>
    </footer>
  </div>;
}
