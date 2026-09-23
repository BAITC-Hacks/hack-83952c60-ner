import { t, useLanguage } from '../i18n';
import React from 'react';
import { Coins, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { SelectedDecision, ValidationResult } from '../engine/types';
import { MEASURES } from '../data/measures';
import { DISTRICTS } from '../data/districts';
import { DIRECTIONS } from '../data/indicators';
import { TOTAL_BUDGET, REQUIRED_DECISIONS_COUNT } from '../engine/validator';

interface BudgetBarProps {
  validation: ValidationResult;
  decisions: SelectedDecision[];
  onRemoveDecision: (index: number) => void;
}

export const BudgetBar: React.FC<BudgetBarProps> = ({
  validation,
  decisions,
  onRemoveDecision,
}) => {
  useLanguage();
  const percentage = Math.min(100, (validation.totalCost / TOTAL_BUDGET) * 100);
  const isOverBudget = validation.totalCost > TOTAL_BUDGET;

  return (
    <div className="glass-panel" style={{ padding: '18px 24px', marginBottom: '24px' }}>
      
      {/* Top summary row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '14px' }}>
        
        {/* Budget stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              padding: '10px',
              borderRadius: '10px',
              background: isOverBudget ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Coins size={22} color={isOverBudget ? 'var(--color-rose)' : 'var(--color-green)'} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: isOverBudget ? 'var(--color-rose)' : 'var(--text-main)' }}>
                {validation.totalCost}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                / {TOTAL_BUDGET} {t("у.е.")}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: isOverBudget ? 'var(--color-rose)' : 'var(--text-muted)' }}>
              {isOverBudget ? t("Превышение на {0} у.е.!", [validation.totalCost - TOTAL_BUDGET]) : t("Остаток бюджета: {0} у.е.", [validation.remainingBudget])}
            </div>
          </div>
        </div>

        {/* 5 Decisions Slots Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {t("Принято решений:")}{' '}<strong>{decisions.length}/{REQUIRED_DECISIONS_COUNT}</strong>
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {Array.from({ length: REQUIRED_DECISIONS_COUNT }).map((_, idx) => {
              const d = decisions[idx];
              const measure = d ? MEASURES[d.measureId] : null;
              return (
                <div
                  key={idx}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: measure ? 'rgba(59, 130, 246, 0.2)' : 'var(--surface-soft)',
                    border: measure ? '1px solid #3b82f6' : '1px dashed var(--border-strong)',
                    color: measure ? 'var(--color-blue)' : 'var(--text-dim)',
                    transition: 'all 0.2s',
                  }}
                  title={measure ? `${measure.id}: ${t(measure.nameRu)}` : t("Слот {0}: свободно", [idx + 1])}
                >
                  {measure ? measure.id : idx + 1}
                </div>
              );
            })}
          </div>
        </div>

        {/* Directions coverage status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {Object.entries(DIRECTIONS).map(([dirId, dirMeta]) => {
            const count = validation.directionCounts[dirId as keyof typeof validation.directionCounts] || 0;
            const isExcess = count > 2;
            return (
              <div
                key={dirId}
                style={{
                  fontSize: '0.7rem',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: isExcess
                    ? 'rgba(244, 63, 94, 0.2)'
                    : count > 0
                    ? 'var(--surface-strong)'
                    : 'transparent',
                  border: isExcess
                    ? '1px solid var(--color-rose)'
                    : count > 0
                    ? `1px solid ${dirMeta.color}`
                    : '1px solid var(--border-subtle)',
                  color: isExcess ? 'var(--color-rose)' : count > 0 ? 'var(--text-main)' : 'var(--text-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title={`${t(dirMeta.nameRu)}: ${count}/2`}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dirMeta.color }} />
                <span>{t(dirMeta.nameRu).split(' ')[0]}</span>
                <span style={{ fontWeight: 700 }}>{count}</span>
              </div>
            );
          })}
        </div>

      </div>

      {/* Progress bar */}
      <div
        style={{
          width: '100%',
          height: '8px',
          background: 'var(--surface-soft)',
          borderRadius: '4px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            background: isOverBudget
              ? 'linear-gradient(90deg, var(--color-rose), #e11d48)'
              : 'linear-gradient(90deg, var(--color-green), #06b6d4, #3b82f6)',
            borderRadius: '4px',
            transition: 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: isOverBudget ? '0 0 10px rgba(244, 63, 94, 0.6)' : '0 0 10px rgba(6, 182, 212, 0.4)',
          }}
        />
      </div>

      {/* Validation alert banners if any error */}
      {validation.errors.length > 0 && (
        <div
          style={{
            marginTop: '12px',
            padding: '10px 14px',
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {validation.errors.map((err, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--color-rose)' }}>
              <XCircle size={14} color="var(--color-rose)" style={{ flexShrink: 0 }} />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {/* Active decisions pills row */}
      {decisions.length > 0 && (
        <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginRight: '4px' }}>
            {t("Выбранные меры:")}{' '}</span>
          {decisions.map((d, index) => {
            const m = MEASURES[d.measureId];
            if (!m) return null;
            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexWrap: 'wrap',
                  background: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                }}
              >
                <span style={{ fontWeight: 700, color: 'var(--color-cyan)' }}>{m.id}</span>
                <span style={{ color: 'var(--text-main)' }}>{t(m.nameRu)}</span>
                {d.districtId && (
                  <span className="badge badge-purple" style={{ padding: '1px 5px', fontSize: '0.68rem' }}>
                    {t(DISTRICTS[d.districtId].nameRu)}
                  </span>
                )}
                <span style={{ color: 'var(--text-muted)' }}>({m.cost} {t("у.е.)")}</span>
                <button
                  onClick={() => onRemoveDecision(index)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '2px',
                  }}
                  title={t("Удалить решение")}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
