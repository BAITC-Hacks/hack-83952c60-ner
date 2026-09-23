import React from 'react';
import { TrendingUp, AlertOctagon, CheckCircle2, Zap, Scale, Target } from 'lucide-react';
import { SimulationResult } from '../engine/types';
import { DISTRICTS } from '../data/districts';

interface ScoreDashboardProps {
  simulation: SimulationResult;
}

export const ScoreDashboard: React.FC<ScoreDashboardProps> = ({ simulation }) => {
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

  const isPositive = scoreDelta > 0;
  const weakestDistrictName = DISTRICTS[weakestDistrictId]?.nameRu || weakestDistrictId;

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', alignItems: 'center' }}>
        
        {/* Main Hero Score Gauge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          
          <div
            style={{
              position: 'relative',
              width: '110px',
              height: '110px',
              borderRadius: '50%',
              background: isValid
                ? 'conic-gradient(#06b6d4 0deg, #3b82f6 240deg, rgba(255, 255, 255, 0.05) 240deg)'
                : 'conic-gradient(#f43f5e 0deg, #e11d48 240deg, rgba(255, 255, 255, 0.05) 240deg)',
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
                Score
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1.45rem',
                  fontWeight: 800,
                  color: isValid ? '#38bdf8' : '#f43f5e',
                }}
              >
                {isValid ? finalScore.toFixed(2) : '—'}
              </span>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                Astana Quality of Life Score
              </h2>
              {isValid ? (
                <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
                  <CheckCircle2 size={12} /> Валиден
                </span>
              ) : (
                <span className="badge badge-red" style={{ fontSize: '0.7rem' }}>
                  <AlertOctagon size={12} /> Требует правок
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Базовый уровень: <strong>{baseScore.toFixed(2)}</strong>
              </span>
              {isValid && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: isPositive ? '#34d399' : '#fb7185',
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
              Формула: 70% среднее по городу + 30% слабый район − штраф N_crit
            </div>
          </div>

        </div>

        {/* 3 Formula Component Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
          
          {/* Component 1: D_avg */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '12px',
              borderRadius: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
              <Scale size={13} color="#60a5fa" />
              <span>D_avg (70%)</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
              {isValid ? finalCityAverage.toFixed(2) : baseCityAverage.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.7rem', color: isValid && finalCityAverage > baseCityAverage ? '#34d399' : 'var(--text-dim)' }}>
              {isValid && finalCityAverage > baseCityAverage
                ? `+${(finalCityAverage - baseCityAverage).toFixed(2)} к базе`
                : 'База: ' + baseCityAverage.toFixed(2)}
            </div>
          </div>

          {/* Component 2: min(D_d) */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '12px',
              borderRadius: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
              <Target size={13} color="#a78bfa" />
              <span>min(D_d) (30%)</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
              {isValid ? finalMinDistrictScore.toFixed(2) : baseMinDistrictScore.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Район: <strong>{weakestDistrictName}</strong>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: finalCritCount > 0 ? '#fb7185' : '#34d399', marginBottom: '4px' }}>
              <AlertOctagon size={13} />
              <span>Штраф N_crit (&lt;40)</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: finalCritCount > 0 ? '#f43f5e' : '#10b981' }}>
              {finalCritCount > 0 ? `-${finalCritCount}.0 балла` : '0 (нет штрафа)'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
              {finalCritCount === 0 ? 'Все показатели ≥ 40' : `${finalCritCount} провал(ов)`}
            </div>
          </div>

          {/* Component 4: Active Synergies */}
          <div
            style={{
              background: activeSynergies.length > 0 ? 'rgba(6, 182, 212, 0.08)' : 'rgba(255, 255, 255, 0.03)',
              border: activeSynergies.length > 0 ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
              padding: '12px',
              borderRadius: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: activeSynergies.length > 0 ? '#38bdf8' : 'var(--text-dim)', marginBottom: '4px' }}>
              <Zap size={13} />
              <span>Синергии</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: activeSynergies.length > 0 ? '#38bdf8' : 'var(--text-dim)' }}>
              {activeSynergies.length} активна(о)
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {activeSynergies.length > 0 ? 'Бонусы начислены' : 'Связок нет'}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
