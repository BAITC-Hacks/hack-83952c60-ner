import { t, useLanguage } from '../i18n';
import React from 'react';
import { Sparkles, ArrowRight, Zap, TrendingUp } from 'lucide-react';
import { SelectedDecision, SimulationResult } from '../engine/types';
import { findBestImprovements, RecommendationSwap } from '../engine/optimizer';
import { DISTRICTS } from '../data/districts';

interface OptimizerCardProps {
  simulation: SimulationResult;
  decisions: SelectedDecision[];
  onApplySwap: (swap: RecommendationSwap) => void;
}

export const OptimizerCard: React.FC<OptimizerCardProps> = ({
  simulation,
  decisions,
  onApplySwap,
}) => {
  useLanguage();
  const recommendations = findBestImprovements(decisions);

  if (decisions.length !== 5 || !simulation.isValid) {
    return null;
  }

  if (recommendations.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontSize: '0.85rem', fontWeight: 600 }}>
          <Sparkles size={16} />
          <span>{t("Сценарий близок к локальному оптимуму! Очевидных одиночных замен с заметным приростом Score не найдено.")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <div
          style={{
            padding: '6px',
            borderRadius: '8px',
            background: 'rgba(6, 182, 212, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Zap size={18} color="#06b6d4" />
        </div>
        <div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
            {t("AI-Оптимизатор сценария (Рекомендации по улучшению)")}</h3>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {t("Алгоритмический поиск точечных замен для максимизации Astana Quality of Life Score")}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
        {recommendations.map((rec, idx) => {
          const targetDistName = rec.addDecision.districtId
            ? t(DISTRICTS[rec.addDecision.districtId]?.nameRu) || rec.addDecision.districtId
            : t("Город");

          return (
            <div
              key={idx}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(6, 182, 212, 0.25)',
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="badge badge-blue" style={{ fontSize: '0.68rem' }}>
                    {t("Вариант #")}{idx + 1}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: '#34d399',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    <TrendingUp size={13} />
                    +{rec.scoreGain.toFixed(2)} {t("баллов")}</span>
                </div>

                {/* Replacement flow */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', marginBottom: '8px' }}>
                  <span style={{ color: '#fb7185', textDecoration: 'line-through' }}>
                    {rec.removeMeasureId}
                  </span>
                  <ArrowRight size={13} color="var(--text-dim)" />
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                    {rec.addDecision.measureId} ({targetDistName})
                  </span>
                </div>

                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '10px' }}>
                  {rec.explanation}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                  {t("Прогноз Score:")}{' '}<strong style={{ color: '#f8fafc' }}>{rec.projectedScore.toFixed(2)}</strong>
                </span>

                <button
                  onClick={() => onApplySwap(rec)}
                  className="btn-primary"
                  style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                >
                  {t("Применить")}</button>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
