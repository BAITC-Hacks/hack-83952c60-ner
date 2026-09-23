import React from 'react';
import { t, useLanguage } from '../i18n';
import { DISTRICT_LIST } from '../data/districts';
import { INDICATOR_LIST } from '../data/indicators';
import type { DistrictId, IndicatorId, SimulationResult } from '../engine/types';

interface Props {
  simulation: SimulationResult;
  onRequest: (district: DistrictId, indicator: IndicatorId) => void;
}

export function DistrictCouncil({ simulation, onRequest }: Props) {
  useLanguage();
  return <section className="glass-panel journey" aria-label={t('Совещание районных акимов')}>
    <p className="journey-eyebrow">{t('Городской бюджет · 6 районных акиматов')}</p>
    <h2>{t('Совещание районных акимов')}</h2>
    <p>{t('Вы — аким города Астаны. В игре вы распределяете общий бюджет между районами и выбираете системные меры: транспорт, социальные объекты и городскую инфраструктуру.')}</p>
    <p>{t('У каждого района свой акимат. В игровой модели районные акимы собирают обращения жителей, запрашивают финансирование и организуют местные работы: благоустройство, содержание дворов и улиц, освещение.')}</p>
    <p className="journey-note">{t('Обращения ниже — игровые, на основе исходных показателей. Балл района отражает результат вашего плана, а не персональную оценку реального акима.')}</p>
    <div className="council-grid">
      {DISTRICT_LIST.map((district) => {
        const priority = [...INDICATOR_LIST].sort((a, b) => district.indicators[a.id] - district.indicators[b.id])[0];
        const result = simulation.districts[district.id];
        const falling = simulation.isValid && result.scoreDelta < -0.005;
        return <article key={district.id} className="council-card" aria-label={t('Акимат района {0}', [district.nameRu])}>
          <h3>{t('Аким района {0}', [district.nameRu])}</h3>
          <p>{t('«Просим выделить средства на направление “{0}”: исходный показатель — {1} из 100».', [priority.nameRu, district.indicators[priority.id]])}</p>
          <button className="btn-secondary" onClick={() => onRequest(district.id, priority.id)}>{t('Рассмотреть запрос: {0}', [district.nameRu])}</button>
          {simulation.isValid ? <div className="council-report">
            <strong>{t('Результат плана: {0} → {1}', [result.initialDistrictScore.toFixed(2), result.finalDistrictScore.toFixed(2)])}</strong>
            <p>{t(falling
              ? 'Игровой сигнал: благополучие снижается. Жители требуют объяснений; запросите у районного акимата план действий.'
              : result.scoreDelta > 0.005
                ? 'Благополучие растёт. Районный акимат отчитывается об улучшении показателей.'
                : 'Благополучие не изменилось. Районный акимат ожидает дополнительных решений.')}</p>
            <p>{result.criticalIndicators.length ? t('Критических показателей: {0}. Нужен отдельный контроль.', [result.criticalIndicators.length]) : t('Критических показателей нет.')}</p>
          </div> : <p className="journey-note">{t('Отчёт появится после выбора пяти допустимых решений.')}</p>}
        </article>;
      })}
    </div>
  </section>;
}
