import React, { useState, useEffect } from 'react';
import { Clock, ShieldAlert, Award, FileText, RotateCcw, Sparkles } from 'lucide-react';
import { SelectedDecision } from '../engine/types';

interface HeaderProps {
  onLoadPreset: (decisions: SelectedDecision[]) => void;
  onReset: () => void;
  onOpenCompare: () => void;
  onOpenCrisis: () => void;
  onOpenPresentation: () => void;
  crisisActive: boolean;
  enableExperiments: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onLoadPreset,
  onReset,
  onOpenCompare,
  onOpenCrisis,
  onOpenPresentation,
  crisisActive,
  enableExperiments,
}) => {
  // 5-hour countdown timer simulation (5:00:00)
  const [secondsRemaining, setSecondsRemaining] = useState(5 * 3600);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleBenchmarkPreset = () => {
    // Official benchmark set from Section 3 of Hackathon doc
    onLoadPreset([
      { measureId: 'M7', districtId: 'nura' },
      { measureId: 'M8', districtId: 'nura' },
      { measureId: 'M10', districtId: 'nura' },
      { measureId: 'M12' },
      { measureId: 'M5', districtId: 'saryarka' },
    ]);
  };

  return (
    <header className="glass-panel" style={{ padding: '16px 24px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Title and emblem */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(14, 165, 233, 0.4)',
            }}
          >
            <span style={{ fontSize: '24px' }}>🏛️</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#f8fafc' }}>
                «Аким на 5 часов»
              </h1>
              <span className="badge badge-blue">AI-СИМУЛЯТОР АСТАНЫ</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Интеллектуальная система распределения бюджета и расчета Astana Quality of Life Score
            </p>
          </div>
        </div>

        {/* 5-Hour Shift Timer & Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(15, 23, 42, 0.6)',
            padding: '6px 14px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Clock size={18} color="#38bdf8" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 }}>
              Смена Акима (5 часов)
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>
              {formatTime(secondsRemaining)}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={handleBenchmarkPreset}
            className="btn-secondary"
            title="Загрузить контрольный набор из ТЗ (Score 56,54)"
            style={{ fontSize: '0.8rem', padding: '7px 12px' }}
          >
            <Sparkles size={15} color="#38bdf8" />
            Эталон ТЗ
          </button>

          {enableExperiments && <><button
            onClick={onOpenCrisis}
            className={`btn-secondary ${crisisActive ? 'badge-amber' : ''}`}
            title="Смоделировать неожиданное городское событие / форс-мажор"
            style={{ fontSize: '0.8rem', padding: '7px 12px' }}
          >
            <ShieldAlert size={15} color={crisisActive ? '#f59e0b' : '#94a3b8'} />
            Форс-мажор {crisisActive && '●'}
          </button>

          <button
            onClick={onOpenCompare}
            className="btn-secondary"
            title="Сравнение команд и сценариев (A/B тестирование)"
            style={{ fontSize: '0.8rem', padding: '7px 12px' }}
          >
            <Award size={15} color="#a78bfa" />
            Команды
          </button>

          <button
            onClick={onOpenPresentation}
            className="btn-primary"
            title="Сгенерировать краткую презентацию решения Акима"
            style={{ fontSize: '0.8rem', padding: '7px 14px' }}
          >
            <FileText size={15} />
            Презентация
          </button></>}

          <button
            onClick={onReset}
            className="btn-secondary"
            title="Сбросить все решения"
            aria-label="Сбросить все решения"
            style={{ padding: '7px 10px' }}
          >
            <RotateCcw size={15} color="#94a3b8" />
          </button>
        </div>

      </div>
    </header>
  );
};
