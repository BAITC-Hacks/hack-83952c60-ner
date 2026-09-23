import React, { useId, useMemo, useRef, useState } from 'react';
import { t, useLanguage } from '../i18n';
import { transitMap } from '../data/transitMap';
import './AstanaTransitMap.css';

type Stop = {
  id: string;
  x: number;
  y: number;
  names: { ru: string; kk: string; en: string };
  ref?: string;
  kind: 'lrt' | 'bus';
};

const stops: Stop[] = [
  ...transitMap.lrtStations.map(stop => ({ ...stop, kind: 'lrt' as const })),
  ...transitMap.busStops.map(stop => ({ ...stop, kind: 'bus' as const })),
];
const stopKey = (stop: Stop) => `${stop.kind}:${stop.id}`;
const { width, height } = transitMap;
const unit = Math.min(width, height) / 600;

// The street network does not change during selection, zooming or panning.
const BaseMap = React.memo(() => <>
  <rect width={width} height={height} fill="#0a1929" />
  <g fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {transitMap.rivers.map((path, index) => <path key={`river-edge-${index}`} d={path} stroke="#1b3441" strokeWidth={12 * unit} />)}
    {transitMap.rivers.map((path, index) => <path key={`river-${index}`} d={path} stroke="#06111f" strokeWidth={9 * unit} />)}
    {transitMap.roads.map((road, index) => {
      const major = /^(trunk|primary)/.test(road.kind);
      const secondary = /^(secondary|tertiary)/.test(road.kind);
      return <path key={`road-${index}`} d={road.path} stroke={major ? '#bda04b' : secondary ? '#847545' : '#4a4839'} strokeWidth={(major ? 1.5 : secondary ? 0.85 : 0.5) * unit} opacity={major ? 0.7 : secondary ? 0.5 : 0.65} />;
    })}
  </g>
</>);

