import React, { useEffect, useState } from 'react';
import { DISTRICTS } from '../data/districts';
import { DistrictId, SelectedDecision } from '../engine/types';
import { MEASURES } from '../data/measures';
import { validateDecisions } from '../engine/validator';
import { applyMandate, DECISION_COST_SCALE } from './model';
import { Action, CONFIG, DIRECTIONS, LABELS, PROJECTS, Point, advanceSession, applyAction, initializeSession, population, quality } from './model';
import { useTwinStorage } from './storage';
import { WorkspaceTabs } from '../components/WorkspaceTabs';
import { getLanguage, t, useLanguage } from '../i18n';

type Layer = 'population' | 'transport' | 'ecology' | 'social' | 'safety' | 'services';
type TwinView = 'city' | 'budget' | 'scenarios';
type TrendMetric = 'quality' | 'budget' | 'population';
const TREND_TITLES: Record<TrendMetric, string> = {
  quality: 'Качество жизни, 0–100', budget: 'Резерв бюджета, у.е.', population: 'Население, чел.',
};
const LAYERS: Record<Layer, string> = { ...LABELS, population: 'Население', transport: 'Нагрузка транспорта' };
const fmt = (n: number, digits = 0) => n.toLocaleString(getLanguage(), { maximumFractionDigits: digits });
const delta = (n: number, digits = 1) => `${n > 0 ? '+' : ''}${fmt(n, digits)}`;
const shapes = [
  { id: 'saryarka', path: 'M65 55 L250 40 L280 150 L180 205 L45 160 Z', x: 160, y: 113 },
  { id: 'baikonur', path: 'M260 40 L425 65 L425 200 L290 155 Z', x: 343, y: 118 },
  { id: 'almaty', path: 'M437 70 L610 105 L585 260 L437 205 Z', x: 520, y: 167 },
  { id: 'nura', path: 'M47 177 L177 220 L255 290 L215 405 L65 345 Z', x: 147, y: 292 },
  { id: 'esil', path: 'M190 220 L289 172 L425 220 L407 380 L230 408 L272 285 Z', x: 330, y: 290 },
  { id: 'saraishyk', path: 'M439 224 L586 280 L560 400 L422 380 Z', x: 500, y: 320 },
] as const;
function Trend({ current, baseline, metric, title }: { current: Point[]; baseline: Point[]; metric: TrendMetric; title: string }) {
  const values = [...current, ...baseline].map(p => p[metric]);
  const observedMin = Math.min(...values), observedMax = Math.max(...values);
  const padding = Math.max(1, (observedMax - observedMin) * 0.1);
  const min = Math.max(0, observedMin - padding);
  const max = metric === 'quality' ? Math.min(100, observedMax + padding) : observedMax + padding;
  const span = Math.max(1, max - min);
  const line = (points: Point[]) => points.map(p => `${40 + p.month / 60 * 510},${115 - (p[metric] - min) / span * 85}`).join(' ');
  return <figure className="twin-trend"><figcaption>{title}</figcaption><svg viewBox="0 0 580 145" role="img" aria-label={t('{0}: ваш сценарий и базовый вариант, месяцы 0–60', [title])}>
    <path d="M40 20 V115 H550" fill="none" stroke="var(--chart-grid)" />
    <text x="2" y="26">{fmt(max, metric === 'quality' ? 1 : 0)}</text><text x="2" y="116">{fmt(min, metric === 'quality' ? 1 : 0)}</text>
    <polyline points={line(baseline)} fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeDasharray="5 4" />
    <polyline points={line(current)} fill="none" stroke="var(--color-cyan)" strokeWidth="3" />
    <circle cx={40 + current.at(-1)!.month / 60 * 510} cy={115 - (current.at(-1)![metric]-min)/span*85} r="4" fill="var(--color-cyan)" />
    <text x="40" y="138">0</text><text x="280" y="138">30</text><text x="525" y="138">{t('60 мес.')}</text>
  </svg></figure>;
}
export default function DigitalTwin({ active = true, decisions = [] }: { active?: boolean; decisions?: SelectedDecision[] }) {
  useLanguage();
  const { session, setSession, snapshots, save, remove, notice } = useTwinStorage();
  const { city, baseline } = session;
  const [selected, setSelected] = useState<DistrictId>('nura');
  const [layer, setLayer] = useState<Layer>('transport');
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1200);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [view, setView] = useState<TwinView>('city');
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('quality');
  const views = [
    { id: 'city' as const, label: t('Город и проекты'), description: t('Карта районов и инвестиции') },
    { id: 'budget' as const, label: t('Бюджет и динамика'), description: t('Финансирование и графики') },
    { id: 'scenarios' as const, label: t('Сценарии и события'), description: t('Сохранения, проекты и журнал') },
  ];
  const finished = city.month >= CONFIG.horizon;
  const validation = validateDecisions(decisions);
  const mandateCost = validation.totalCost * DECISION_COST_SCALE;
  useEffect(() => {
    if (!playing || finished || !active) return;
    const timer = window.setInterval(() => setSession(s => advanceSession(s)), speed);
    return () => window.clearInterval(timer);
  }, [playing, finished, speed, setSession, active]);
  useEffect(() => { if (!active) setPlaying(false); }, [active]);
  useEffect(() => { if (finished) setPlaying(false); }, [finished]);
  const act = (action: Action) => {
    try { const next = applyAction(city, action); setSession({ ...session, city: next }); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось применить действие.'); }
  };
  const d = city.districts[selected], base = baseline.districts[selected];
  const value = (district: typeof d) => layer === 'population' ? district.population : layer === 'transport' ? district.load : district.quality[layer];
  const unit = layer === 'population' ? t('чел.') : layer === 'transport' ? '%' : '/ 100';
  const metricColor = (v: number) => layer === 'population' ? `hsl(190 65% ${25 + Math.min(1, v / 350000) * 28}%)` : (layer === 'transport' ? v > 140 : v < 45) ? '#9f394b' : (layer === 'transport' ? v > 100 : v < 65) ? '#87692e' : '#187b71';
  return <main className="twin-shell">
    <header className="twin-heading"><div><p className="twin-eyebrow">{t('ГОРОДСКАЯ ЛАБОРАТОРИЯ / МОДЕЛЬ {0}.0', [CONFIG.version])}</p><h1>{t('Цифровой двойник')}</h1><p>{t('Астана · 6 районов · 5 взаимосвязанных систем')}</p></div><span className="twin-badge">{t(finished ? 'Расчёт завершён' : playing ? 'Симуляция идёт' : 'На паузе')}</span></header>
    <p className="twin-disclaimer">{t('Демонстрационная модель: синтетические данные, условные границы районов и денежные единицы. Результаты не являются прогнозом реальной Астаны.')}</p>
    {notice && <p role="status" className="twin-notice">{t(notice)}</p>}{error && <p role="alert" className="twin-notice">{t(error)}</p>}
    <section className="twin-kpis" aria-label={t('Показатели города')}>
      {[['Население', fmt(population(city)), t('{0} к базе', [delta(population(city)-population(baseline),0)])], ['Качество жизни', `${fmt(quality(city),1)} / 100`, t('{0} к базе', [delta(quality(city)-quality(baseline))])], ['Резерв бюджета', t('{0} у.е.', [fmt(city.budget)]), t('{0} к базе', [delta(city.budget-baseline.budget,0)])], ['Баланс месяца', t('{0} у.е.', [delta(city.finance.revenue-city.finance.spent)]), t('Доход {0} · расход {1}', [fmt(city.finance.revenue), fmt(city.finance.spent)])]].map(([label,v,note]) => <article className="twin-card" key={label}><span>{t(label)}</span><strong>{v}</strong><small>{note}</small></article>)}
    </section>
    {city.finance.ratio < 1 && <p role="status" className="twin-notice">{t('Дефицит бюджета. Фактически оплачено {0}% запрошенного финансирования каждого направления.', [fmt(city.finance.ratio*100,1)])}</p>}
    {finished && <section className="twin-card twin-finish"><h2>{t('Итоги пяти лет')}</h2><p>{t('Качество жизни: {0} пункта к базовому варианту. Завершено проектов: {1}. Незавершённых: {2}. Сохраните сценарий или начните новый.', [delta(quality(city)-quality(baseline)), city.projects.filter(p => p.completed !== null).length, city.projects.filter(p => p.completed === null).length])}</p></section>}
    <section className="twin-card twin-time" aria-label={t('Управление временем')}><div><strong data-testid="twin-month">{t('Месяц {0} / 60', [city.month])}</strong><p>{city.month === 0 ? t('Исходное состояние') : t('{0} · год {1}', [new Date(2026, (city.month-1)%12, 1).toLocaleDateString(getLanguage(), { month: 'long' }), Math.ceil(city.month/12)])}</p></div><button disabled={finished} onClick={() => setPlaying(v => !v)}>{t(playing ? 'Пауза' : 'Запустить время')}</button><button disabled={finished || playing} onClick={() => setSession(advanceSession)}>{t('Следующий месяц')}</button><label>{t('Скорость')} <select value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value="1200">1×</option><option value="300">4×</option></select></label><progress max="60" value={city.month} aria-label={t('Горизонт симуляции')} /></section>
    <WorkspaceTabs idPrefix="twin-workspace" label={t('Разделы цифрового двойника')} items={views} value={view} onChange={setView} />
    <div className="twin-view" role="tabpanel" id="twin-workspace-panel-city" aria-labelledby="twin-workspace-tab-city" hidden={view !== 'city'} tabIndex={0}>
    <div className="twin-workspace"><section className="twin-card twin-map-panel" aria-label={t('Карта цифрового двойника')}>
      <div className="twin-section-title"><h2>{t('Город в разрезе')}</h2><label>{t('Слой карты')} <select value={layer} onChange={e => setLayer(e.target.value as Layer)}>{Object.entries(LAYERS).map(([k,v]) => <option key={k} value={k}>{t(v)}</option>)}</select></label></div>
      <svg className="twin-map" viewBox="0 0 650 440" aria-label={t('Схематическая карта: {0}', [LAYERS[layer]])}>
        <defs><pattern id="twin-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#263850" strokeWidth="0.5" /></pattern></defs>
        <rect width="650" height="440" fill="url(#twin-grid)" rx="12" />
        <path d="M0 168 Q130 163 194 212 T370 201 T650 277" stroke="#38bdf8" strokeOpacity=".45" strokeWidth="9" fill="none" />
        {shapes.map(s => <g key={s.id} role="button" tabIndex={0} aria-label={t('Район {0}', [DISTRICTS[s.id].nameRu])} aria-pressed={selected === s.id} onClick={() => setSelected(s.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(s.id); } }}>
          <path d={s.path} fill={metricColor(value(city.districts[s.id]))} stroke={selected === s.id ? '#e2fbff' : '#537083'} strokeWidth={selected === s.id ? 3 : 1} />
          <text x={s.x} y={s.y} textAnchor="middle" className="twin-map-name">{t(DISTRICTS[s.id].nameRu)}</text>
          <text x={s.x} y={s.y+24} textAnchor="middle">{fmt(value(city.districts[s.id]), layer === 'population' ? 0 : 1)} {unit}</text>
          <text x={s.x} y={s.y+44} textAnchor="middle" className="twin-map-delta">{t('{0} к базе', [delta(value(city.districts[s.id])-value(baseline.districts[s.id]), layer === 'population' ? 0 : 1)])}</text>
        </g>)}
      </svg>
      <p className="twin-legend">{t(layer === 'population' ? 'Бирюзовый: от тёмного (0) к светлому (350 тыс. жителей и более).' : layer === 'transport' ? 'Зелёный ≤100% · жёлтый 100–140% · красный >{t("140%. Меньше — лучше.' : 'Красный ")}<45 · жёлтый 45–65 · зелёный ≥65. Больше — лучше.')}</p>
      <p className="twin-muted">{t('Изменения показаны относительно базового варианта на том же месяце.')}</p>
      <div className="twin-district-summary"><h3>{t(DISTRICTS[selected].nameRu)}</h3><p>{t('{0} жителей · нагрузка транспорта {1}%', [fmt(d.population), fmt(d.load,1)])}</p><div className="twin-indicators">{DIRECTIONS.map(k => <div key={k}><span>{t(LABELS[k])}</span><strong>{fmt(d.quality[k],1)} <small>({delta(d.quality[k]-base.quality[k])})</small></strong><progress max="100" value={d.quality[k]} aria-label={t(LABELS[k])} /></div>)}</div></div>
    </section>
    <aside className="twin-card twin-projects"><p className="twin-eyebrow">{t('РАЙОННЫЕ ИНВЕСТИЦИИ')}</p><h2>{t(DISTRICTS[selected].nameRu)}</h2><p className="twin-muted">{t('Строительство оплачивается сразу. Эффект — после ввода в эксплуатацию.')}</p>{DIRECTIONS.map(k => { const p = PROJECTS[k]; return <article key={k}><h3>{t(p.name)}</h3><p>{t('{0} у.е. · {1} мес. · содержание {2} у.е./мес.', [p.cost, p.months, p.upkeep])}</p><p>{t('Мощность +{0} жителей · состояние +{1} п.', [fmt(p.capacity), p.repair])}</p><button disabled={finished || city.budget < p.cost} onClick={() => act({ type: 'project', district: selected, direction: k })}>{t('Запустить: {0}', [p.name])}</button>{city.budget < p.cost && <small>{t('Недостаточно средств')}</small>}</article>; })}</aside></div>
    <section className="twin-card" aria-label={t('Решения акима в городе')}>
      <div className="twin-section-title"><h2>{t('Аким на 5 часов → последствия в городе')}</h2><a href="#">{t('К выбору решений')}</a></div>
      <p className="twin-muted">{t('Пять решений применяются к текущему месяцу один раз за сценарий. 1 единица бюджета решений = {0} у.е. города. Задержка меры переводится из кварталов в месяцы; после ввода средний эффект двух показателей изменяет состояние соответствующей системы. Оценки двух режимов используют разные формулы.', [DECISION_COST_SCALE])}</p>
      <ul className="twin-mandate">{(city.mandate?.decisions ?? decisions).map(decision => {
        const measure = MEASURES[decision.measureId];
        const due = (city.mandate?.started ?? city.month) + measure.lag * 3;
        return <li key={decision.measureId}><strong>{t(measure.nameRu)}</strong><span>{t(decision.districtId ? DISTRICTS[decision.districtId].nameRu : 'Все районы')} · {t('{0} у.е.', [measure.cost * DECISION_COST_SCALE])} · {city.mandate && city.month >= due ? t('Эффект действует') : t('Эффект: месяц {0}{1}', [due, due > CONFIG.horizon ? t(' (за горизонтом)') : ''])}</span></li>;
      })}</ul>
      {city.mandate ? <p role="status">{t('Решения приняты в месяце {0}. Изменения черновика их не отменяют. Другой набор можно испытать в новом сценарии; текущий можно сохранить в разделе «Сценарии и события».', [city.mandate.started])}</p> : <>
        <p>{validation.isValid ? t('Расход при принятии: {0} у.е. Доступно: {1} у.е.', [mandateCost, fmt(city.budget)]) : t('Сначала выберите пять допустимых решений в режиме «Аким на 5 часов».')}</p>
        {validation.isValid && city.budget < mandateCost && <p>{t('Недостаточно средств для принятия решений.')}</p>}
        <button disabled={!validation.isValid || finished || city.budget < mandateCost} onClick={() => {
          try { setSession({ ...session, city: applyMandate(city, decisions) }); setPlaying(false); setError(''); }
          catch (e) { setError(e instanceof Error ? e.message : 'Не удалось принять решения.'); }
        }}>{t('Принять пять решений в городе')}</button>
      </>}
    </section>
    </div>
    <div className="twin-view" role="tabpanel" id="twin-workspace-panel-budget" aria-labelledby="twin-workspace-tab-budget" hidden={view !== 'budget'} tabIndex={0}>
    <section className="twin-card"><h2>{t('Финансирование городских систем')}</h2><p className="twin-muted">{t('Действует со следующего месяца. 100% — базовое финансирование с постепенным износом. Повышенное финансирование замедляет износ или восстанавливает инфраструктуру.')}</p><div className="twin-funding">{DIRECTIONS.map(k => <label key={k}>{t(LABELS[k])}<strong>{Math.round(city.pendingFunding[k]*100)}%</strong><input type="range" min="0" max="150" step="10" value={Math.round(city.pendingFunding[k]*100)} disabled={finished} onChange={e => act({ type: 'funding', direction: k, value: Number(e.target.value)/100 })} /><small>{t('Текущее: {0}%', [Math.round(city.funding[k]*100)])}</small></label>)}</div></section>
    <section className="twin-card"><h2>{t('Траектория города')}</h2><p className="twin-muted">{t('Бирюзовая линия — ваш сценарий · пунктир — без новых проектов, финансирование 100%.')}</p><label className="twin-trend-selector">{t('Показатель графика')}<select value={trendMetric} onChange={event => setTrendMetric(event.target.value as TrendMetric)}>{Object.entries(TREND_TITLES).map(([key, title]) => <option key={key} value={key}>{t(title)}</option>)}</select></label><div className="twin-charts"><Trend current={city.history} baseline={baseline.history} metric={trendMetric} title={t(TREND_TITLES[trendMetric])} /></div><details><summary>{t('Точные значения по месяцам')}</summary><div className="twin-table-wrap"><table><thead><tr><th>{t('Месяц')}</th><th>{t('Качество / база')}</th><th>{t('Бюджет / база')}</th><th>{t('Население / база')}</th></tr></thead><tbody>{city.history.map((p,i) => <tr key={p.month}><td>{p.month}</td><td>{fmt(p.quality,1)} / {fmt(baseline.history[i].quality,1)}</td><td>{fmt(p.budget)} / {fmt(baseline.history[i].budget)}</td><td>{fmt(p.population)} / {fmt(baseline.history[i].population)}</td></tr>)}</tbody></table></div></details></section>
    </div>
    <div className="twin-view" role="tabpanel" id="twin-workspace-panel-scenarios" aria-labelledby="twin-workspace-tab-scenarios" hidden={view !== 'scenarios'} tabIndex={0}>
    <section className="twin-card"><div className="twin-section-title"><h2>{t('Мои сценарии')}</h2><button onClick={() => { setPlaying(false); setSession(initializeSession()); setError(''); }}>{t('Новый сценарий')}</button></div><p className="twin-muted">{t('Черновик сохраняется автоматически в этом браузере. Новый сценарий заменяет черновик; сохранённые снимки остаются в библиотеке.')}</p><form className="twin-save" onSubmit={e => { e.preventDefault(); save(name); setName(''); }}><label>{t('Название сценария')}<input value={name} maxLength={100} onChange={e => setName(e.target.value)} placeholder={t('Например, приоритет транспорта')} /></label><button disabled={!name.trim()}>{t('Сохранить снимок')}</button></form>{snapshots.map(s => <article className="twin-snapshot" key={s.id}><div><strong>{s.name}</strong><p>{t('Месяц {0} · качество {1} · {2}', [s.session.city.month, fmt(quality(s.session.city),1), new Date(s.savedAt).toLocaleString(getLanguage())])}</p></div><button onClick={() => { setPlaying(false); setSession(structuredClone(s.session)); setError(''); }}>{t('Загрузить {0}', [s.name])}</button><button onClick={() => remove(s.id)}>{t('Удалить {0}', [s.name])}</button></article>)}</section>
    <div className="twin-bottom"><section className="twin-card"><h2>{t('Проекты')} <span className="twin-muted">/ {city.projects.length}</span></h2>{!city.projects.length && <p className="twin-muted">{t('Выберите район на карте и запустите первый проект.')}</p>}<div className="twin-scroll">{city.projects.map(p => <article className="twin-queue" key={p.id}><strong>{t(PROJECTS[p.direction].name)}</strong><p>{t(DISTRICTS[p.district].nameRu)} · {p.completed !== null ? t('Введён: месяц {0}', [p.completed]) : t('Строится · ввод в месяце {0}{1}', [p.started + PROJECTS[p.direction].months, p.started + PROJECTS[p.direction].months > 60 ? t(' (за горизонтом)') : ''])}</p><progress aria-label={t('Готовность проекта {0}', [p.id])} max={PROJECTS[p.direction].months} value={Math.min(PROJECTS[p.direction].months, city.month-p.started)} /></article>)}</div></section>
    <section className="twin-card"><h2>{t('Почему город меняется')}</h2><div className="twin-scroll">{!city.journal.length && <p className="twin-muted">{t('Здесь появятся решения, ввод проектов и причины ежемесячных изменений.')}</p>}{[...city.journal].reverse().map((e,i) => <p className="twin-log" key={i}><span>{t('М{0}', [e.month])}</span> {e.text}</p>)}</div></section></div>
    <details className="twin-card"><summary>{t('Как устроена модель')}</summary><p>{t('Начальное население — 1 млн условных жителей, распределённых по весам районов. Доход — 0,00042 у.е. на жителя в месяц; базовое содержание каждого направления — 0,000075 у.е. на жителя. Индекс качества — среднее пяти систем, взвешенное по населению.')}</p><p>{t('Ежемесячный рост населения: 0,18% плюс 0,002 процентного пункта за каждый пункт качества выше 60. Износ — 0,22 пункта в месяц; дополнительное содержание меняет состояние на 0,65 × (фактическое финансирование − 1). Зимой спрос на транспорт и ЖКХ выше. Перегрузка транспорта снижает экологический показатель.')}</p><p>{t('Мощности измеряются числом обслуживаемых жителей. Качество системы определяется покрытием спроса и состоянием инфраструктуры. Базовый вариант использует те же начальные условия и календарь. Строительство проектов не отменяется; несколько проектов одного типа допустимы. Реальные источники данных не подключены.')}</p></details>
    </div>
  </main>;
}
