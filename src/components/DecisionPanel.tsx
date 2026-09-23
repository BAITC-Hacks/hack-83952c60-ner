import { t, useLanguage } from '../i18n';
import React, { useState } from 'react';
import { Plus, AlertCircle, Sparkles } from 'lucide-react';
import { DirectionId, DistrictId, SelectedDecision } from '../engine/types';
import { MEASURE_LIST, SYNERGIES } from '../data/measures';
import { validateDecisions } from '../engine/validator';
import { DIRECTIONS, DIRECTION_LIST } from '../data/indicators';
import { DISTRICT_LIST, DISTRICTS } from '../data/districts';

interface DecisionPanelProps {
  decisions: SelectedDecision[];
  onAddDecision: (decision: SelectedDecision) => void;
  onRemoveDecision: (index: number) => void;
}

export const DecisionPanel: React.FC<DecisionPanelProps> = ({
  decisions,
  onAddDecision,
  onRemoveDecision,
}) => {
  useLanguage();
  const [activeDirectionFilter, setActiveDirectionFilter] = useState<DirectionId | 'all'>('all');
  const [selectedDistricts, setSelectedDistricts] = useState<Record<string, DistrictId>>({
    M1: 'nura',
    M3: 'esil',
    M4: 'esil',
    M5: 'saryarka',
    M7: 'nura',
    M8: 'nura',
    M9: 'nura',
    M10: 'nura',
    M11: 'nura',
    M13: 'almaty',
  });

  const selectedMeasureIds = new Set(decisions.map((d) => d.measureId));

  const filteredMeasures = activeDirectionFilter === 'all'
    ? MEASURE_LIST
    : MEASURE_LIST.filter((m) => m.direction === activeDirectionFilter);

  const handleDistrictChange = (measureId: string, districtId: DistrictId) => {
    setSelectedDistricts((prev) => ({ ...prev, [measureId]: districtId }));
  };

  const getSynergyBonus = (measureId: string): string | null => {
    for (const rule of SYNERGIES) {
      if (rule.pair.includes(measureId)) {
        const partner = rule.pair.find((id) => id !== measureId)!;
        if (selectedMeasureIds.has(partner)) {
          return selectedMeasureIds.has(measureId)
            ? t("Синергия активна с {0}!", [partner])
            : t("Возможная синергия с {0}", [partner]);
        }
      }
    }
    return null;
  };

  return (
    <div className="glass-panel" style={{ padding: '20px' }}>
      
      {/* Header and Direction Filter Pills */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
            {t("Каталог управленческих мероприятий (14 инициатив)")}</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {t("Выберите ровно 5 мер. Максимум 2 на одно направление.")}</p>
        </div>

        {/* Filter buttons */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveDirectionFilter('all')}
            style={{
              fontSize: '0.72rem',
              padding: '4px 10px',
              borderRadius: '8px',
              border: activeDirectionFilter === 'all' ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.08)',
              background: activeDirectionFilter === 'all' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
              color: activeDirectionFilter === 'all' ? '#93c5fd' : 'var(--text-dim)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {t("Все (14)")}</button>
          {DIRECTION_LIST.map((dir) => {
            const isActive = activeDirectionFilter === dir.id;
            return (
              <button
                key={dir.id}
                onClick={() => setActiveDirectionFilter(dir.id)}
                style={{
                  fontSize: '0.72rem',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: isActive ? `1px solid ${dir.color}` : '1px solid rgba(255, 255, 255, 0.08)',
                  background: isActive ? `${dir.color}25` : 'rgba(255, 255, 255, 0.03)',
                  color: isActive ? '#f8fafc' : 'var(--text-dim)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dir.color }} />
                <span>{t(dir.nameRu).split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Measure Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '14px' }}>
        {filteredMeasures.map((measure) => {
          const isSelected = selectedMeasureIds.has(measure.id);
          const decisionIndex = decisions.findIndex((d) => d.measureId === measure.id);
          const synergyNotice = getSynergyBonus(measure.id);
          const dirMeta = DIRECTIONS[measure.direction];

          const chosenDistrict =
            measure.type === 'Район'
              ? (isSelected ? decisions[decisionIndex]?.districtId : selectedDistricts[measure.id]) || 'nura'
              : undefined;
          const proposedDecision: SelectedDecision = chosenDistrict
            ? { measureId: measure.id, districtId: chosenDistrict }
            : { measureId: measure.id };
          const candidateValidation = validateDecisions([...decisions, proposedDecision], { allowIncomplete: true });
          const isBlocked = !isSelected && !candidateValidation.isValid;
          const blockedReason = t("При добавлении: {0}", [candidateValidation.errors.join(' ')]);

          return (
            <div
              key={measure.id}
              data-testid={`measure-${measure.id}`}
              style={{
                background: isSelected
                  ? 'rgba(59, 130, 246, 0.12)'
                  : 'rgba(255, 255, 255, 0.02)',
                border: isSelected
                  ? '1px solid #3b82f6'
                  : isBlocked
                  ? '1px solid rgba(244, 63, 94, 0.4)'
                  : '1px solid rgba(255, 255, 255, 0.07)',
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.2s',
              }}
            >
              <div>
                {/* Header row: ID, Tag, Cost */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        color: dirMeta.color,
                        background: `${dirMeta.color}15`,
                        padding: '2px 6px',
                        borderRadius: '6px',
                        border: `1px solid ${dirMeta.color}35`,
                      }}
                    >
                      {measure.id}
                    </span>
                    <span className="badge" style={{ fontSize: '0.68rem', background: 'rgba(255, 255, 255, 0.06)', color: 'var(--text-muted)' }}>
                      {t(measure.type)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: isSelected ? '#38bdf8' : '#f8fafc',
                      }}
                    >
                      {measure.cost} {t("у.е.")}</span>
                  </div>
                </div>

                {/* Measure Name */}
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', lineHeight: 1.35, marginBottom: '6px' }}>
                  {t(measure.nameRu)}
                </h4>

                {/* Lag and realized fraction */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '8px' }}>
                  <span>{t("Лаг:")}{' '}{measure.lag} {t("кв. (эффект:")}{' '}{((8 - measure.lag) / 8 * 100).toFixed(1)}%)</span>
                </div>

                {/* Direct Effects tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                  {Object.entries(measure.effects).map(([ind, val]) => (
                    <span
                      key={ind}
                      style={{
                        fontSize: '0.68rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: (val || 0) > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                        color: (val || 0) > 0 ? '#34d399' : '#fb7185',
                        border: (val || 0) > 0 ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(244, 63, 94, 0.25)',
                        fontWeight: 600,
                      }}
                    >
                      {ind} {(val || 0) > 0 ? `+${val}` : val}
                    </span>
                  ))}
                </div>

                {/* Synergy notification */}
                {synergyNotice && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.68rem',
                      color: '#38bdf8',
                      marginBottom: '8px',
                      background: 'rgba(6, 182, 212, 0.1)',
                      padding: '3px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    <Sparkles size={11} />
                    <span>{synergyNotice}</span>
                  </div>
                )}

                {/* Conflict notice */}
                {isBlocked && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.68rem',
                      color: '#fb7185',
                      marginBottom: '8px',
                      background: 'rgba(244, 63, 94, 0.1)',
                      padding: '3px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    <AlertCircle size={11} />
                    <span id={`measure-${measure.id}-restriction`}>{blockedReason}</span>
                  </div>
                )}
              </div>

              {/* Bottom action row: District Picker + Select Button */}
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {measure.type === 'Район' ? (
                  <select
                    aria-label={t("Район для {0}", [measure.id])}
                    disabled={isSelected}
                    value={chosenDistrict}
                    onChange={(e) => handleDistrictChange(measure.id, e.target.value as DistrictId)}
                    style={{
                      flex: 1,
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#f8fafc',
                      fontSize: '0.75rem',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      outline: 'none',
                    }}
                  >
                    {DISTRICT_LIST.map((d) => (
                      <option key={d.id} value={d.id}>
                        {t(d.nameRu)} ({(d.populationShare * 100).toFixed(0)}%)
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ flex: 1, fontSize: '0.72rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                    {t("Все 5 районов города")}</div>
                )}

                {isSelected ? (
                  <button
                    onClick={() => onRemoveDecision(decisionIndex)}
                    style={{
                      background: 'rgba(244, 63, 94, 0.15)',
                      color: '#fb7185',
                      border: '1px solid rgba(244, 63, 94, 0.3)',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {t("Убрать")}</button>
                ) : (
                  <button
                    disabled={isBlocked}
                    aria-label={t("Выбрать {0}", [measure.id])}
                    aria-describedby={isBlocked ? `measure-${measure.id}-restriction` : undefined}
                    title={isBlocked ? blockedReason : t("Выбрать {0}", [measure.nameRu])}
                    onClick={() => onAddDecision(proposedDecision)}
                    className="btn-primary"
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      opacity: isBlocked ? 0.45 : 1,
                      cursor: isBlocked ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Plus size={13} />
                    {t("Выбрать")}</button>
                )}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