export const AstanaTransitMap = React.memo(function AstanaTransitMap() {
  const language = useLanguage();
  const id = useId();
  const [showBus, setShowBus] = useState(true);
  const [showLrt, setShowLrt] = useState(true);
  const [selectedKey, setSelectedKey] = useState('');
  const [search, setSearch] = useState('');
  const [zoom, setZoom] = useState(1);
  const markerUnit = unit / Math.sqrt(zoom);
  const [center, setCenter] = useState({ x: width / 2, y: height / 2 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointerId: number; x: number; y: number; centerX: number; centerY: number } | null>(null);
  const selected = stops.find(stop => stopKey(stop) === selectedKey);
  const visibleStops = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return stops.filter(stop => (stop.kind === 'bus' ? showBus : showLrt)
      && (!query || Object.values(stop.names).some(name => name.toLocaleLowerCase().includes(query))
        || stop.ref?.toLocaleLowerCase().includes(query)));
  }, [showBus, showLrt, search]);
  const selectedName = selected?.names[language];

  const constrainCenter = (x: number, y: number, nextZoom = zoom) => ({
    x: Math.max(width / (2 * nextZoom), Math.min(width - width / (2 * nextZoom), x)),
    y: Math.max(height / (2 * nextZoom), Math.min(height - height / (2 * nextZoom), y)),
  });

  const changeZoom = (nextZoom: number) => {
    const value = Math.max(1, Math.min(4, nextZoom));
    setCenter(current => constrainCenter(current.x, current.y, value));
    setZoom(value);
  };

  const chooseStop = (stop: Stop) => {
    const nextZoom = Math.max(zoom, 1.5);
    setSelectedKey(stopKey(stop));
    setSearch('');
    setZoom(nextZoom);
    setCenter(constrainCenter(stop.x, stop.y, nextZoom));
  };

  const toggleLayer = (kind: 'bus' | 'lrt') => {
    const enabled = kind === 'bus' ? showBus : showLrt;
    if (enabled && selected?.kind === kind) setSelectedKey('');
    if (kind === 'bus') setShowBus(!showBus);
    else setShowLrt(!showLrt);
  };

  const endDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <section className="glass-panel transit-map" aria-labelledby={`${id}-heading`} data-testid="astana-transit-map">
      <header className="transit-map__header">
        <div>
          <span className="transit-map__eyebrow">ASTANA <span aria-hidden="true">/</span> {t('ГОРОДСКОЙ ТРАНСПОРТ')}</span>
          <h3 id={`${id}-heading`}>{t('Транспортная карта Астаны')}</h3>
          <p>{t('Автобусные остановки и линия LRT')}</p>
        </div>
        <span className="transit-map__badge"><span aria-hidden="true" />{t('Карта маршрута')}</span>
      </header>

      <div className="transit-map__layers" aria-label={t('Слои карты')}>
        <button type="button" aria-pressed={showLrt} onClick={() => toggleLayer('lrt')} className="transit-map__layer transit-map__layer--lrt">
          <span className="transit-map__legend-line" aria-hidden="true" />
          <span>{t('Линия LRT')}</span><span className="transit-map__count">{transitMap.lrtStations.length}</span>
        </button>
        <button type="button" aria-pressed={showBus} onClick={() => toggleLayer('bus')} className="transit-map__layer transit-map__layer--bus">
          <span className="transit-map__legend-dot" aria-hidden="true" />
          <span>{t('Автобусные остановки')}</span><span className="transit-map__count">{transitMap.busStops.length}</span>
        </button>
      </div>

      <div className={`transit-map__viewport${dragging ? ' is-dragging' : ''}`}>
        <svg
          className="transit-map__svg"
          style={{ touchAction: zoom > 1 ? 'none' : 'pan-y' }}
          viewBox={`${center.x - width / (2 * zoom)} ${center.y - height / (2 * zoom)} ${width / zoom} ${height / zoom}`}
          role="img"
          aria-label={t('Карта линий LRT и автобусных остановок Астаны')}
          onPointerDown={event => {
            if (event.button !== 0 || zoom === 1) return;
            const matrix = event.currentTarget.getScreenCTM();
            if (!matrix) return;
            drag.current = { pointerId: event.pointerId, x: event.clientX / matrix.a, y: event.clientY / matrix.d, centerX: center.x, centerY: center.y };
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
          }}
          onPointerMove={event => {
            const origin = drag.current;
            const matrix = event.currentTarget.getScreenCTM();
            if (!origin || origin.pointerId !== event.pointerId || !matrix) return;
            setCenter(constrainCenter(origin.centerX - (event.clientX / matrix.a - origin.x), origin.centerY - (event.clientY / matrix.d - origin.y)));
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={() => { drag.current = null; setDragging(false); }}
        >
          <title>{t('Транспортная карта Астаны')}</title>
          <desc>{t('Выберите остановку на карте или в списке под ней. Увеличьте карту, чтобы рассмотреть детали.')}</desc>
          <BaseMap />

          {showBus && <g data-testid="transit-bus-layer" aria-hidden="true">
            {transitMap.busStops.map(stop => <g key={stop.id} className="transit-map__marker" onPointerDown={event => event.stopPropagation()} onClick={() => chooseStop({ ...stop, kind: 'bus' })}>
              <title>{stop.names[language]}</title>
              <circle cx={stop.x} cy={stop.y} r={2.3 * unit} fill="#77c9d4" fillOpacity="0.7" stroke="#081525" strokeWidth={0.8 * unit} />
              <circle cx={stop.x} cy={stop.y} r={6 * unit} fill="transparent" />
            </g>)}
          </g>}

          {showLrt && <g data-testid="transit-lrt-layer" aria-hidden="true">
            <g fill="none" strokeLinecap="round" strokeLinejoin="round">
              {transitMap.lrtPaths.map((path, index) => <path key={`lrt-halo-${index}`} d={path} stroke="#05101e" strokeWidth={8 * unit} />)}
              {transitMap.lrtPaths.map((path, index) => <path key={`lrt-line-${index}`} d={path} stroke="#e3bf56" strokeWidth={3.4 * unit} />)}
            </g>
            {transitMap.lrtStations.map(stop => <g key={stop.id} className="transit-map__marker" onPointerDown={event => event.stopPropagation()} onClick={() => chooseStop({ ...stop, kind: 'lrt' })}>
              <title>{`${stop.ref} · ${stop.names[language]}`}</title>
              <circle cx={stop.x} cy={stop.y} r={12 * markerUnit} fill="#e3bf56" stroke="#081525" strokeWidth={1.8 * markerUnit} />
              <text x={stop.x} y={stop.y} textAnchor="middle" dominantBaseline="central" fill="#081525" fontSize={13 * markerUnit} fontWeight="800" pointerEvents="none">{stop.ref}</text>
              <circle cx={stop.x} cy={stop.y} r={16 * markerUnit} fill="transparent" />
              {(stop.ref === '101' || stop.ref === '118') && <text x={stop.x + 19 * markerUnit} y={stop.y} dominantBaseline="central" fill="#e3bf56" stroke="#0a1929" strokeWidth={4 * markerUnit} paintOrder="stroke" fontSize={17 * markerUnit} fontWeight="600" pointerEvents="none">{stop.names[language]}</text>}
            </g>)}
          </g>}

          {selected && <g className="transit-map__selection" pointerEvents="none" aria-hidden="true">
            <circle cx={selected.x} cy={selected.y} r={14 * unit} fill={selected.kind === 'lrt' ? '#e3bf56' : '#77c9d4'} fillOpacity="0.18" />
            <circle cx={selected.x} cy={selected.y} r={11 * unit} fill="none" stroke="#ffffff" strokeWidth={1.5 * unit} />
          </g>}
        </svg>

        <div className="transit-map__north" title={t('Север')} aria-label={t('Север')}><span aria-hidden="true">N</span><svg viewBox="0 0 16 28" aria-hidden="true"><path d="M8 0 15 23 8 18 1 23Z" fill="currentColor" /><path d="M8 0v18l7 5Z" fill="#87733f" /></svg></div>
        <div className="transit-map__zoom" aria-label={t('Масштаб карты')}>
          <button type="button" onClick={() => changeZoom(zoom * 1.5)} disabled={zoom >= 4} aria-label={t('Увеличить карту')} title={t('Увеличить карту')}>+</button>
          <button type="button" onClick={() => changeZoom(zoom / 1.5)} disabled={zoom <= 1} aria-label={t('Уменьшить карту')} title={t('Уменьшить карту')}>−</button>
          <button type="button" onClick={() => { setZoom(1); setCenter({ x: width / 2, y: height / 2 }); }} aria-label={t('Показать всю карту')} title={t('Показать всю карту')}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7V3h4m6 0h4v4m0 6v4h-4m-6 0H3v-4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></button>
        </div>
        <div className="transit-map__signature" aria-hidden="true">ASTANA<span>{t('КАЗАХСТАН')}</span></div>
        {!showBus && !showLrt && <div className="transit-map__empty">{t('Включите слой, чтобы увидеть остановки')}</div>}
        <span className="transit-map__zoom-level" aria-hidden="true">{Math.round(zoom * 100)}%</span>
      </div>

      <div className="transit-map__finder">
        <label className="transit-map__sr-only" htmlFor={`${id}-search`}>{t('Найти остановку')}</label>
        <input id={`${id}-search`} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('Найти остановку')} autoComplete="off" />
        <label className="transit-map__sr-only" htmlFor={`${id}-stop`}>{t('Выбрать остановку')}</label>
        <select id={`${id}-stop`} value={visibleStops.some(stop => stopKey(stop) === selectedKey) ? selectedKey : ''} onChange={event => {
          const stop = stops.find(item => stopKey(item) === event.target.value);
          if (stop) chooseStop(stop);
          else setSelectedKey('');
        }}>
          <option value="">{visibleStops.length ? t('Выбрать остановку') : t('Остановки не найдены')}</option>
          {showLrt && <optgroup label={t('Станции LRT')}>{visibleStops.filter(stop => stop.kind === 'lrt').map(stop => <option key={stopKey(stop)} value={stopKey(stop)}>{stop.ref} · {stop.names[language]}</option>)}</optgroup>}
          {showBus && <optgroup label={t('Автобусные остановки')}>{visibleStops.filter(stop => stop.kind === 'bus').map(stop => <option key={stopKey(stop)} value={stopKey(stop)}>{stop.names[language]}</option>)}</optgroup>}
        </select>
      </div>

      <div className={`transit-map__detail${selected ? ' has-selection' : ''}`} aria-live="polite" aria-atomic="true">
        <span className={`transit-map__detail-symbol${selected?.kind === 'bus' ? ' is-bus' : ''}`} aria-hidden="true">{selected?.kind === 'bus' ? '●' : selected?.ref || '↗'}</span>
        <div>{selected ? <><span className="transit-map__detail-type">{selected.kind === 'lrt' ? t('Станция LRT') : t('Автобусная остановка')}</span><strong>{selectedName}</strong></> : <><strong>{t('Город в движении')}</strong><span>{t('Выберите остановку, чтобы узнать её название')}</span></>}</div>
        {selected && <button type="button" onClick={() => setSelectedKey('')} aria-label={t('Закрыть информацию об остановке')}>×</button>}
      </div>

      <footer className="transit-map__footer">
        <p>{t('Именованные остановки в центре и вдоль LRT. Без онлайн-расписания. Данные: {0}.', [transitMap.updatedAt])}</p>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors <span aria-hidden="true">↗</span></a>
      </footer>
    </section>
  );
});
