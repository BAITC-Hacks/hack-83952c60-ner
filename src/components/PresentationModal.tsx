import React from 'react';
import { FileText, X, Printer, Copy, Check, Sparkles } from 'lucide-react';
import { SimulationResult } from '../engine/types';
import { MEASURES } from '../data/measures';
import { DISTRICTS } from '../data/districts';
import { generateAIAnalysis } from '../ai/analyzer';

interface PresentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  simulation: SimulationResult;
}

export const PresentationModal: React.FC<PresentationModalProps> = ({
  isOpen,
  onClose,
  simulation,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !simulation.isValid) return null;

  const analysis = generateAIAnalysis(simulation);

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    const text = `ОТЧЕТ АКИМА ГОРОДА АСТАНЫ «АКИМ НА 5 ЧАСОВ»
--------------------------------------------------
Итоговый Astana Quality of Life Score: ${simulation.finalScore.toFixed(2)} (прирост: +${simulation.scoreDelta.toFixed(2)} к базовому уровню 52.56)
Бюджет: израсходовано ${simulation.validation.totalCost} из 100 у.е. (остаток: ${simulation.validation.remainingBudget} у.е.)
Слабейший район: ${DISTRICTS[simulation.weakestDistrictId]?.nameRu} (балл: ${simulation.finalMinDistrictScore.toFixed(2)})
Критические провалы (<40): ${simulation.finalCritCount}

ПРИНЯТЫЕ РЕШЕНИЯ (5 МЕР):
${simulation.decisions.map((d, i) => {
  const m = MEASURES[d.measureId];
  const target = d.districtId ? DISTRICTS[d.districtId]?.nameRu : 'Общегородское';
  return `${i + 1}. [${m.id}] ${m.nameRu} — ${target} (стоимость: ${m.cost} у.е., лаг: ${m.lag} кв.)`;
}).join('\n')}

АКТИВНЫЕ СИНЕРГИИ:
${simulation.activeSynergies.join('\n') || 'Отсутствуют'}

ОЦЕНКА УПРАВЛЕНЧЕСКОГО СТИЛЯ:
${analysis.akimatRatingVerdict}

СИЛЬНЫЕ СТОРОНЫ:
${analysis.strengths.join('\n')}

СКРЫТЫЕ РИСКИ И КОМПРОМИССЫ:
${analysis.risksAndTradeoffs.join('\n')}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '28px',
          background: 'rgba(15, 23, 42, 0.98)',
        }}
      >
        {/* Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={22} color="#38bdf8" />
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
                Презентация решения Акимата г. Астаны
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Готовый исполнительный слайд для защиты перед комиссией
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleCopy} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
              {copied ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
              {copied ? 'Скопировано!' : 'Копировать'}
            </button>
            <button onClick={handlePrint} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
              <Printer size={14} />
              Печать / PDF
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Slide Content Frame */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.6))',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '16px',
            padding: '24px',
          }}
        >
          {/* Slide Top Banner */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '16px', marginBottom: '20px' }}>
            <div>
              <span className="badge badge-blue" style={{ marginBottom: '6px' }}>
                ГОРОДСКОЙ СИМУЛЯТОР «АКИМ НА 5 ЧАСОВ»
              </span>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc' }}>
                Стратегия развития качества жизни в Астане
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Стиль управления: <strong style={{ color: '#38bdf8' }}>{analysis.akimatRatingVerdict}</strong>
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Astana QoL Score
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 800, color: '#38bdf8' }}>
                {simulation.finalScore.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#34d399' }}>
                +{simulation.scoreDelta.toFixed(2)} к базе (52.56)
              </div>
            </div>
          </div>

          {/* 3 Metric Summary Boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Бюджет проекта</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#f8fafc' }}>
                {simulation.validation.totalCost} / 100 у.е.
              </div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Остаток: {simulation.validation.remainingBudget} у.е.</div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Слабейший район</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                {DISTRICTS[simulation.weakestDistrictId]?.nameRu}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Балл: {simulation.finalMinDistrictScore.toFixed(2)}</div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Критические провалы</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: simulation.finalCritCount === 0 ? '#34d399' : '#f43f5e' }}>
                {simulation.finalCritCount === 0 ? 'Ликвидированы (0)' : `${simulation.finalCritCount} шт.`}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Штраф: -{simulation.finalCritCount}.0 баллов</div>
            </div>
          </div>

          {/* 5 Decisions Grid */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
              Пять ключевых управленческих решений Акима:
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {simulation.decisions.map((d, i) => {
                const m = MEASURES[d.measureId];
                const target = d.districtId ? DISTRICTS[d.districtId]?.nameRu : 'Все 5 районов (Город)';
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(255, 255, 255, 0.03)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                        {m.id}
                      </span>
                      <span style={{ color: '#f8fafc', fontWeight: 600 }}>{m.nameRu}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>{target}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{m.cost} у.е.</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Executive Summary paragraph */}
          <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '14px', borderRadius: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', marginBottom: '4px' }}>
              <Sparkles size={14} />
              <span>Резюме по правилам:</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              {analysis.executiveSummary}
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};
