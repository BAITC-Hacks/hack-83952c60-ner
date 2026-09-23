import React, { useState } from 'react';
import { Bot, Sparkles, AlertTriangle, CheckCircle2, Send, Key } from 'lucide-react';
import { SimulationResult } from '../engine/types';
import { generateAIAnalysis } from '../ai/analyzer';
import { askAICityAdvisor, LLMConfig } from '../ai/llmClient';

interface AIInsightCardProps {
  simulation: SimulationResult;
}

export const AIInsightCard: React.FC<AIInsightCardProps> = ({ simulation }) => {
  const [activeTab, setActiveTab] = useState<'briefing' | 'advisor'>('briefing');
  const [userQuery, setUserQuery] = useState('');
  const [chatLog, setChatLog] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<'local' | 'openai'>('local');

  const analysis = generateAIAnalysis(simulation);

  const handleAskQuestion = async (question: string) => {
    if (!question.trim()) return;
    const q = question.trim();
    setUserQuery('');
    setChatLog((prev) => [...prev, { sender: 'user', text: q }]);
    setIsLoading(true);

    try {
      const config: LLMConfig = {
        provider,
        apiKey: apiKey.trim() || undefined,
      };
      const response = await askAICityAdvisor(simulation, q, config);
      setChatLog((prev) => [...prev, { sender: 'ai', text: response }]);
    } catch (e: any) {
      setChatLog((prev) => [...prev, { sender: 'ai', text: `Ошибка: ${e.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '20px' }}>
      
      {/* Header and Tab Selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(139, 92, 246, 0.4)',
            }}
          >
            <Bot size={20} color="#ffffff" />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
              Agentic AI Аналитик &amp; Советник Акима
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Глубокий анализ последствий, компромиссов и рисков управления городом
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setActiveTab('briefing')}
            style={{
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '8px',
              border: activeTab === 'briefing' ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.08)',
              background: activeTab === 'briefing' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
              color: activeTab === 'briefing' ? '#93c5fd' : 'var(--text-dim)',
              cursor: 'pointer',
            }}
          >
            Сводный отчет
          </button>
          <button
            onClick={() => setActiveTab('advisor')}
            style={{
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '8px',
              border: activeTab === 'advisor' ? '1px solid #8b5cf6' : '1px solid rgba(255, 255, 255, 0.08)',
              background: activeTab === 'advisor' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
              color: activeTab === 'advisor' ? '#c4b5fd' : 'var(--text-dim)',
              cursor: 'pointer',
            }}
          >
            Диалог с Советником
          </button>
        </div>
      </div>

      {activeTab === 'briefing' ? (
        <div>
          {/* Akimat Rating Verdict Banner */}
          <div
            style={{
              padding: '12px 16px',
              background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.15))',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '10px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#93c5fd', fontWeight: 700 }}>
                Оценка управленческого стиля Акима
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                {analysis.akimatRatingVerdict}
              </div>
            </div>
            <span className="badge badge-purple" style={{ padding: '4px 10px' }}>
              <Sparkles size={12} /> AI-верифицировано
            </span>
          </div>

          {/* Executive Summary */}
          <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '16px' }}>
            {analysis.executiveSummary}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            
            {/* Strengths */}
            <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '10px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#34d399', fontSize: '0.85rem', fontWeight: 700 }}>
                <CheckCircle2 size={16} />
                <span>Сильные стороны сценария</span>
              </div>
              {analysis.strengths.length > 0 ? (
                <ul style={{ paddingLeft: '18px', fontSize: '0.78rem', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {analysis.strengths.map((str, i) => (
                    <li key={i}>{str}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  Пока не выявлено ключевых преимуществ. Добавьте синергетические или точечные меры.
                </p>
              )}
            </div>

            {/* Risks & Trade-offs */}
            <div style={{ background: 'rgba(244, 63, 94, 0.05)', border: '1px solid rgba(244, 63, 94, 0.2)', borderRadius: '10px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#fb7185', fontSize: '0.85rem', fontWeight: 700 }}>
                <AlertTriangle size={16} />
                <span>Скрытые риски и компромиссы</span>
              </div>
              {analysis.risksAndTradeoffs.length > 0 ? (
                <ul style={{ paddingLeft: '18px', fontSize: '0.78rem', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {analysis.risksAndTradeoffs.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: '0.75rem', color: '#34d399' }}>
                  Существенных скрытых рисков не обнаружено. Баланс соблюден.
                </p>
              )}
            </div>

          </div>

          {/* Actionable recommendations */}
          {analysis.actionableRecommendations.length > 0 && (
            <div style={{ marginTop: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', marginBottom: '8px' }}>
                💡 Стратегические рекомендации по оптимизации:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem', color: '#e2e8f0' }}>
                {analysis.actionableRecommendations.map((rec, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{ color: '#38bdf8' }}>•</span>
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      ) : (
        /* Interactive AI Advisor Chat Tab */
        <div style={{ display: 'flex', flexDirection: 'column', height: '360px' }}>
          
          {/* Quick preset questions */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {[
              'Как поднять показатели Нуры?',
              'Какие синергии можно активировать?',
              'Как использовать остаток бюджета?',
            ].map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleAskQuestion(prompt)}
                className="btn-secondary"
                style={{ fontSize: '0.7rem', padding: '4px 8px' }}
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Chat Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              background: 'rgba(10, 15, 29, 0.5)',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginBottom: '10px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            {chatLog.length === 0 ? (
              <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                Советник готов к консультации. Задайте вопрос по текущему сценарию.
              </div>
            ) : (
              chatLog.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    background: msg.sender === 'user' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                    border: msg.sender === 'user' ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    fontSize: '0.8rem',
                    color: '#f8fafc',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {msg.text}
                </div>
              ))
            )}
            {isLoading && (
              <div style={{ color: '#38bdf8', fontSize: '0.75rem', fontStyle: 'italic' }}>
                Советник анализирует городской контекст...
              </div>
            )}
          </div>

          {/* Input Box */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion(userQuery)}
              placeholder="Спросите советника о компромиссах, синергиях или рисках..."
              style={{
                flex: 1,
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#f8fafc',
                fontSize: '0.8rem',
                padding: '8px 12px',
                borderRadius: '8px',
                outline: 'none',
              }}
            />
            <button
              onClick={() => handleAskQuestion(userQuery)}
              className="btn-primary"
              style={{ padding: '8px 14px' }}
            >
              <Send size={15} />
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
