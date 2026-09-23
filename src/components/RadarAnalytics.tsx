import React, { useEffect, useId, useState } from 'react';
import { t, useLanguage } from '../i18n';
import { SimulationResult, DirectionId, DistrictId } from '../engine/types';
import { INDICATOR_LIST, DIRECTION_LIST } from '../data/indicators';
import { DISTRICT_LIST } from '../data/districts';
import { ChartTooltip } from './ChartTooltip';
import './RadarAnalytics.css';

interface RadarAnalyticsProps {
  simulation: SimulationResult;
  selectedDistrictId: DistrictId | null;
  onSelectDistrict?: (districtId: DistrictId) => void;
}

export const RadarAnalytics: React.FC<RadarAnalyticsProps> = ({
  simulation,
  selectedDistrictId,
  onSelectDistrict,
}) => {
  useLanguage();
  const id = useId();
  const [category, setCategory] = useState<DirectionId | 'all'>('all');
  const [localDistrictId, setLocalDistrictId] = useState<DistrictId>(selectedDistrictId ?? 'nura');

  useEffect(() => {
    if (selectedDistrictId) setLocalDistrictId(selectedDistrictId);
  }, [selectedDistrictId]);

  const targetDistrictId = onSelectDistrict ? selectedDistrictId ?? localDistrictId : localDistrictId;
  const targetDistrict = simulation.districts[targetDistrictId] ?? simulation.districts.nura;
  const visibleDirections = DIRECTION_LIST.filter(direction => category === 'all' || direction.id === category);

  return (
    <section className="glass-panel analytics-panel" aria-labelledby={`${id}-title`}>
      <header className="analytics-panel__header">
        <div>
          <h3 id={`${id}-title`}>{t('Показатели по направлениям')}</h3>
          <p>{t('Сравните исходные значения и результат выбранных решений.')}</p>
        </div>
        <div className="analytics-panel__filters">
          <label htmlFor={`${id}-district`}>
            <span>{t('Район для анализа')}</span>
            <select
              id={`${id}-district`}
              value={targetDistrictId}
              onChange={event => {
                const next = event.target.value as DistrictId;
                setLocalDistrictId(next);
                onSelectDistrict?.(next);
              }}
            >
              {DISTRICT_LIST.map(district => <option key={district.id} value={district.id}>{t(district.nameRu)}</option>)}
            </select>
          </label>
          <label htmlFor={`${id}-category`}>
            <span>{t('Направление анализа')}</span>
            <select id={`${id}-category`} value={category} onChange={event => setCategory(event.target.value as DirectionId | 'all')}>
              <option value="all">{t('Все направления')}</option>
              {DIRECTION_LIST.map(direction => <option key={direction.id} value={direction.id}>{t(direction.nameRu)}</option>)}
            </select>
          </label>
        </div>
      </header>

      <div className="analytics-panel__guide">
        <p>{t('Шкала от 0 до 100: выше — лучше. Ниже 40 — критический уровень.')}</p>
        <div className="analytics-panel__legend">
          <span><i className="analytics-panel__legend-baseline" aria-hidden="true" />{t('Исходное значение')}</span>
          <span><i className="analytics-panel__legend-current" aria-hidden="true" />{t('После решений')}</span>
          <span><i className="analytics-panel__legend-threshold" aria-hidden="true" />{t('Порог 40')}</span>
        </div>
      </div>

      <div className="analytics-panel__groups">
        {visibleDirections.map(direction => (
          <section className="analytics-group" key={direction.id} aria-labelledby={`${id}-${direction.id}`}>
            <h4 id={`${id}-${direction.id}`}>
              <span className="analytics-group__accent" style={{ background: direction.color }} aria-hidden="true" />
              {t(direction.nameRu)}
            </h4>
            {INDICATOR_LIST.filter(indicator => indicator.direction === direction.id).map(indicator => {
              const baseline = targetDistrict.initialIndicators[indicator.id];
              const current = targetDistrict.finalIndicators[indicator.id];
              const delta = current - baseline;
              const critical = current < 40;

              return (
                <article className="analytics-indicator" key={indicator.id} aria-labelledby={`${id}-${indicator.id}`}>
                  <div className="analytics-indicator__heading">
                    <h5 id={`${id}-${indicator.id}`}>{t(indicator.nameRu)}</h5>
                    <span className="analytics-indicator__code">{indicator.id}</span>
                  </div>
                  <dl className="analytics-indicator__values">
                    <div><dt>{t('До решений')}</dt><dd>{baseline.toFixed(1)}</dd></div>
                    <div><dt>{t('После решений')}</dt><dd className={critical ? 'analytics-indicator__critical' : 'analytics-indicator__current'}>{current.toFixed(1)}</dd></div>
                    <div><dt>{t('Изменение')}</dt><dd className={delta > 0 ? 'analytics-indicator__positive' : delta < 0 ? 'analytics-indicator__critical' : ''}>{delta > 0 ? '+' : ''}{delta.toFixed(1)}</dd></div>
                  </dl>
                  <ChartTooltip className="chart-tooltip-target--bar" label={t(indicator.nameRu)}
                    description={t('До: {0}; после: {1}; изменение: {2}. Ниже 40 — критический уровень.', [baseline.toFixed(1), current.toFixed(1), `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`])}>
                  <div className="analytics-indicator__bar" aria-hidden="true">
                    <span className={`analytics-indicator__fill${critical ? ' analytics-indicator__fill--critical' : ''}`} style={{ width: `${Math.min(100, Math.max(0, current))}%` }} />
                    <span className="analytics-indicator__baseline" style={{ left: `${Math.min(100, Math.max(0, baseline))}%` }} />
                    <span className="analytics-indicator__threshold" />
                  </div>
                  </ChartTooltip>
                  <div className="analytics-indicator__footnote">
                    <span>{t('Вес показателя: {0}%', [(indicator.weight * 100).toFixed(0)])}</span>
                    {critical && <span className="analytics-indicator__critical">{t('Критический уровень')}</span>}
                  </div>
                </article>
              );
            })}
          </section>
        ))}
      </div>
    </section>
  );
};
