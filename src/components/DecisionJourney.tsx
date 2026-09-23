import React from 'react';
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
  const district = DISTRICTS[districtId];
  const result = simulation.districts[districtId];
  const priorities = [...INDICATOR_LIST].sort((a, b) => district.indicators[a.id] - district.indicators[b.id]).slice(0, 3);
  const changes = INDICATOR_LIST.filter((indicator) => result.indicatorDeltas[indicator.id] !== 0);
  return <section className="glass-panel journey" aria-label="Путь решения">
    <p className="journey-eyebrow">Проблема → меры → последствия → сравнение</p>
    <h2>Кому поможет ваш бюджет?</h2>
    <p>Распределите 100 у.е. между пятью решениями. Узнайте, что улучшится и какие проблемы останутся через 8 кварталов.</p>
    <p className="journey-note">Учебная модель на синтетических данных, а не прогноз развития города.</p>
    <div className="journey-grid">
      <div>
        <h3>1. Найдите проблему района</h3>
        <label className="journey-label">Район для работы
          <select value={districtId} onChange={(e) => onDistrict(e.target.value as DistrictId)}>
            {DISTRICT_LIST.map((d) => <option key={d.id} value={d.id}>{d.nameRu}</option>)}
          </select>
        </label>
        <p>{district.profileRu}</p>
        <p className="journey-note">Три самых низких исходных показателя. Чем выше балл, тем лучше; ниже 40 — критический уровень.</p>
        <div className="journey-problems">
          {priorities.map((indicator) => <button key={indicator.id} className="journey-problem" aria-pressed={focus === indicator.id} onClick={() => onProblem(focus === indicator.id ? null : indicator.id)}>
            <span>{indicator.nameRu}</span><strong>{district.indicators[indicator.id]}/100</strong>
            <small>{district.indicators[indicator.id] < 40 ? 'Критический уровень' : 'Есть потенциал улучшения'} · Показать меры</small>
          </button>)}
        </div>
      </div>
      <div aria-live="polite">
        <h3>{simulation.isValid ? '3. Оцените последствия' : '2. Подберите меры'}</h3>
        {!simulation.isValid ? <>
          <p>{focus ? `В каталоге — меры, улучшающие показатель «${INDICATORS[focus].nameRu}».` : 'Выберите проблему слева или изучите весь каталог ниже.'} Районные меры по умолчанию направлены в район {district.nameRu}.</p>
          <p>Выбрано {simulation.validation.decisionCount} из 5. Осталось {simulation.validation.remainingBudget} у.е. Не более двух мер одного направления.</p>
          <p className="journey-note">Карточки показывают вклад отдельной меры. Итог с учётом сочетаний появится после пяти допустимых решений.</p>
          <a className="btn-primary" href="#measure-catalog">{focus ? 'Перейти к подходящим мерам' : 'Открыть каталог мер'}</a>
        </> : <>
          <p><strong>{district.nameRu}: {result.initialDistrictScore.toFixed(1)} → {result.finalDistrictScore.toFixed(1)} балла</strong></p>
          {changes.length ? <ul>{changes.map((indicator) => <li key={indicator.id}>{indicator.nameRu}: {result.initialIndicators[indicator.id].toFixed(1)} → {result.finalIndicators[indicator.id].toFixed(1)} {result.indicatorDeltas[indicator.id] < 0 ? '— ухудшение' : '— улучшение'}</li>)}</ul> : <p>Показатели этого района не изменились. Проверьте, получили ли его жители пользу от выбранных мер.</p>}
          <p>{result.criticalIndicators.length ? `Остаются критическими: ${result.criticalIndicators.map((id) => INDICATORS[id].nameRu).join(', ')}.` : 'В этом районе нет показателей ниже критического уровня 40.'}</p>
          <h3>4. Сравните варианты</h3>
          <p>{savedCount === 0 ? 'Сохраните первый вариант с названием. Затем измените меры, сохраните второй и сравните их в сценариях.' : 'Сохраните текущий вариант, затем выберите два сохранённых сценария A и B для сравнения.'}</p>
          <button className="btn-primary" onClick={onCompare}>Сохранить и сравнить варианты</button>
          <p><a href="#measure-catalog">Изменить выбранные меры</a></p>
        </>}
      </div>
    </div>
  </section>;
}
