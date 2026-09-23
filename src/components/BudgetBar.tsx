import React from 'react';
import { Coins, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { SelectedDecision, ValidationResult } from '../engine/types';
import { MEASURES } from '../data/measures';
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
            <Coins size={22} color={isOverBudget ? '#f43f5e' : '#10b981'} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: isOverBudget ? '#f43f5e' : '#f8fafc' }}>
                {validation.totalCost}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                / {TOTAL_BUDGET} у.е.
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: isOverBudget ? '#fb7185' : 'var(--text-muted)' }}>
              {isOverBudget ? `Превышение на ${validation.totalCost - TOTAL_BUDGET} у.е.!` : `Остаток бюджета: ${validation.remainingBudget} у.е.`}
            </div>
          </div>
        </div>

        {/* 5 Decisions Slots Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Принято решений: <strong>{decisions.length}/{REQUIRED_DECISIONS_COUNT}</strong>
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
                    background: measure ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    border: measure ? '1px solid #3b82f6' : '1px dashed rgba(255, 255, 255, 0.15)',
                    color: measure ? '#93c5fd' : 'var(--text-dim)',
                    transition: 'all 0.2s',
                  }}
                  title={measure ? `${measure.id}: ${measure.nameRu}` : `Слот ${idx + 1}: свободно`}
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
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'transparent',
                  border: isExcess
                    ? '1px solid #f43f5e'
                    : count > 0
                    ? `1px solid ${dirMeta.color}`
                    : '1px solid rgba(255, 255, 255, 0.06)',
                  color: isExcess ? '#fb7185' : count > 0 ? '#f8fafc' : 'var(--text-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title={`${dirMeta.nameRu}: ${count}/2`}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dirMeta.color }} />
                <span>{dirMeta.nameRu.split(' ')[0]}</span>
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
          background: 'rgba(255, 255, 255, 0.05)',
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
              ? 'linear-gradient(90deg, #f43f5e, #e11d48)'
              : 'linear-gradient(90deg, #10b981, #06b6d4, #3b82f6)',
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
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#fca5a5' }}>
              <XCircle size={14} color="#f87171" style={{ flexShrink: 0 }} />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {/* Active decisions pills row */}
      {decisions.length > 0 && (
        <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginRight: '4px' }}>
            Выбранные меры:
          </span>
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
                  background: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                }}
              >
                <span style={{ fontWeight: 700, color: '#38bdf8' }}>{m.id}</span>
                <span style={{ color: '#e2e8f0' }}>{m.nameRu}</span>
                {d.districtId && (
                  <span className="badge badge-purple" style={{ padding: '1px 5px', fontSize: '0.68rem' }}>
                    {d.districtId}
                  </span>
                )}
                <span style={{ color: '#94a3b8' }}>({m.cost} у.е.)</span>
                <button
                  onClick={() => onRemoveDecision(index)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '2px',
                  }}
                  title="Удалить решение"
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
