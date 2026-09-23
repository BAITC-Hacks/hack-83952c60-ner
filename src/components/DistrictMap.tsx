import { t, useLanguage } from '../i18n';
import React from 'react';
import { DistrictId, DistrictSimulationResult, SelectedDecision } from '../engine/types';
import { DISTRICTS } from '../data/districts';
import { MEASURES } from '../data/measures';
import { INDICATORS } from '../data/indicators';

interface DistrictMapProps {
  districts: Record<DistrictId, DistrictSimulationResult>;
  selectedDistrictId: DistrictId | null;
  onSelectDistrict: (id: DistrictId) => void;
  decisions: SelectedDecision[];
}

export const DistrictMap: React.FC<DistrictMapProps> = ({
  districts,
  selectedDistrictId,
  onSelectDistrict,
  decisions,
}) => {
  useLanguage();
  // Color scale function based on score 0-100
  const getDistrictColor = (score: number, isSelected: boolean) => {
    let baseColor = '#3b82f6';
    if (score < 45) baseColor = '#ef4444'; // Red
    else if (score < 52) baseColor = '#f59e0b'; // Amber
    else if (score < 58) baseColor = '#06b6d4'; // Cyan
    else if (score < 65) baseColor = 'var(--color-green)'; // Emerald
    else baseColor = '#8b5cf6'; // Violet high

    return isSelected ? 'var(--color-cyan)' : baseColor;
  };

  const selectedData = selectedDistrictId ? districts[selectedDistrictId] : null;

  return (
    <div className="glass-panel" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {t("Карта районов Астаны")}</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {t('Схематичная карта учебного датасета: качество жизни в шести районах')}
          </p>
        </div>
        
        {/* Heatmap Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
          <span>{t("<45 (Критич.)")}</span>
          <div style={{ display: 'flex', gap: '2px' }}>
            <span style={{ width: '12px', height: '8px', background: '#ef4444', borderRadius: '2px' }} />
            <span style={{ width: '12px', height: '8px', background: '#f59e0b', borderRadius: '2px' }} />
            <span style={{ width: '12px', height: '8px', background: '#06b6d4', borderRadius: '2px' }} />
            <span style={{ width: '12px', height: '8px', background: 'var(--color-green)', borderRadius: '2px' }} />
          </div>
          <span>{t(">60 (Высокий)")}</span>
        </div>
      </div>

      {/* SVG Interactive Map */}
      <div style={{ position: 'relative', width: '100%', minHeight: '310px', flex: '1 0 310px', background: 'var(--surface-inset)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
        <svg
          viewBox="0 0 600 380"
          style={{ width: '100%', height: '100%', cursor: 'pointer' }}
        >
          <defs>
            <linearGradient id="riverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#0284c7" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.4" />
            </linearGradient>
            <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="var(--color-cyan)" floodOpacity="0.6" />
            </filter>
          </defs>

          {/* Grid lines */}
          <line x1="50" y1="50" x2="550" y2="50" stroke="var(--surface-subtle)" strokeWidth="1" strokeDasharray="4,4" />
          <line x1="50" y1="190" x2="550" y2="190" stroke="var(--surface-subtle)" strokeWidth="1" strokeDasharray="4,4" />
          <line x1="50" y1="330" x2="550" y2="330" stroke="var(--surface-subtle)" strokeWidth="1" strokeDasharray="4,4" />

          {/* River Yesil curve dividing Right and Left banks */}
          <path
            d="M 50 160 C 180 180, 240 140, 340 170 C 440 200, 480 170, 560 180"
            fill="none"
            stroke="url(#riverGrad)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <text x="310" y="165" fill="var(--color-cyan)" fontSize="10" fontWeight="600" opacity="0.6" letterSpacing="2">
            {t("р. ЕСИЛЬ (ИШИМ)")}</text>

          {/* 1. SARYARKA (Right Bank, NW) */}
          <g onClick={() => onSelectDistrict('saryarka')}>
            <polygon
              points="70,50 250,40 240,150 90,165 60,110"
              fill={getDistrictColor(districts.saryarka?.finalDistrictScore || 54.65, selectedDistrictId === 'saryarka')}
              fillOpacity={selectedDistrictId === 'saryarka' ? 'var(--district-selected-opacity)' : 'var(--district-fill-opacity)'}
              stroke={selectedDistrictId === 'saryarka' ? 'var(--text-main)' : 'var(--color-blue)'}
              strokeWidth={selectedDistrictId === 'saryarka' ? 3 : 1.5}
              filter={selectedDistrictId === 'saryarka' ? 'url(#glowFilter)' : undefined}
            />
            <text x="145" y="95" fill="var(--text-main)" fontSize="13" fontWeight="700" textAnchor="middle">
              {t("Сарыарка")}</text>
            <text x="145" y="115" fill="var(--text-muted)" fontSize="11" fontFamily="var(--font-mono)" textAnchor="middle">
              {(districts.saryarka?.finalDistrictScore || 54.65).toFixed(1)}
            </text>
          </g>

          {/* 2. BAIKONUR (Right Bank, Central-North) */}
          <g onClick={() => onSelectDistrict('baikonur')}>
            <polygon
              points="255,40 390,45 380,155 245,150"
              fill={getDistrictColor(districts.baikonur?.finalDistrictScore || 56.63, selectedDistrictId === 'baikonur')}
              fillOpacity={selectedDistrictId === 'baikonur' ? 'var(--district-selected-opacity)' : 'var(--district-fill-opacity)'}
              stroke={selectedDistrictId === 'baikonur' ? 'var(--text-main)' : 'var(--color-blue)'}
              strokeWidth={selectedDistrictId === 'baikonur' ? 3 : 1.5}
              filter={selectedDistrictId === 'baikonur' ? 'url(#glowFilter)' : undefined}
            />
            <text x="315" y="95" fill="var(--text-main)" fontSize="13" fontWeight="700" textAnchor="middle">
              {t("Байконур")}</text>
            <text x="315" y="115" fill="var(--text-muted)" fontSize="11" fontFamily="var(--font-mono)" textAnchor="middle">
              {(districts.baikonur?.finalDistrictScore || 56.63).toFixed(1)}
            </text>
          </g>

          {/* 3. ALMATY (Right Bank, NE) */}
          <g onClick={() => onSelectDistrict('almaty')}>
            <polygon
              points="395,45 540,60 535,108 390,100"
              fill={getDistrictColor(districts.almaty?.finalDistrictScore || 57.06, selectedDistrictId === 'almaty')}
              fillOpacity={selectedDistrictId === 'almaty' ? 'var(--district-selected-opacity)' : 'var(--district-fill-opacity)'}
              stroke={selectedDistrictId === 'almaty' ? 'var(--text-main)' : 'var(--color-blue)'}
              strokeWidth={selectedDistrictId === 'almaty' ? 3 : 1.5}
              filter={selectedDistrictId === 'almaty' ? 'url(#glowFilter)' : undefined}
            />
            <text x="460" y="70" fill="var(--text-main)" fontSize="13" fontWeight="700" textAnchor="middle">
              {t('Алматы')}
            </text>
            <text x="460" y="90" fill="var(--text-muted)" fontSize="11" fontFamily="var(--font-mono)" textAnchor="middle">
              {(districts.almaty?.finalDistrictScore || 57.06).toFixed(1)}
            </text>
          </g>

          {/* 6. SARAISHYK (Right Bank, East) */}
          <g onClick={() => onSelectDistrict('saraishyk')}>
            <polygon
              points="390,105 535,113 520,175 385,155"
              fill={getDistrictColor(districts.saraishyk?.finalDistrictScore || 57.06, selectedDistrictId === 'saraishyk')}
              fillOpacity={selectedDistrictId === 'saraishyk' ? 'var(--district-selected-opacity)' : 'var(--district-fill-opacity)'}
              stroke={selectedDistrictId === 'saraishyk' ? 'var(--text-main)' : 'var(--color-blue)'}
              strokeWidth={selectedDistrictId === 'saraishyk' ? 3 : 1.5}
              filter={selectedDistrictId === 'saraishyk' ? 'url(#glowFilter)' : undefined}
            />
            <text x="460" y="132" fill="var(--text-main)" fontSize="13" fontWeight="700" textAnchor="middle">
              {t('Сарайшык')}
            </text>
            <text x="460" y="152" fill="var(--text-muted)" fontSize="11" fontFamily="var(--font-mono)" textAnchor="middle">
              {(districts.saraishyk?.finalDistrictScore || 57.06).toFixed(1)}
            </text>
          </g>

          {/* 4. ESIL (Left Bank, Central-South) */}
          <g onClick={() => onSelectDistrict('esil')}>
            <polygon
              points="200,185 360,180 500,200 450,330 250,320"
              fill={getDistrictColor(districts.esil?.finalDistrictScore || 62.99, selectedDistrictId === 'esil')}
              fillOpacity={selectedDistrictId === 'esil' ? 'var(--district-selected-opacity)' : 'var(--district-fill-opacity)'}
              stroke={selectedDistrictId === 'esil' ? 'var(--text-main)' : 'var(--color-blue)'}
              strokeWidth={selectedDistrictId === 'esil' ? 3 : 1.5}
              filter={selectedDistrictId === 'esil' ? 'url(#glowFilter)' : undefined}
            />
            <text x="345" y="245" fill="var(--text-main)" fontSize="14" fontWeight="800" textAnchor="middle">
              {t("Есиль")}</text>
            <text x="345" y="265" fill="var(--text-muted)" fontSize="11" fontFamily="var(--font-mono)" textAnchor="middle">
              {(districts.esil?.finalDistrictScore || 62.99).toFixed(1)} {t("(27% нас.)")}</text>
          </g>

          {/* 5. NURA (Left Bank, South-West) */}
          <g onClick={() => onSelectDistrict('nura')}>
            <polygon
              points="75,185 195,185 245,320 200,360 80,340"
              fill={getDistrictColor(districts.nura?.finalDistrictScore || 49.18, selectedDistrictId === 'nura')}
              fillOpacity={selectedDistrictId === 'nura' ? 'var(--district-selected-opacity)' : 'var(--district-fill-opacity)'}
              stroke={selectedDistrictId === 'nura' ? 'var(--text-main)' : '#f59e0b'}
              strokeWidth={selectedDistrictId === 'nura' ? 3 : 1.5}
              filter={selectedDistrictId === 'nura' ? 'url(#glowFilter)' : undefined}
            />
            <text x="145" y="260" fill="var(--text-main)" fontSize="14" fontWeight="800" textAnchor="middle">
              {t("Нура")}</text>
            <text x="145" y="280" fill="var(--text-muted)" fontSize="11" fontFamily="var(--font-mono)" textAnchor="middle">
              {(districts.nura?.finalDistrictScore || 49.18).toFixed(1)}
            </text>
            {districts.nura?.criticalIndicators.length > 0 && (
              <text x="145" y="300" fill="var(--color-rose)" fontSize="10" fontWeight="700" textAnchor="middle">
                {t("⚠️ Штраф <40")}</text>
            )}
          </g>

        </svg>

        {/* Floating measure badges on map */}
        <div style={{ position: 'absolute', bottom: '10px', left: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {decisions.map((d, i) => {
            const m = MEASURES[d.measureId];
            return (
              <span
                key={i}
                className="badge badge-blue"
                style={{ fontSize: '0.68rem', background: 'var(--surface-input)', backdropFilter: 'blur(4px)' }}
              >
                {d.measureId}: {d.districtId ? t(DISTRICTS[d.districtId].nameRu) : t("Город")}
              </span>
            );
          })}
        </div>

      </div>

      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px' }}>
        {t('Учебная модель: показатели Сарайшыка взяты из Алматы, прежний вес населения Алматы разделён поровну. Границы условные.')}
      </p>
      {/* District Quick Inspector */}
      {selectedData && (
        <div
          style={{
            marginTop: '16px',
            padding: '14px',
            background: 'var(--surface-subtle)',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {t("Район")} {t(selectedData.nameRu)}
              </h4>
              <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
                {t("Доля населения:")}{' '}{(selectedData.populationShare * 100).toFixed(0)}%
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-cyan)' }}>
              {t("Балл:")}{' '}{selectedData.finalDistrictScore.toFixed(2)}
              {selectedData.scoreDelta !== 0 && (
                <span style={{ color: selectedData.scoreDelta > 0 ? 'var(--color-green)' : 'var(--color-rose)', marginLeft: '6px' }}>
                  ({selectedData.scoreDelta > 0 ? `+${selectedData.scoreDelta.toFixed(2)}` : selectedData.scoreDelta.toFixed(2)})
                </span>
              )}
            </div>
          </div>

          {/* Indicators mini-grid */}
          <div className="district-indicators" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '6px', marginTop: '10px' }}>
            {Object.entries(selectedData.finalIndicators).map(([indId, val]) => {
              const delta = selectedData.indicatorDeltas[indId as keyof typeof selectedData.indicatorDeltas] || 0;
              const isCrit = val < 40;
              return (
                <div
                  key={indId}
                  style={{
                    background: isCrit ? 'rgba(244, 63, 94, 0.15)' : 'var(--surface-soft)',
                    border: isCrit ? '1px solid var(--color-rose)' : '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '4px 6px',
                    textAlign: 'center',
                  }}
                  title={`${t(INDICATORS[indId as keyof typeof INDICATORS].nameRu)}: ${val.toFixed(1)}`}
                >
                  <div style={{ fontSize: '0.65rem', color: isCrit ? 'var(--color-rose)' : 'var(--text-dim)' }}>
                    {indId}
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: isCrit ? 'var(--color-rose)' : 'var(--text-main)' }}>
                    {val.toFixed(1)}
                  </div>
                  {delta !== 0 && (
                    <div style={{ fontSize: '0.6rem', color: delta > 0 ? 'var(--color-green)' : 'var(--color-rose)' }}>
                      {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
