import React, { useState } from 'react';
import { Bot, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import type { SimulationResult } from '../engine/types';
import { useScenarioAnalysis } from '../ai/useScenarioAnalysis';

interface AIInsightCardProps {
  simulation: SimulationResult;
  scenarioRevision: number;
  hasExperimentalEvents?: boolean;
}

const fallbackReasons = {
  missing_key: 'LLM не подключён на сервере. Показано объяснение по правилам.',
  timeout: 'LLM не ответил за 20 секунд. Показано объяснение по правилам.',
  provider_error: 'Сервис LLM временно недоступен. Показано объяснение по правилам.',
  invalid_response: 'Ответ LLM не прошёл проверку. Показано объяснение по правилам.',
};

export const AIInsightCard: React.FC<AIInsightCardProps> = ({ simulation, scenarioRevision, hasExperimentalEvents = false }) => {
  const [question, setQuestion] = useState('');
  const { result, isStale, isLoading, error, analyze } = useScenarioAnalysis(simulation, scenarioRevision);
  const analysis = result?.analysis;
  const canAnalyze = simulation.isValid && !hasExperimentalEvents && !isLoading;

  return (
    <section className="glass-panel ai-panel" aria-labelledby="analysis-heading" style={{ padding: '20px' }}>
      <div className="panel-heading" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <Bot size={28} color="#a78bfa" style={{ flexShrink: 0 }} />
        <div>
          <h3 id="analysis-heading" style={{ fontSize: '1rem', fontWeight: 700 }}>AI-анализ городского сценария</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Объяснение результатов, сильных сторон, рисков и компромиссов</p>
        </div>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); if (canAnalyze) void analyze(question); }}>
        <label htmlFor="advisor-question" style={{ display: 'block', fontSize: '0.8rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
          Вопрос советнику (необязательно)
        </label>
        <textarea id="advisor-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={2000} rows={2}
          placeholder="Какие компромиссы есть в моём сценарии?" className="advisor-input" />
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', margin: '10px 0 16px' }}>
          <button type="submit" className="btn-primary" disabled={!canAnalyze}>
            <Sparkles size={15} />{isLoading ? 'Анализируем…' : result ? 'Обновить AI-анализ' : 'Получить AI-анализ'}
          </button>
          {!simulation.isValid && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Сначала выберите пять допустимых решений.</span>}
          {hasExperimentalEvents && <span style={{ fontSize: '0.78rem', color: '#fbbf24' }}>Для AI-анализа отключите экспериментальные кризисы.</span>}
          {isLoading && <span role="status" style={{ fontSize: '0.78rem', color: '#93c5fd' }}>Сервер рассчитывает сценарий и готовит объяснение.</span>}
        </div>
      </form>

      {error && <p role="alert" className="analysis-notice">{error}</p>}
      {isStale && <p role="status" className="analysis-notice">Анализ устарел: решения изменились. Обновите его для текущего сценария.</p>}
      {!result && !isLoading && <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Запустите анализ кнопкой. Числовые показатели выше вычисляются математической моделью симулятора.</p>}
      {result && analysis && (
        <div style={{ opacity: isStale ? 0.6 : 1 }} aria-label={isStale ? 'Устаревший анализ' : 'Анализ текущего сценария'}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <strong style={{ fontSize: '0.92rem' }}>{analysis.akimatRatingVerdict}</strong>
            <span className={`badge ${result.source === 'llm' ? 'badge-purple' : 'badge-amber'}`}>{result.source === 'llm' ? 'Анализ LLM' : 'Анализ по правилам'}</span>
          </div>
          {(result.notice || result.reason) && <p className="analysis-notice">{result.notice || (result.reason && fallbackReasons[result.reason])}</p>}
          <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '16px' }}>{analysis.executiveSummary}</p>
          {result.answer && <div className="analysis-answer"><strong>Ответ советника</strong><p style={{ whiteSpace: 'pre-line', marginTop: '6px' }}>{result.answer}</p></div>}
          <div className="analysis-grid">
            <div className="analysis-box analysis-strengths">
              <h4><CheckCircle2 size={16} />Сильные стороны</h4>
              <ul>{analysis.strengths.map((item, index) => <li key={index}>{item}</li>)}</ul>
            </div>
            <div className="analysis-box analysis-risks">
              <h4><AlertTriangle size={16} />Риски и компромиссы</h4>
              <ul>{analysis.risksAndTradeoffs.map((item, index) => <li key={index}>{item}</li>)}</ul>
            </div>
          </div>
          {analysis.districtHighlights.length > 0 && <div className="analysis-answer">
            <h4>Последствия для районов</h4>
            <ul>{analysis.districtHighlights.map((item, index) => <li key={index}><strong>{item.district}:</strong> {item.verdict}{item.criticalWarning && ` ${item.criticalWarning}`}</li>)}</ul>
          </div>}
          {analysis.actionableRecommendations.length > 0 && <div className="analysis-answer">
            <h4>Рекомендации</h4>
            <ul>{analysis.actionableRecommendations.map((item, index) => <li key={index}>{item}</li>)}</ul>
          </div>}
        </div>
      )}
    </section>
  );
};
