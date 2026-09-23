import React from 'react';
import { SimulationResult, IndicatorId, DistrictId } from '../engine/types';
import { INDICATORS, INDICATOR_LIST, DIRECTIONS } from '../data/indicators';
import { DISTRICT_LIST } from '../data/districts';

interface RadarAnalyticsProps {
  simulation: SimulationResult;
  selectedDistrictId: DistrictId | null;
}

export const RadarAnalytics: React.FC<RadarAnalyticsProps> = ({
  simulation,
  selectedDistrictId,
}) => {
  const targetDistrictId = selectedDistrictId || 'nura';
  const targetDistrict = simulation.districts[targetDistrictId] || simulation.districts.nura;

  // Compute city-wide weighted average for each indicator
  const cityWeightedIndicators: Record<IndicatorId, { base: number; current: number }> = {} as any;
  for (const ind of INDICATOR_LIST) {
    let baseSum = 0;
    let currentSum = 0;
    for (const d of DISTRICT_LIST) {
      const dRes = simulation.districts[d.id];
      baseSum += d.populationShare * (dRes?.initialIndicators[ind.id] || d.indicators[ind.id]);
      currentSum += d.populationShare * (dRes?.finalIndicators[ind.id] || d.indicators[ind.id]);
    }
    cityWeightedIndicators[ind.id] = {
      base: baseSum,
      current: currentSum,
    };
  }

  return (
    <div className="glass-panel" style={{ padding: '20px' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
            Аналитика 10 показателей (До и После)
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Фокус на районе: <strong style={{ color: '#38bdf8' }}>{targetDistrict.nameRu}</strong> (кликните по карте для смены)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.7rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', background: 'rgba(255, 255, 255, 0.25)', borderRadius: '2px' }} />
            <span style={{ color: 'var(--text-dim)' }}>База</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', background: '#38bdf8', borderRadius: '2px' }} />
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>{simulation.isValid ? 'Текущий итог' : 'База до 5 решений'}</span>
          </div>
        </div>
      </div>

      {/* Grid of indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '12px' }}>
        {INDICATOR_LIST.map((ind) => {
          const baseVal = targetDistrict.initialIndicators[ind.id];
          const currVal = targetDistrict.finalIndicators[ind.id];
          const delta = currVal - baseVal;
          const isCrit = currVal < 40;
          const dirMeta = DIRECTIONS[ind.direction];

          return (
            <div
              key={ind.id}
              style={{
                background: isCrit ? 'rgba(244, 63, 94, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                border: isCrit ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '10px',
                padding: '10px 12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: dirMeta.color,
                    }}
                  >
                    {ind.id}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#f8fafc', fontWeight: 500 }}>
                    {ind.nameRu}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: isCrit ? '#f43f5e' : '#f8fafc',
                    }}
                  >
                    {currVal.toFixed(1)}
                  </span>
                  {delta !== 0 && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: delta > 0 ? '#34d399' : '#fb7185',
                      }}
                    >
                      ({delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)})
                    </span>
                  )}
                </div>
              </div>

              {/* Progress visualizer */}
              <div style={{ position: 'relative', width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                {/* Base level line */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${baseVal}%`,
                    top: 0,
                    bottom: 0,
                    width: '2px',
                    background: '#94a3b8',
                    zIndex: 2,
                  }}
                  title={`Базовое значение: ${baseVal}`}
                />
                {/* 40 critical threshold marker */}
                <div
                  style={{
                    position: 'absolute',
                    left: '40%',
                    top: 0,
                    bottom: 0,
                    width: '1px',
                    background: 'rgba(244, 63, 94, 0.7)',
                    zIndex: 3,
                  }}
                  title="Порог штрафа (<40)"
                />
                {/* Current level bar */}
                <div
                  style={{
                    height: '100%',
                    width: `${currVal}%`,
                    background: isCrit ? '#f43f5e' : `linear-gradient(90deg, ${dirMeta.color}88, ${dirMeta.color})`,
                    borderRadius: '3px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                <span>Вес: {(ind.weight * 100).toFixed(0)}%</span>
                {isCrit ? (
                  <span style={{ color: '#fb7185', fontWeight: 600 }}>Штраф &lt;40</span>
                ) : (
                  <span>Норма ≥40</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
