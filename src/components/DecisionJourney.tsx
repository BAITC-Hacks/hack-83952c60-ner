import React from 'react';
import { t, useLanguage } from '../i18n';
import { DISTRICTS, DISTRICT_LIST } from '../data/districts';
import { INDICATORS, INDICATOR_LIST } from '../data/indicators';
import { DistrictId, IndicatorId, SimulationResult } from '../engine/types';

interface Props {
  districtId: DistrictId;
  focus: IndicatorId | null;
  simulation: SimulationResult;
  savedCount: number;
  onDistrict: (id: DistrictId) => void;
  onProblem: (id: IndicatorId | null) => void;
  onCompare: () => void;
}

export function DecisionJourney({ districtId, focus, simulation, savedCount, onDistrict, onProblem, onCompare }: Props) {
  useLanguage();
  const district = DISTRICTS[districtId];
  const result = simulation.districts[districtId];
  const priorities = [...INDICATOR_LIST].sort((a, b) => district.indicators[a.id] - district.indicators[b.id]).slice(0, 3);
  const changes = INDICATOR_LIST.filter((indicator) => result.indicatorDeltas[indicator.id] !== 0);
  return <section className="glass-panel journey" aria-label={t('Путь решения')}>
    <p className="journey-eyebrow">{t('Проблема → меры → последствия → сравнение')}</p>
    <h2>{t('Кому поможет ваш бюджет?')}</h2>
    <p>{t('Распределите 100 у.е. между пятью решениями. Узнайте, что улучшится и какие проблемы останутся через 8 кварталов.')}</p>
    <details className="journey-help"><summary>{t('Как работает планирование')}</summary>
      <p>{t('«Район» в каталоге — территория действия меры, а не уровень полномочий районного акима.')}</p>
      <p>{t('Учебная модель на синтетических данных, а не прогноз развития города.')}</p>
    </details>
    <div className="journey-grid">
      <div>
        <h3>{t('1. Найдите проблему района')}</h3>
        <label className="journey-label">{t('Район для работы')}
          <select value={districtId} onChange={(e) => onDistrict(e.target.value as DistrictId)}>
            {DISTRICT_LIST.map((d) => <option key={d.id} value={d.id}>{t(d.nameRu)}</option>)}
          </select>
        </label>
        <details className="journey-help"><summary>{t('О выбранном районе')}</summary><p>{t(district.profileRu)}</p></details>
        <p className="journey-note">{t('Три самых низких исходных показателя. Чем выше балл, тем лучше; ниже 40 — критический уровень.')}</p>
        <div className="journey-problems">
          {priorities.map((indicator) => <button key={indicator.id} className="journey-problem" aria-pressed={focus === indicator.id} onClick={() => onProblem(focus === indicator.id ? null : indicator.id)}>
            <span>{t(indicator.nameRu)}</span><strong>{district.indicators[indicator.id]}/100</strong>
            <small>{t(district.indicators[indicator.id] < 40 ? 'Критический уровень' : 'Есть потенциал улучшения')} · {t('Показать меры')}</small>
          </button>)}
        </div>
      </div>
      <div aria-live="polite">
        <h3>{t(simulation.isValid ? '3. Оцените последствия' : '2. Подберите меры')}</h3>
        {!simulation.isValid ? <>
          <p>{focus ? t('В каталоге — меры, улучшающие показатель «{0}».', [INDICATORS[focus].nameRu]) : t('Выберите проблему слева или изучите весь каталог ниже.')} {t('Меры для отдельного района по умолчанию направлены в район {0}.', [district.nameRu])}</p>
          <p>{t('Выбрано {0} из 5. Осталось {1} у.е. Не более двух мер одного направления.', [simulation.validation.decisionCount, simulation.validation.remainingBudget])}</p>
          <p className="journey-note">{t('Карточки показывают вклад отдельной меры. Итог с учётом сочетаний появится после пяти допустимых решений.')}</p>
          <a className="btn-primary" href="#measure-catalog">{t(focus ? 'Перейти к подходящим мерам' : 'Открыть каталог мер')}</a>
        </> : <>
          <p><strong>{t('{0}: {1} → {2} балла', [district.nameRu, result.initialDistrictScore.toFixed(1), result.finalDistrictScore.toFixed(1)])}</strong></p>
          {changes.length ? <ul>{changes.map((indicator) => <li key={indicator.id}>{t(indicator.nameRu)}: {result.initialIndicators[indicator.id].toFixed(1)} → {result.finalIndicators[indicator.id].toFixed(1)} {t(result.indicatorDeltas[indicator.id] < 0 ? '— ухудшение' : '— улучшение')}</li>)}</ul> : <p>{t('Показатели этого района не изменились. Проверьте, получили ли его жители пользу от выбранных мер.')}</p>}
          <p>{result.criticalIndicators.length ? t('Остаются критическими: {0}.', [result.criticalIndicators.map((id) => t(INDICATORS[id].nameRu)).join(', ')]) : t('В этом районе нет показателей ниже критического уровня 40.')}</p>
          <h3>{t('4. Сравните варианты')}</h3>
          <p>{t(savedCount === 0 ? 'Сохраните первый вариант с названием. Затем измените меры, сохраните второй и сравните их в сценариях.' : 'Сохраните текущий вариант, затем выберите два сохранённых сценария A и B для сравнения.')}</p>
          <button className="btn-primary" onClick={onCompare}>{t('Сохранить и сравнить варианты')}</button>
          <p><a href="#measure-catalog">{t('Изменить выбранные меры')}</a></p>
        </>}
      </div>
    </div>
  </section>;
}
