import React from 'react';
import { DISTRICT_LIST } from '../data/districts';
import { INDICATOR_LIST } from '../data/indicators';
import type { DistrictId, IndicatorId, SimulationResult } from '../engine/types';

interface Props {
  simulation: SimulationResult;
  onRequest: (district: DistrictId, indicator: IndicatorId) => void;
}

export function DistrictCouncil({ simulation, onRequest }: Props) {
  return <section className="glass-panel journey" aria-label="Совещание районных акимов">
    <p className="journey-eyebrow">Городской бюджет · 6 районных акиматов</p>
    <h2>Совещание районных акимов</h2>
    <p>Вы — аким города Астаны. В игре вы распределяете общий бюджет между районами и выбираете системные меры: транспорт, социальные объекты и городскую инфраструктуру.</p>
    <p>У каждого района свой акимат. В игровой модели районные акимы собирают обращения жителей, запрашивают финансирование и организуют местные работы: благоустройство, содержание дворов и улиц, освещение.</p>
    <p className="journey-note">Обращения ниже — игровые, на основе исходных показателей. Балл района отражает результат вашего плана, а не персональную оценку реального акима.</p>
    <div className="council-grid">
      {DISTRICT_LIST.map((district) => {
        const priority = [...INDICATOR_LIST].sort((a, b) => district.indicators[a.id] - district.indicators[b.id])[0];
        const result = simulation.districts[district.id];
        const falling = simulation.isValid && result.scoreDelta < -0.005;
        return <article key={district.id} className="council-card" aria-label={`Акимат района ${district.nameRu}`}>
          <h3>Аким района {district.nameRu}</h3>
          <p>«Просим выделить средства на направление “{priority.nameRu}”: исходный показатель — {district.indicators[priority.id]} из 100».</p>
          <button className="btn-secondary" onClick={() => onRequest(district.id, priority.id)}>Рассмотреть запрос: {district.nameRu}</button>
          {simulation.isValid ? <div className="council-report">
            <strong>Результат плана: {result.initialDistrictScore.toFixed(2)} → {result.finalDistrictScore.toFixed(2)}</strong>
            <p>{falling
              ? 'Игровой сигнал: благополучие снижается. Жители требуют объяснений; запросите у районного акимата план действий.'
              : result.scoreDelta > 0.005
                ? 'Благополучие растёт. Районный акимат отчитывается об улучшении показателей.'
                : 'Благополучие не изменилось. Районный акимат ожидает дополнительных решений.'}</p>
            <p>{result.criticalIndicators.length ? `Критических показателей: ${result.criticalIndicators.length}. Нужен отдельный контроль.` : 'Критических показателей нет.'}</p>
          </div> : <p className="journey-note">Отчёт появится после выбора пяти допустимых решений.</p>}
        </article>;
      })}
    </div>
  </section>;
}
