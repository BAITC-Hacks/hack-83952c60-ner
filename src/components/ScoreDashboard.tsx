import { t, useLanguage } from '../i18n';
import React from 'react';
import { TrendingUp, AlertOctagon, CheckCircle2, Zap, Scale, Target } from 'lucide-react';
import { SimulationResult } from '../engine/types';
import { DISTRICTS } from '../data/districts';

interface ScoreDashboardProps {
  simulation: SimulationResult;
}

export const ScoreDashboard: React.FC<ScoreDashboardProps> = ({ simulation }) => {
  useLanguage();
  const {
    isValid,
    baseScore,
    finalScore,
    scoreDelta,
    finalCityAverage,
    baseCityAverage,
    finalMinDistrictScore,
    baseMinDistrictScore,
    weakestDistrictId,
    finalCritCount,
    baseCritCount,
    activeSynergies,
  } = simulation;

  const isPositive = scoreDelta !== null && scoreDelta > 0;
  const weakestDistrictName = t(DISTRICTS[weakestDistrictId]?.nameRu) || weakestDistrictId;

  return (
    <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
      
      {/* Background ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: isValid ? 'radial-gradient(circle, rgba(14, 165, 233, 0.15) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(244, 63, 94, 0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '20px', alignItems: 'center' }}>
        
        {/* Main Hero Score Gauge */}
        <div className="score-hero" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          
          <div
            style={{
              position: 'relative',
              width: '110px',
              flexShrink: 0,
              height: '110px',
              borderRadius: '50%',
              background: isValid
                ? 'conic-gradient(#06b6d4 0deg, #3b82f6 240deg, var(--surface-soft) 240deg)'
                : 'conic-gradient(var(--color-rose) 0deg, #e11d48 240deg, var(--surface-soft) 240deg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isValid ? '0 0 25px rgba(6, 182, 212, 0.3)' : '0 0 25px rgba(244, 63, 94, 0.3)',
            }}
          >
            <div
              style={{
                width: '90px',
                height: '90px',
                borderRadius: '50%',
                background: 'var(--bg-card)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                {t("Score")}</span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1.45rem',
                  fontWeight: 800,
                  color: isValid ? 'var(--color-cyan)' : 'var(--color-rose)',
                }}
              >
                {isValid ? finalScore.toFixed(2).replace('.', ',') : '—'}
              </span>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {t("Astana Quality of Life Score")}</h2>
              {isValid ? (
                <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
                  <CheckCircle2 size={12} /> {t("Валиден")}</span>
              ) : (
                <span className="badge badge-red" style={{ fontSize: '0.7rem' }}>
                  <AlertOctagon size={12} /> {t("Сценарий не завершён")}{' '}</span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {t("Базовый уровень:")}{' '}<strong>{baseScore.toFixed(2).replace('.', ',')}</strong>
              </span>
              {isValid && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: isPositive ? 'var(--color-green)' : 'var(--color-rose)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  <TrendingUp size={14} />
                  {isPositive ? `+${scoreDelta.toFixed(2)}` : scoreDelta.toFixed(2)}
                </span>
              )}
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              {t("Формула: 70% среднее по городу + 30% слабый район − штраф N_crit")}</div>
          </div>

        </div>

        {/* 3 Formula Component Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
          
          {/* Component 1: D_avg */}
          <div
            style={{
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border-subtle)',
              padding: '12px',
              borderRadius: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
              <Scale size={13} color="var(--color-blue)" />
              <span>{t("D_avg (70%)")}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {isValid ? finalCityAverage.toFixed(2) : baseCityAverage.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.7rem', color: isValid && finalCityAverage > baseCityAverage ? 'var(--color-green)' : 'var(--text-dim)' }}>
              {isValid && finalCityAverage > baseCityAverage
                ? t("+{0} к базе", [(finalCityAverage - baseCityAverage).toFixed(2)])
                : t("База: ") + baseCityAverage.toFixed(2)}
            </div>
          </div>

          {/* Component 2: min(D_d) */}
          <div
            style={{
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border-subtle)',
              padding: '12px',
              borderRadius: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
              <Target size={13} color="var(--color-purple)" />
              <span>{t("min(D_d) (30%)")}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {isValid ? finalMinDistrictScore.toFixed(2) : baseMinDistrictScore.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {t("Район:")}{' '}<strong>{weakestDistrictName}</strong>
            </div>
          </div>

          {/* Component 3: N_crit Penalty */}
          <div
            style={{
              background: finalCritCount > 0 ? 'rgba(244, 63, 94, 0.08)' : 'rgba(16, 185, 129, 0.08)',
              border: finalCritCount > 0 ? '1px solid rgba(244, 63, 94, 0.25)' : '1px solid rgba(16, 185, 129, 0.25)',
              padding: '12px',
              borderRadius: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: finalCritCount > 0 ? 'var(--color-rose)' : 'var(--color-green)', marginBottom: '4px' }}>
              <AlertOctagon size={13} />
              <span>{t("Штраф N_crit (<40)")}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: finalCritCount > 0 ? 'var(--color-rose)' : 'var(--color-green)' }}>
              {finalCritCount > 0 ? t("-{0}.0 балла", [finalCritCount]) : t("0 (нет штрафа)")}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
              {finalCritCount === 0 ? t("Все показатели ≥ 40") : t("{0} провал(ов)", [finalCritCount])}
            </div>
          </div>

          {/* Component 4: Active Synergies */}
          <div
            style={{
              background: activeSynergies.length > 0 ? 'rgba(6, 182, 212, 0.08)' : 'var(--surface-subtle)',
              border: activeSynergies.length > 0 ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid var(--border-subtle)',
              padding: '12px',
              borderRadius: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: activeSynergies.length > 0 ? 'var(--color-cyan)' : 'var(--text-dim)', marginBottom: '4px' }}>
              <Zap size={13} />
              <span>{t("Синергии")}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: activeSynergies.length > 0 ? 'var(--color-cyan)' : 'var(--text-dim)' }}>
              {activeSynergies.length} {t("активна(о)")}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {activeSynergies.length > 0 ? t("Бонусы начислены") : t("Связок нет")}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
