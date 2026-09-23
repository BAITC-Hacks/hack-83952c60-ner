import { t, useLanguage } from '../i18n';
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
  useLanguage();
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !simulation.isValid) return null;

  const analysis = generateAIAnalysis(simulation);

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    const text = buildPresentationReport(simulation);
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
                {t("Презентация решения Акимата г. Астаны")}</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {t("Готовый исполнительный слайд для защиты перед комиссией")}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleCopy} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
              {copied ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
              {copied ? t("Скопировано!") : t("Копировать")}
            </button>
            <button onClick={handlePrint} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
              <Printer size={14} />
              {t("Печать / PDF")}</button>
            <button
              aria-label={t('Закрыть')}
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
                {t("ГОРОДСКОЙ СИМУЛЯТОР «АКИМ НА 5 ЧАСОВ»")}</span>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc' }}>
                {t("Стратегия развития качества жизни в Астане")}</h2>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                {t("Стиль управления:")}{' '}<strong style={{ color: '#38bdf8' }}>{analysis.akimatRatingVerdict}</strong>
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                {t("Astana QoL Score")}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 800, color: '#38bdf8' }}>
                {simulation.finalScore.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#34d399' }}>
                +{simulation.scoreDelta.toFixed(2)} {t("к базе (52.56)")}</div>
            </div>
          </div>

          {/* 3 Metric Summary Boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{t("Бюджет проекта")}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#f8fafc' }}>
                {simulation.validation.totalCost} {t("/ 100 у.е.")}</div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{t("Остаток:")}{' '}{simulation.validation.remainingBudget} {t("у.е.")}</div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{t("Слабейший район")}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                {t(DISTRICTS[simulation.weakestDistrictId]?.nameRu)}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{t("Балл:")}{' '}{simulation.finalMinDistrictScore.toFixed(2)}</div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{t("Критические провалы")}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: simulation.finalCritCount === 0 ? '#34d399' : '#f43f5e' }}>
                {simulation.finalCritCount === 0 ? t("Ликвидированы (0)") : t("{0} шт.", [simulation.finalCritCount])}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{t("Штраф: -")}{simulation.finalCritCount}{t(".0 баллов")}</div>
            </div>
          </div>

          {/* 5 Decisions Grid */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
              {t("Пять ключевых управленческих решений Акима:")}{' '}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {simulation.decisions.map((d, i) => {
                const m = MEASURES[d.measureId];
                const target = d.districtId ? t(DISTRICTS[d.districtId]?.nameRu) : t("Все 5 районов (Город)");
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
                      <span style={{ color: '#f8fafc', fontWeight: 600 }}>{t(m.nameRu)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>{target}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{m.cost} {t("у.е.")}</span>
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
              <span>{t("Резюме по правилам:")}</span>
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

/** Uses the current locale for both the report headings and its dynamic content. */
export function buildPresentationReport(simulation: SimulationResult): string {
  if (!simulation.isValid) return simulation.validation.errors.join('\n');
  const analysis = generateAIAnalysis(simulation);
  return t("ОТЧЕТ АКИМА ГОРОДА АСТАНЫ «АКИМ НА 5 ЧАСОВ»\n--------------------------------------------------\nИтоговый Astana Quality of Life Score: {0} (прирост: +{1} к базовому уровню 52.56)\nБюджет: израсходовано {2} из 100 у.е. (остаток: {3} у.е.)\nСлабейший район: {4} (балл: {5})\nКритические провалы (<40): {6}\n\nПРИНЯТЫЕ РЕШЕНИЯ (5 МЕР):\n{7}\n\nАКТИВНЫЕ СИНЕРГИИ:\n{8}\n\nОЦЕНКА УПРАВЛЕНЧЕСКОГО СТИЛЯ:\n{9}\n\nСИЛЬНЫЕ СТОРОНЫ:\n{10}\n\nСКРЫТЫЕ РИСКИ И КОМПРОМИССЫ:\n{11}\n", [simulation.finalScore.toFixed(2), simulation.scoreDelta.toFixed(2), simulation.validation.totalCost, simulation.validation.remainingBudget, DISTRICTS[simulation.weakestDistrictId]?.nameRu, simulation.finalMinDistrictScore.toFixed(2), simulation.finalCritCount, simulation.decisions.map((d, i) => {
  const m = MEASURES[d.measureId];
  const target = d.districtId ? t(DISTRICTS[d.districtId]?.nameRu) : t('Общегородское');
  return t('{0}. [{1}] {2} — {3} (стоимость: {4} у.е., лаг: {5} кв.)', [i + 1, m.id, m.nameRu, target, m.cost, m.lag]);
}).join('\n'), simulation.activeSynergies.map(value => t(value)).join('\n') || t('Отсутствуют'), analysis.akimatRatingVerdict, analysis.strengths.join('\n'), analysis.risksAndTradeoffs.join('\n')]);
}
