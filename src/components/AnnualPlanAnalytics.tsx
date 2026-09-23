import React, { useId } from 'react';
import { CalendarRange, Info, TrendingUp } from 'lucide-react';
import { t, useLanguage } from '../i18n';
import type { AnnualPlan } from '../engine/annualPlan';
import './AnnualPlanAnalytics.css';

interface AnnualPlanAnalyticsProps {
  plan: AnnualPlan;
  selectedYear: 1 | 2 | 3;
  onYearChange: (year: 1 | 2 | 3) => void;
}

export const AnnualPlanAnalytics: React.FC<AnnualPlanAnalyticsProps> = ({ plan, selectedYear, onYearChange }) => {
  const language = useLanguage();
  const id = useId();
  const locale = language === 'en' ? 'en-US' : language === 'kk' ? 'kk-KZ' : 'ru-RU';
  const score = (value: number) => value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const amount = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 2 });
  const delta = (value: number) => `${value > 0 ? '+' : ''}${score(value)}`;
  const deltaClass = (value: number) => value > 0 ? 'annual-plan__positive' : value < 0 ? 'annual-plan__negative' : '';
  const selected = plan.years.find(year => year.year === selectedYear);
  const validYears = plan.years.filter(year => year.simulation.isValid);
  const hasResults = plan.isValid && validYears.length === 3 && selected?.simulation.isValid;
  const baseline = plan.years[0]?.simulation.baseScore ?? 0;
  const baselineCritical = plan.years[0]?.simulation.baseCritCount ?? 0;
  const points = [baseline, ...validYears.map(year => year.simulation.finalScore ?? baseline)];
  const lower = Math.floor((Math.min(...points) - 3) / 5) * 5;
  const upper = Math.ceil((Math.max(...points) + 3) / 5) * 5;
  const x = (index: number) => 64 + index * 176;
  const y = (value: number) => 190 - ((value - lower) / (upper - lower)) * 142;
  const path = points.map((value, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(value)}`).join(' ');
  const previous = plan.years.find(year => year.year === selectedYear - 1)?.simulation;
  const previousScore = previous?.isValid ? previous.finalScore : baseline;
  const selectedScore = selected?.simulation.isValid ? selected.simulation.finalScore : baseline;
  const annualChange = selectedScore - previousScore;
  const totalChange = selectedScore - baseline;

  return (
    <section className="glass-panel annual-plan" aria-labelledby={`${id}-title`}>
      <header className="annual-plan__header">
        <div className="annual-plan__heading">
          <span className="annual-plan__icon" aria-hidden="true"><CalendarRange size={22} /></span>
          <div>
            <h3 id={`${id}-title`}>{t('План на 3 года')}</h3>
            <p>{t('Динамика качества жизни и бюджета после запуска выбранных мер.')}</p>
          </div>
        </div>
        <span className="annual-plan__badge">{t('Сценарный расчёт')}</span>
      </header>

      <div className="annual-plan__years" role="group" aria-label={t('Год для анализа')}>
        {([1, 2, 3] as const).map(year => (
          <button
            type="button"
            key={year}
            aria-pressed={selectedYear === year}
            aria-controls={`${id}-results`}
            onClick={() => onYearChange(year)}
          >
            <strong>{t('Год {0}', [year])}</strong>
            <span>{t('Конец {0}-го квартала', [year * 4])}</span>
          </button>
        ))}
      </div>

      <div id={`${id}-results`}>
        {hasResults && selected ? (
          <>
            <dl className="annual-plan__metrics" aria-live="polite" aria-atomic="true">
              <div>
                <dt>{t('Score на конец года {0}', [selectedYear])}</dt>
                <dd className="annual-plan__score">
                  {score(selectedScore)}
                  <span>{t('Относительно базы: {0}', [delta(totalChange)])}</span>
                </dd>
              </div>
              <div>
                <dt>{t('Изменение за год')}</dt>
                <dd className={deltaClass(annualChange)}>
                  {delta(annualChange)}
                  <span>{selectedYear === 1 ? t('Сравнение с исходным уровнем') : t('Сравнение с концом предыдущего года')}</span>
                </dd>
              </div>
              <div>
                <dt>{t('Критические показатели')}</dt>
                <dd className={selected.simulation.finalCritCount > 0 ? 'annual-plan__negative' : 'annual-plan__positive'}>
                  {selected.simulation.finalCritCount}
                  <span>{t('Исходно: {0}. Порог: ниже 40.', [baselineCritical])}</span>
                </dd>
              </div>
            </dl>

            <figure className="annual-plan__chart">
              <figcaption><TrendingUp size={16} aria-hidden="true" />{t('Траектория Astana Quality of Life Score')}</figcaption>
              <svg viewBox="0 0 656 248" role="img" aria-labelledby={`${id}-chart-title ${id}-chart-description`}>
                <title id={`${id}-chart-title`}>{t('Score: базовый уровень и три года')}</title>
                <desc id={`${id}-chart-description`}>
                  {t('Базовый Score: {0}. Точные значения по годам приведены в таблице ниже.', [score(baseline)])}
                </desc>
                {[0, 1, 2, 3, 4].map(index => {
                  const value = lower + (upper - lower) * index / 4;
                  return <g key={index} className="annual-plan__grid">
                    <line x1="64" x2="592" y1={y(value)} y2={y(value)} />
                    <text x="48" y={y(value) + 5} textAnchor="end">{amount(value)}</text>
                  </g>;
                })}
                <line className="annual-plan__baseline" x1="64" x2="592" y1={y(baseline)} y2={y(baseline)} />
                <path className="annual-plan__line" d={path} />
                {points.map((value, index) => (
                  <g key={index} className={index === selectedYear ? 'annual-plan__point annual-plan__point--selected' : 'annual-plan__point'}>
                    {index === selectedYear && <circle className="annual-plan__halo" cx={x(index)} cy={y(value)} r="12" />}
                    <circle cx={x(index)} cy={y(value)} r={index === selectedYear ? 5 : 4} />
                    <text className="annual-plan__point-value" x={x(index)} y={y(value) - 18} textAnchor={index === 0 ? 'start' : index === 3 ? 'end' : 'middle'}>{score(value)}</text>
                    <text className="annual-plan__point-label" x={x(index)} y="229" textAnchor="middle">{index === 0 ? t('База') : t('Год {0}', [index])}</text>
                  </g>
                ))}
              </svg>
              <div className="annual-plan__legend"><span aria-hidden="true" />{t('Пунктир — исходный Score')}</div>
            </figure>

            <div className="annual-plan__table-scroll" tabIndex={0} role="region" aria-label={t('Таблица результатов за три года')}>
              <table>
                <caption>{t('Результаты и бюджет по годам')}</caption>
                <thead><tr>
                  <th scope="col">{t('Период')}</th>
                  <th scope="col">{t('Score')}</th>
                  <th scope="col">{t('Изменение за год')}</th>
                  <th scope="col">{t('Критические показатели')}</th>
                  <th scope="col">{t('Расход за год, у.е.')}</th>
                  <th scope="col">{t('Всего потрачено, у.е.')}</th>
                  <th scope="col">{t('Остаток, у.е.')}</th>
                </tr></thead>
                <tbody>{plan.years.map((year, index) => {
                  if (!year.simulation.isValid) return null;
                  const previousSimulation = plan.years[index - 1]?.simulation;
                  const change = year.simulation.finalScore - (previousSimulation?.isValid ? previousSimulation.finalScore : baseline);
                  return <tr key={year.year} aria-current={selectedYear === year.year ? 'true' : undefined}>
                    <th scope="row">{t('Год {0}', [year.year])}<span>{t('Квартал {0}', [year.quarter])}</span></th>
                    <td>{score(year.simulation.finalScore)}</td>
                    <td className={deltaClass(change)}>{delta(change)}</td>
                    <td>{year.simulation.finalCritCount}</td>
                    <td>{amount(year.annualSpending)}</td>
                    <td>{amount(year.cumulativeSpending)}</td>
                    <td>{amount(year.remainingBudget)}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="annual-plan__empty" role="status">
            <CalendarRange size={28} aria-hidden="true" />
            <h4>{t('Соберите план из пяти решений')}</h4>
            <p>{t('После устранения ошибок сценария здесь появятся Score, бюджет и критические показатели на конец каждого года.')}</p>
          </div>
        )}
      </div>

      <aside className="annual-plan__assumptions" aria-label={t('Допущения трёхлетнего плана')}>
        <Info size={17} aria-hidden="true" />
        <div>
          <p>{t('Все пять мер запускаются одновременно и оплачиваются один раз в первый год из общего бюджета. Во второй и третий годы бюджет не пополняется, остаток переносится без изменений. Новые меры не добавляются.')}</p>
          <p>{t('Это синтетический сценарий, а не статистический прогноз. Эффекты линейно нарастают в течение восьми кварталов после задержки запуска, затем достигают полного значения. Конец второго года соответствует основному расчёту Score.')}</p>
        </div>
      </aside>
    </section>
  );
};
