import { t, useLanguage } from '../i18n';
import React, { useId, useState } from 'react';
import { DISTRICTS, DISTRICT_LIST } from '../data/districts';
import { INDICATOR_LIST } from '../data/indicators';
import { MEASURES } from '../data/measures';
import type { DistrictId } from '../engine/types';
import type { EvaluatedScenario } from './CompareModal';

export const formatScenarioNumber = (value: number) => value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatScenarioDifference = (value: number, integer = false) => {
  // Hide floating point noise (including a displayed negative zero), never round before comparing/ranking.
  const displayed = integer ? Math.round(value) : Number(value.toFixed(2));
  return `${displayed > 0 ? '+' : displayed < 0 ? '−' : ''}${integer ? Math.abs(displayed) : formatScenarioNumber(Math.abs(displayed))}`;
};

function Difference({ value, integer = false, lowerIsBetter = false, neutral = false }: {
  value: number; integer?: boolean; lowerIsBetter?: boolean; neutral?: boolean;
}) {
  const meaningful = Math.abs(value) >= (integer ? 0.5 : 0.005);
  const improves = lowerIsBetter ? value < 0 : value > 0;
  const tone = neutral || !meaningful ? 'neutral' : improves ? 'positive' : 'negative';
  return <span className={`scenario-difference scenario-difference-${tone}`}>
    {formatScenarioDifference(value, integer)}
    {tone !== 'neutral' && <span className="scenarios-sr-only">{improves ? t(" — улучшение") : t(" — ухудшение")}</span>}
  </span>;
}

export function ScenarioComparison({ scenarioA, scenarioB }: { scenarioA: EvaluatedScenario; scenarioB: EvaluatedScenario }) {
  useLanguage();
  const [districtId, setDistrictId] = useState<DistrictId>('nura');
  const districtSelectId = useId();
  const a = scenarioA.simulation;
  const b = scenarioB.simulation;
  const metrics = [
    { name: 'Score', a: a.finalScore, b: b.finalScore },
    { name: t("Расход бюджета"), a: a.validation.totalCost, b: b.validation.totalCost, integer: true, neutral: true },
    { name: t("Критические показатели"), a: a.finalCritCount, b: b.finalCritCount, integer: true, lowerIsBetter: true },
    { name: t("Средний результат города"), a: a.finalCityAverage, b: b.finalCityAverage },
    { name: t("Оценка слабейшего района"), a: a.finalMinDistrictScore, b: b.finalMinDistrictScore },
  ];

  return (
    <div className="scenario-comparison">
      <div className="scenarios-pair-names"><p><strong>A</strong> {scenarioA.name}</p><p><strong>B</strong> {scenarioB.name}</p></div>
      <div className="scenarios-table-scroll" tabIndex={0} role="region" aria-label={t("Итоговые показатели сравнения")}>
        <table className="scenarios-table scenarios-comparison-table">
          <thead><tr><th scope="col">{t("Показатель")}</th><th scope="col">A</th><th scope="col">B</th><th scope="col">B − A</th></tr></thead>
          <tbody>{metrics.map((metric) => <tr key={metric.name}>
            <th scope="row">{metric.name}</th><td>{metric.integer ? metric.a : formatScenarioNumber(metric.a)}</td><td>{metric.integer ? metric.b : formatScenarioNumber(metric.b)}</td>
            <td><Difference value={metric.b - metric.a} integer={metric.integer} lowerIsBetter={metric.lowerIsBetter} neutral={metric.neutral} /></td>
          </tr>)}
            <tr><th scope="row">{t("Слабейший район")}</th><td>{t(DISTRICTS[a.weakestDistrictId].nameRu)}</td><td>{t(DISTRICTS[b.weakestDistrictId].nameRu)}</td><td>—</td></tr>
          </tbody>
        </table>
      </div>
      <h4>{t("Выбранные меры")}</h4>
      <div className="scenarios-decision-lists">{[scenarioA, scenarioB].map((scenario, index) => <div key={scenario.id}>
        <h5>{index === 0 ? 'A' : 'B'} · {scenario.name}</h5>
        <ol>{scenario.decisions.map((decision) => <li key={decision.measureId}>
          <span>{decision.measureId} · {t(MEASURES[decision.measureId].nameRu)}</span>
          <span className="scenarios-measure-district">{decision.districtId ? t(DISTRICTS[decision.districtId].nameRu) : t("Весь город")}</span>
        </li>)}</ol>
      </div>)}</div>
      <h4>{t("Оценки районов")}</h4>
      <div className="scenarios-table-scroll" tabIndex={0} role="region" aria-label={t("Сравнение оценок районов")}>
        <table className="scenarios-table scenarios-comparison-table"><thead><tr><th scope="col">{t("Район")}</th><th scope="col">A</th><th scope="col">B</th><th scope="col">B − A</th></tr></thead>
          <tbody>{DISTRICT_LIST.map((district) => <tr key={district.id}><th scope="row">{t(district.nameRu)}</th><td>{formatScenarioNumber(a.districts[district.id].finalDistrictScore)}</td><td>{formatScenarioNumber(b.districts[district.id].finalDistrictScore)}</td><td><Difference value={b.districts[district.id].finalDistrictScore - a.districts[district.id].finalDistrictScore} /></td></tr>)}</tbody>
        </table>
      </div>
      <div className="scenarios-indicator-heading"><h4>{t("Десять показателей района")}</h4><div className="scenarios-field"><label htmlFor={districtSelectId}>{t("Район для сравнения")}</label><select id={districtSelectId} value={districtId} onChange={(event) => setDistrictId(event.target.value as DistrictId)}>{DISTRICT_LIST.map((district) => <option value={district.id} key={district.id}>{t(district.nameRu)}</option>)}</select></div></div>
      <div className="scenarios-table-scroll" tabIndex={0} role="region" aria-label={t("Сравнение показателей района {0}", [DISTRICTS[districtId].nameRu])}>
        <table className="scenarios-table scenarios-comparison-table"><thead><tr><th scope="col">{t("Показатель")}</th><th scope="col">A</th><th scope="col">B</th><th scope="col">B − A</th></tr></thead>
          <tbody>{INDICATOR_LIST.map((indicator) => {
            const valueA = a.districts[districtId].finalIndicators[indicator.id];
            const valueB = b.districts[districtId].finalIndicators[indicator.id];
            return <tr key={indicator.id}><th scope="row">{indicator.id} · {t(indicator.nameRu)}</th><td>{formatScenarioNumber(valueA)}</td><td>{formatScenarioNumber(valueB)}</td><td><Difference value={valueB - valueA} /></td></tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  );
}
