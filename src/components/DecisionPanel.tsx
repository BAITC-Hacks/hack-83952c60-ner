import { t, useLanguage } from '../i18n';
import React, { useState } from 'react';
import { Plus, AlertCircle, Sparkles } from 'lucide-react';
import { DirectionId, DistrictId, IndicatorId, SelectedDecision } from '../engine/types';
import { MEASURE_LIST, SYNERGIES } from '../data/measures';
import { validateDecisions } from '../engine/validator';
import { DIRECTIONS, DIRECTION_LIST, INDICATORS } from '../data/indicators';
import { DISTRICT_LIST } from '../data/districts';

interface DecisionPanelProps {
  districtId?: DistrictId;
  problemFocus?: IndicatorId | null;
  onClearProblem?: () => void;
  decisions: SelectedDecision[];
  onAddDecision: (decision: SelectedDecision) => void;
  onRemoveDecision: (index: number) => void;
}

export const DecisionPanel: React.FC<DecisionPanelProps> = ({
  districtId = 'nura',
  problemFocus = null,
  onClearProblem,
  decisions,
  onAddDecision,
  onRemoveDecision,
}) => {
  useLanguage();
  const [activeDirectionFilter, setActiveDirectionFilter] = useState<DirectionId | 'all'>('all');
  const [selectedDistricts, setSelectedDistricts] = useState<Record<string, DistrictId>>({});

  const selectedMeasureIds = new Set(decisions.map((d) => d.measureId));

  const filteredMeasures = MEASURE_LIST.filter((m) =>
    problemFocus ? (m.effects[problemFocus] ?? 0) > 0
      : activeDirectionFilter === 'all' || m.direction === activeDirectionFilter);

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
    <div id="measure-catalog" tabIndex={-1} className="glass-panel" style={{ padding: '20px', scrollMarginTop: '20px' }}>
      {problemFocus && <div className="journey-filter" role="status">
        <p>{t('Меры для улучшения:')} <strong>{t(INDICATORS[problemFocus].nameRu)}</strong></p>
        <button className="btn-secondary" onClick={() => { setActiveDirectionFilter('all'); onClearProblem?.(); }}>{t('Показать все меры')}</button>
      </div>}
      
      {/* Category selector keeps all five direction names readable. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {t("Каталог управленческих мероприятий (14 инициатив)")}</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {t("Выберите ровно 5 мер. Максимум 2 на одно направление.")}</p>
        </div>

        <label className="measure-category"><span>{t('Категория мер')}</span>
          <select value={problemFocus ? 'all' : activeDirectionFilter} onChange={event => {
            setActiveDirectionFilter(event.target.value as DirectionId | 'all');
            onClearProblem?.();
          }}>
            <option value="all">{t('Все (14)')}</option>
            {DIRECTION_LIST.map(direction => <option key={direction.id} value={direction.id}>
              {t(direction.nameRu)} ({MEASURE_LIST.filter(measure => measure.direction === direction.id).length})
            </option>)}
          </select>
        </label>
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
              ? (isSelected ? decisions[decisionIndex]?.districtId : selectedDistricts[measure.id]) || districtId
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
                  : 'var(--surface-subtle)',
                border: isSelected
                  ? '1px solid #3b82f6'
                  : isBlocked
                  ? '1px solid rgba(244, 63, 94, 0.4)'
                  : '1px solid var(--border-subtle)',
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
                        color: 'var(--text-main)',
                        background: `${dirMeta.color}15`,
                        padding: '2px 6px',
                        borderRadius: '6px',
                        border: `1px solid ${dirMeta.color}35`,
                      }}
                    >
                      {measure.id}
                    </span>
                    <span className="badge" style={{ fontSize: '0.68rem', background: 'var(--surface-soft)', color: 'var(--text-muted)' }}>
                      {t(measure.type)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: isSelected ? 'var(--color-cyan)' : 'var(--text-main)',
                      }}
                    >
                      {measure.cost} {t("у.е.")}</span>
                  </div>
                </div>

                {/* Measure Name */}
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.35, marginBottom: '6px' }}>
                  {t(measure.nameRu)}
                </h4>

                {/* Lag and realized fraction */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '8px' }}>
                  <span>{t('Задержка: {0} кв. Ниже — вклад за 8 кварталов, до сочетаний и ограничения 0–100.', [measure.lag])}</span>
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
                        color: (val || 0) > 0 ? 'var(--color-green)' : 'var(--color-rose)',
                        border: (val || 0) > 0 ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(244, 63, 94, 0.25)',
                        fontWeight: 600,
                      }}
                    >
                      {t(INDICATORS[ind as IndicatorId].nameRu)}: {(val || 0) > 0 ? '+' : ''}{((val || 0) * (8 - measure.lag) / 8).toFixed(1)}
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
                      color: 'var(--color-cyan)',
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
                      color: 'var(--color-rose)',
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
                      background: 'var(--surface-input)',
                      border: '1px solid var(--border-strong)',
                      color: 'var(--text-main)',
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
                    {t("Все 6 районов города")}
                  </div>
                )}

                {isSelected ? (
                  <button
                    onClick={() => onRemoveDecision(decisionIndex)}
                    style={{
                      background: 'rgba(244, 63, 94, 0.15)',
                      color: 'var(--color-rose)',
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
