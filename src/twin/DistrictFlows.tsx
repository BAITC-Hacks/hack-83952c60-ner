import React, { forwardRef, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { DistrictId } from '../engine/types';
import { DISTRICTS } from '../data/districts';
import { getLanguage, t } from '../i18n';
import { AuditState, auditDistrict } from './mapAudit';
import { DISTRICT_SHAPES } from './mapData';

export interface DistrictFlowsHandle { project(id: DistrictId, x: number, y: number): void }
const COLORS = { schools: '#b99aff', work: '#63ddfa', services: '#ffa65d' };
const EMOJI = { schools: '🎓', work: '💼', services: '⛽' };
type Point = [number, number];

export function flowLabel(flow: ReturnType<typeof auditDistrict>['flows'][number]) {
  const count = flow.count === null ? '' : `${Math.round(flow.count * flow.remaining).toLocaleString(getLanguage())} `;
  return `${EMOJI[flow.kind]} ${count}${t(flow.label)}`;
}

export default forwardRef<DistrictFlowsHandle, { district: DistrictId | null; audit: AuditState; projected: boolean; color: string }>(function DistrictFlows({ district, audit, projected, color }, ref) {
  const prefix = useId().replace(/:/g, '');
  const svg = useRef<SVGSVGElement>(null);
  const coordinates = useRef<Partial<Record<DistrictId, Point>>>({});
  const paths = useRef<Partial<Record<string, SVGGElement | null>>>({});
  const markers = useRef<Partial<Record<string, SVGGElement | null>>>({});
  const radar = useRef<SVGGElement>(null);
  const tooltipElement = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const flows = district ? auditDistrict(district, audit).flows : [];
  const built = district ? audit.built[district] : undefined;
  const point = (id: DistrictId): Point => {
    if (projected) return coordinates.current[id] ?? [0, 0];
    const anchor = DISTRICT_SHAPES.find(shape => shape.id === id)!.anchor;
    return [anchor[0], 90 + anchor[1] * .7];
  };
  const draw = () => {
    if (!district) return;
    const from = point(district);
    radar.current?.setAttribute('transform', `translate(${from.join(' ')})`);
    flows.forEach(flow => {
      const to = point(flow.target);
      const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
      const lift = Math.min(125, Math.max(45, distance * .45));
      const control: Point = [(from[0] + to[0]) / 2 + (Math.abs(to[0] - from[0]) < 60 ? distance * .4 : 0), Math.min(from[1], to[1]) - lift];
      const path = `M ${from[0]} ${from[1]} Q ${control[0]} ${control[1]} ${to[0]} ${to[1]}`;
      paths.current[flow.kind]?.querySelectorAll('path').forEach(element => element.setAttribute('d', path));
      if (tooltip === flow.kind && tooltipElement.current && svg.current) {
        const width = svg.current.clientWidth, height = svg.current.clientHeight;
        const scale = projected ? 1 : Math.min(width / 650, height / 440);
        const x = (from[0] * .25 + control[0] * .5 + to[0] * .25) * scale + (projected ? 0 : (width - 650 * scale) / 2);
        const y = (from[1] * .25 + control[1] * .5 + to[1] * .25) * scale + (projected ? 0 : (height - 440 * scale) / 2);
        tooltipElement.current.style.left = `${Math.max(width * .25, Math.min(width * .75, x))}px`;
        tooltipElement.current.style.top = `${Math.max(80, y - 10)}px`;
      }
    });
    markers.current.schools?.setAttribute('transform', `translate(${from[0] - 28} ${from[1] + 24})`);
    markers.current.hub?.setAttribute('transform', `translate(${from[0] + 28} ${from[1] + 24})`);
  };
  useImperativeHandle(ref, () => ({ project(id, x, y) { coordinates.current[id] = [x, y]; draw(); } }));
  useLayoutEffect(() => { draw(); }, [district, audit, projected, tooltip]);
  useLayoutEffect(() => { setTooltip(null); }, [district]);
  return <div className="dt-flow-overlay">
    <svg ref={svg} className="dt-flows" viewBox={projected ? undefined : '0 0 650 440'} aria-label={t('Маятниковая миграция')}>
      <defs>{Object.entries(COLORS).map(([kind, hue]) => <marker key={kind} id={`${prefix}-${kind}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L7 3.5 L0 7 Z" fill={hue} /></marker>)}</defs>
      {flows.map(flow => <g key={`${district}-${flow.kind}`} ref={node => { paths.current[flow.kind] = node; }} className={`dt-flow dt-flow--${flow.kind}`} style={{ color: COLORS[flow.kind], '--flow-width': (flow.kind === 'work' ? 3 : flow.kind === 'schools' ? 3.5 : 1.7) * flow.remaining } as React.CSSProperties}
        data-testid={`migration-${flow.kind}`} data-remaining={flow.remaining} tabIndex={0} role="img" aria-label={`${flowLabel(flow)} · ${t(DISTRICTS[flow.target].nameRu)}`}
        onPointerEnter={() => setTooltip(flow.kind)} onPointerLeave={() => setTooltip(null)} onFocus={() => setTooltip(flow.kind)} onBlur={() => setTooltip(null)}>
        <title>{flowLabel(flow)} · {t(DISTRICTS[flow.target].nameRu)}</title>
        <path className="dt-flow-halo" /><path className="dt-flow-line" markerEnd={`url(#${prefix}-${flow.kind})`} /><path className="dt-flow-hit" />
      </g>)}
      {district && <g ref={radar} className="dt-radar" style={{ color }} aria-hidden="true"><circle className="dt-radar-ring" r="12" /><circle className="dt-radar-ring dt-radar-ring--second" r="12" /><circle r="5" className="dt-radar-core" /></g>}
      {built?.schools && <g ref={node => { markers.current.schools = node; }} role="img" aria-label={t('Построено: {0}', ['2 школы шаговой доступности'])}><g className="dt-built-pin"><circle r="17" /><text textAnchor="middle" dominantBaseline="central">🏫</text></g></g>}
      {built?.hub && <g ref={node => { markers.current.hub = node; }} role="img" aria-label={t('Построено: {0}', ['Сервисный хаб / АЗС на окраине'])}><g className="dt-built-pin dt-built-pin--hub"><circle r="17" /><text textAnchor="middle" dominantBaseline="central">⛽</text></g></g>}
    </svg>
    {tooltip && flows.filter(flow => flow.kind === tooltip).map(flow => <div ref={tooltipElement} key={flow.kind} className="dt-flow-tooltip" role="tooltip" style={{ borderColor: COLORS[flow.kind] }}>{flowLabel(flow)}<small>{t(DISTRICTS[district!].nameRu)} → {t(DISTRICTS[flow.target].nameRu)}</small></div>)}
  </div>;
});
