import { t, useLanguage } from '../i18n';
import React, { useState } from 'react';
import { Award, Plus, Trash2, X, ArrowUpRight } from 'lucide-react';
import { SelectedDecision, SimulationResult } from '../engine/types';

export interface SavedScenario {
  id: string;
  teamName: string;
  score: number;
  scoreDelta: number;
  cost: number;
  decisions: SelectedDecision[];
  critCount: number;
  createdAt: string;
}

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSim: SimulationResult;
  onLoadScenario: (decisions: SelectedDecision[]) => void;
}

export const CompareModal: React.FC<CompareModalProps> = ({
  isOpen,
  onClose,
  currentSim,
  onLoadScenario,
}) => {
  useLanguage();
  const [teamName, setTeamName] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<SavedScenario[]>([
    {
      id: 'default-1',
      teamName: "Эталон ТЗ (Benchmark Team)",
      score: 56.50,
      scoreDelta: 3.94,
      cost: 95,
      critCount: 0,
      decisions: [
        { measureId: 'M7', districtId: 'nura' },
        { measureId: 'M8', districtId: 'nura' },
        { measureId: 'M10', districtId: 'nura' },
        { measureId: 'M12' },
        { measureId: 'M5', districtId: 'saryarka' },
      ],
      createdAt: '10:15',
    },
    {
      id: 'default-2',
      teamName: "Транспортный фокус (Transit First)",
      score: 54.20,
      scoreDelta: 1.64,
      cost: 88,
      critCount: 2,
      decisions: [
        { measureId: 'M1', districtId: 'almaty' },
        { measureId: 'M2' },
        { measureId: 'M10', districtId: 'saryarka' },
        { measureId: 'M12' },
        { measureId: 'M6' },
      ],
      createdAt: '11:30',
    },
  ]);

  if (!isOpen) return null;

  const handleSaveCurrent = () => {
    if (!currentSim.isValid) return;
    const newSc: SavedScenario = {
      id: Date.now().toString(),
      teamName: teamName?.trim() || t("Команда Астана-1"),
      score: Number(currentSim.finalScore.toFixed(2)),
      scoreDelta: Number(currentSim.scoreDelta.toFixed(2)),
      cost: currentSim.validation.totalCost,
      critCount: currentSim.finalCritCount,
      decisions: [...currentSim.decisions],
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setScenarios((prev) => [newSc, ...prev]);
  };

  const handleDelete = (id: string) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
          maxWidth: '720px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          background: 'rgba(15, 23, 42, 0.95)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Award size={22} color="#a78bfa" />
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                {t("Сравнение команд и сценариев (Лидерборд)")}</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {t("Оценка и ранжирование различных стратегий распределения бюджета")}</p>
            </div>
          </div>
          <button
            aria-label={t('Закрыть')}
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Save Current Attempt Form */}
        <div
          style={{
            padding: '14px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <input
            type="text"
            value={teamName ?? t("Команда Астана-1")}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder={t("Название вашей команды...")}
            style={{
              flex: 1,
              minWidth: '200px',
              background: 'rgba(10, 15, 29, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#f8fafc',
              fontSize: '0.85rem',
              padding: '8px 12px',
              borderRadius: '8px',
              outline: 'none',
            }}
          />
          <button
            disabled={!currentSim.isValid}
            onClick={handleSaveCurrent}
            className="btn-primary"
            style={{
              padding: '8px 16px',
              opacity: currentSim.isValid ? 1 : 0.4,
              cursor: currentSim.isValid ? 'pointer' : 'not-allowed',
            }}
          >
            <Plus size={16} />
            {t("Зафиксировать результат (")}{currentSim.isValid ? currentSim.finalScore.toFixed(2) : t("невалиден")})
          </button>
        </div>

        {/* Table / List of Scenarios */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'left', color: 'var(--text-dim)' }}>
                <th style={{ padding: '8px' }}>{t("Команда")}</th>
                <th style={{ padding: '8px' }}>{t("Score")}</th>
                <th style={{ padding: '8px' }}>{t("Дельта")}</th>
                <th style={{ padding: '8px' }}>{t("Бюджет")}</th>
                <th style={{ padding: '8px' }}>{t("Штрафы")}</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>{t("Действия")}</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((sc, i) => (
                <tr
                  key={sc.id}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    background: i === 0 ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '10px 8px', fontWeight: 600, color: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {i === 0 && <span title={t("Лидер")}>👑</span>}
                      <span>{sc.id.startsWith('default-') ? t(sc.teamName) : sc.teamName}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>
                    {sc.score.toFixed(2)}
                  </td>
                  <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)', color: sc.scoreDelta > 0 ? '#34d399' : '#fb7185' }}>
                    {sc.scoreDelta > 0 ? `+${sc.scoreDelta.toFixed(2)}` : sc.scoreDelta.toFixed(2)}
                  </td>
                  <td style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>
                    {sc.cost}/100
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    {sc.critCount === 0 ? (
                      <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>{t("0 (OK)")}</span>
                    ) : (
                      <span className="badge badge-red" style={{ fontSize: '0.65rem' }}>-{sc.critCount}</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        onClick={() => {
                          onLoadScenario(sc.decisions);
                          onClose();
                        }}
                        className="btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                        title={t("Загрузить этот сценарий в симулятор")}
                      >
                        <ArrowUpRight size={13} />
                        {t("Загрузить")}</button>
                      <button
                        onClick={() => handleDelete(sc.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-dim)',
                          cursor: 'pointer',
                          padding: '4px',
                        }}
                        title={t("Удалить")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};
