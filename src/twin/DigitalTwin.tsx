import React, { useEffect, useState } from 'react';
import { DISTRICT_LIST, DISTRICTS } from '../data/districts';
import { DirectionId, DistrictId, SelectedDecision } from '../engine/types';
import { MEASURES } from '../data/measures';
import { validateDecisions } from '../engine/validator';
import { applyMandate, DECISION_COST_SCALE } from './model';
import { Action, CONFIG, DIRECTIONS, LABELS, PROJECTS, Point, advanceSession, applyAction, initializeSession, population, quality } from './model';
import { useTwinStorage } from './storage';

type Layer = 'population' | 'transport' | 'ecology' | 'social' | 'safety' | 'services';
const LAYERS: Record<Layer, string> = { ...LABELS, population: 'Население', transport: 'Нагрузка транспорта' };
const fmt = (n: number, digits = 0) => n.toLocaleString('ru-RU', { maximumFractionDigits: digits });
const delta = (n: number, digits = 1) => `${n > 0 ? '+' : ''}${fmt(n, digits)}`;
const shapes = [
  { id: 'saryarka', path: 'M65 55 L250 40 L280 150 L180 205 L45 160 Z', x: 160, y: 113 },
  { id: 'baikonur', path: 'M260 40 L425 65 L425 200 L290 155 Z', x: 343, y: 118 },
  { id: 'almaty', path: 'M437 70 L610 105 L585 260 L437 205 Z', x: 520, y: 167 },
  { id: 'nura', path: 'M47 177 L177 220 L255 290 L215 405 L65 345 Z', x: 147, y: 292 },
  { id: 'esil', path: 'M190 220 L289 172 L425 220 L407 380 L230 408 L272 285 Z', x: 330, y: 290 },
  { id: 'saraishyk', path: 'M439 224 L586 280 L560 400 L422 380 Z', x: 500, y: 320 },
] as const;
function Trend({ current, baseline, metric, title }: { current: Point[]; baseline: Point[]; metric: 'quality' | 'budget' | 'population'; title: string }) {
  const values = [...current, ...baseline].map(p => p[metric]);
  const min = Math.min(...values), max = Math.max(...values), span = Math.max(1, max-min);
  const line = (points: Point[]) => points.map(p => `${40 + p.month / 60 * 510},${115 - (p[metric] - min) / span * 85}`).join(' ');
  return <figure className="twin-trend"><figcaption>{title}</figcaption><svg viewBox="0 0 580 145" role="img" aria-label={`${title}: ваш сценарий и базовый вариант, месяцы 0–60`}>
    <path d="M40 20 V115 H550" fill="none" stroke="#334155" />
    <text x="2" y="26">{fmt(max)}</text><text x="2" y="116">{fmt(min)}</text>
    <polyline points={line(baseline)} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 4" />
    <polyline points={line(current)} fill="none" stroke="#2dd4bf" strokeWidth="3" />
    <circle cx={40 + current.at(-1)!.month / 60 * 510} cy={115 - (current.at(-1)![metric]-min)/span*85} r="4" fill="#2dd4bf" />
    <text x="40" y="138">0</text><text x="280" y="138">30</text><text x="525" y="138">60 мес.</text>
  </svg></figure>;
}
export default function DigitalTwin({ active = true, decisions = [] }: { active?: boolean; decisions?: SelectedDecision[] }) {
  const { session, setSession, snapshots, save, remove, notice } = useTwinStorage();
  const { city, baseline } = session;
  const [selected, setSelected] = useState<DistrictId>('nura');
  const [layer, setLayer] = useState<Layer>('transport');
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1200);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
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
  const unit = layer === 'population' ? 'чел.' : layer === 'transport' ? '%' : '/ 100';
  const metricColor = (v: number) => layer === 'population' ? `hsl(190 65% ${25 + Math.min(1, v / 350000) * 28}%)` : (layer === 'transport' ? v > 140 : v < 45) ? '#9f394b' : (layer === 'transport' ? v > 100 : v < 65) ? '#87692e' : '#187b71';
  return <main className="twin-shell">
    <header className="twin-heading"><div><p className="twin-eyebrow">ГОРОДСКАЯ ЛАБОРАТОРИЯ / МОДЕЛЬ {CONFIG.version}.0</p><h1>Цифровой двойник</h1><p>Астана · 6 районов · 5 взаимосвязанных систем</p></div><span className="twin-badge">{finished ? 'Расчёт завершён' : playing ? 'Симуляция идёт' : 'На паузе'}</span></header>
    <p className="twin-disclaimer">Демонстрационная модель: синтетические данные, условные границы районов и денежные единицы. Результаты не являются прогнозом реальной Астаны.</p>
    {notice && <p role="status" className="twin-notice">{notice}</p>}{error && <p role="alert" className="twin-notice">{error}</p>}
    <section className="twin-card" aria-label="Решения акима в городе">
      <div className="twin-section-title"><h2>Аким на 5 часов → последствия в городе</h2><a href="#">К выбору решений</a></div>
      <p className="twin-muted">Пять решений применяются к текущему месяцу один раз за сценарий. 1 единица бюджета решений = {DECISION_COST_SCALE} у.е. города. Задержка меры переводится из кварталов в месяцы; после ввода средний эффект двух показателей изменяет состояние соответствующей системы. Оценки двух режимов используют разные формулы.</p>
      <ul className="twin-mandate">{(city.mandate?.decisions ?? decisions).map(decision => {
        const measure = MEASURES[decision.measureId];
        const due = (city.mandate?.started ?? city.month) + measure.lag * 3;
        return <li key={decision.measureId}><strong>{measure.nameRu}</strong><span>{decision.districtId ? DISTRICTS[decision.districtId].nameRu : 'Все районы'} · {measure.cost * DECISION_COST_SCALE} у.е. · {city.mandate && city.month >= due ? 'Эффект действует' : `Эффект: месяц ${due}${due > CONFIG.horizon ? ' (за горизонтом)' : ''}`}</span></li>;
      })}</ul>
      {city.mandate ? <p role="status">Решения приняты в месяце {city.mandate.started}. Изменения черновика их не отменяют. Другой набор можно испытать в новом сценарии; текущий можно сохранить ниже.</p> : <>
        <p>{validation.isValid ? `Расход при принятии: ${mandateCost} у.е. Доступно: ${fmt(city.budget)} у.е.` : 'Сначала выберите пять допустимых решений в режиме «Аким на 5 часов».'}</p>
        {validation.isValid && city.budget < mandateCost && <p>Недостаточно средств для принятия решений.</p>}
        <button disabled={!validation.isValid || finished || city.budget < mandateCost} onClick={() => {
          try { setSession({ ...session, city: applyMandate(city, decisions) }); setPlaying(false); setError(''); }
          catch (e) { setError(e instanceof Error ? e.message : 'Не удалось принять решения.'); }
        }}>Принять пять решений в городе</button>
      </>}
    </section>
    <section className="twin-kpis" aria-label="Показатели города">
      {[['Население', fmt(population(city)), `${delta(population(city)-population(baseline),0)} к базе`], ['Качество жизни', `${fmt(quality(city),1)} / 100`, `${delta(quality(city)-quality(baseline))} к базе`], ['Резерв бюджета', `${fmt(city.budget)} у.е.`, `${delta(city.budget-baseline.budget,0)} к базе`], ['Баланс месяца', `${delta(city.finance.revenue-city.finance.spent)} у.е.`, `Доход ${fmt(city.finance.revenue)} · расход ${fmt(city.finance.spent)}`]].map(([label,v,note]) => <article className="twin-card" key={label}><span>{label}</span><strong>{v}</strong><small>{note}</small></article>)}
    </section>
    {city.finance.ratio < 1 && <p role="status" className="twin-notice">Дефицит бюджета. Фактически оплачено {fmt(city.finance.ratio*100,1)}% запрошенного финансирования каждого направления.</p>}
    {finished && <section className="twin-card twin-finish"><h2>Итоги пяти лет</h2><p>Качество жизни: {delta(quality(city)-quality(baseline))} пункта к базовому варианту. Завершено проектов: {city.projects.filter(p => p.completed !== null).length}. Незавершённых: {city.projects.filter(p => p.completed === null).length}. Сохраните сценарий или начните новый.</p></section>}
    <div className="twin-workspace"><section className="twin-card twin-map-panel" aria-label="Карта цифрового двойника">
      <div className="twin-section-title"><h2>Город в разрезе</h2><label>Слой карты <select value={layer} onChange={e => setLayer(e.target.value as Layer)}>{Object.entries(LAYERS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label></div>
      <svg className="twin-map" viewBox="0 0 650 440" aria-label={`Схематическая карта: ${LAYERS[layer]}`}>
        <defs><pattern id="twin-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#263850" strokeWidth="0.5" /></pattern></defs>
        <rect width="650" height="440" fill="url(#twin-grid)" rx="12" />
        <path d="M0 168 Q130 163 194 212 T370 201 T650 277" stroke="#38bdf8" strokeOpacity=".45" strokeWidth="9" fill="none" />
        {shapes.map(s => <g key={s.id} role="button" tabIndex={0} aria-label={`Район ${DISTRICTS[s.id].nameRu}`} aria-pressed={selected === s.id} onClick={() => setSelected(s.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(s.id); } }}>
          <path d={s.path} fill={metricColor(value(city.districts[s.id]))} stroke={selected === s.id ? '#e2fbff' : '#537083'} strokeWidth={selected === s.id ? 3 : 1} />
          <text x={s.x} y={s.y} textAnchor="middle" className="twin-map-name">{DISTRICTS[s.id].nameRu}</text>
          <text x={s.x} y={s.y+24} textAnchor="middle">{fmt(value(city.districts[s.id]), layer === 'population' ? 0 : 1)} {unit}</text>
          <text x={s.x} y={s.y+44} textAnchor="middle" className="twin-map-delta">{delta(value(city.districts[s.id])-value(baseline.districts[s.id]), layer === 'population' ? 0 : 1)} к базе</text>
        </g>)}
      </svg>
      <p className="twin-legend">{layer === 'population' ? 'Бирюзовый: от тёмного (0) к светлому (350 тыс. жителей и более).' : layer === 'transport' ? 'Зелёный ≤100% · жёлтый 100–140% · красный >140%. Меньше — лучше.' : 'Красный <45 · жёлтый 45–65 · зелёный ≥65. Больше — лучше.'}</p>
      <p className="twin-muted">Изменения показаны относительно базового варианта на том же месяце.</p>
      <div className="twin-district-summary"><h3>{DISTRICTS[selected].nameRu}</h3><p>{fmt(d.population)} жителей · нагрузка транспорта {fmt(d.load,1)}%</p><div className="twin-indicators">{DIRECTIONS.map(k => <div key={k}><span>{LABELS[k]}</span><strong>{fmt(d.quality[k],1)} <small>({delta(d.quality[k]-base.quality[k])})</small></strong><progress max="100" value={d.quality[k]} aria-label={LABELS[k]} /></div>)}</div></div>
    </section>
    <aside className="twin-card twin-projects"><p className="twin-eyebrow">РАЙОННЫЕ ИНВЕСТИЦИИ</p><h2>{DISTRICTS[selected].nameRu}</h2><p className="twin-muted">Строительство оплачивается сразу. Эффект — после ввода в эксплуатацию.</p>{DIRECTIONS.map(k => { const p = PROJECTS[k]; return <article key={k}><h3>{p.name}</h3><p>{p.cost} у.е. · {p.months} мес. · содержание {p.upkeep} у.е./мес.</p><p>Мощность +{fmt(p.capacity)} жителей · состояние +{p.repair} п.</p><button disabled={finished || city.budget < p.cost} onClick={() => act({ type: 'project', district: selected, direction: k })}>Запустить: {p.name}</button>{city.budget < p.cost && <small>Недостаточно средств</small>}</article>; })}</aside></div>
    <section className="twin-card twin-time" aria-label="Управление временем"><div><strong data-testid="twin-month">Месяц {city.month} / 60</strong><p>{city.month === 0 ? 'Исходное состояние' : `${['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][(city.month-1)%12]} · год ${Math.ceil(city.month/12)}`}</p></div><button disabled={finished} onClick={() => setPlaying(v => !v)}>{playing ? 'Пауза' : 'Запустить время'}</button><button disabled={finished || playing} onClick={() => setSession(advanceSession)}>Следующий месяц</button><label>Скорость <select value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value="1200">1×</option><option value="300">4×</option></select></label><progress max="60" value={city.month} aria-label="Горизонт симуляции" /></section>
    <section className="twin-card"><h2>Финансирование городских систем</h2><p className="twin-muted">Действует со следующего месяца. 100% — базовое финансирование с постепенным износом. Повышенное финансирование замедляет износ или восстанавливает инфраструктуру.</p><div className="twin-funding">{DIRECTIONS.map(k => <label key={k}>{LABELS[k]}<strong>{Math.round(city.pendingFunding[k]*100)}%</strong><input type="range" min="0" max="150" step="10" value={Math.round(city.pendingFunding[k]*100)} disabled={finished} onChange={e => act({ type: 'funding', direction: k, value: Number(e.target.value)/100 })} /><small>Текущее: {Math.round(city.funding[k]*100)}%</small></label>)}</div></section>
    <section className="twin-card"><h2>Траектория города</h2><p className="twin-muted">Бирюзовая линия — ваш сценарий · пунктир — без новых проектов, финансирование 100%.</p><div className="twin-charts"><Trend current={city.history} baseline={baseline.history} metric="quality" title="Качество жизни, 0–100" /><Trend current={city.history} baseline={baseline.history} metric="budget" title="Резерв бюджета, у.е." /><Trend current={city.history} baseline={baseline.history} metric="population" title="Население, чел." /></div><details><summary>Точные значения по месяцам</summary><div className="twin-table-wrap"><table><thead><tr><th>Месяц</th><th>Качество / база</th><th>Бюджет / база</th><th>Население / база</th></tr></thead><tbody>{city.history.map((p,i) => <tr key={p.month}><td>{p.month}</td><td>{fmt(p.quality,1)} / {fmt(baseline.history[i].quality,1)}</td><td>{fmt(p.budget)} / {fmt(baseline.history[i].budget)}</td><td>{fmt(p.population)} / {fmt(baseline.history[i].population)}</td></tr>)}</tbody></table></div></details></section>
    <div className="twin-bottom"><section className="twin-card"><h2>Проекты <span className="twin-muted">/ {city.projects.length}</span></h2>{!city.projects.length && <p className="twin-muted">Выберите район на карте и запустите первый проект.</p>}<div className="twin-scroll">{city.projects.map(p => <article className="twin-queue" key={p.id}><strong>{PROJECTS[p.direction].name}</strong><p>{DISTRICTS[p.district].nameRu} · {p.completed !== null ? `Введён: месяц ${p.completed}` : `Строится · ввод в месяце ${p.started + PROJECTS[p.direction].months}${p.started + PROJECTS[p.direction].months > 60 ? ' (за горизонтом)' : ''}`}</p><progress aria-label={`Готовность проекта ${p.id}`} max={PROJECTS[p.direction].months} value={Math.min(PROJECTS[p.direction].months, city.month-p.started)} /></article>)}</div></section>
    <section className="twin-card"><h2>Почему город меняется</h2><div className="twin-scroll">{!city.journal.length && <p className="twin-muted">Здесь появятся решения, ввод проектов и причины ежемесячных изменений.</p>}{[...city.journal].reverse().map((e,i) => <p className="twin-log" key={i}><span>М{e.month}</span> {e.text}</p>)}</div></section></div>
    <section className="twin-card"><div className="twin-section-title"><h2>Мои сценарии</h2><button onClick={() => { setPlaying(false); setSession(initializeSession()); setError(''); }}>Новый сценарий</button></div><p className="twin-muted">Черновик сохраняется автоматически в этом браузере. Новый сценарий заменяет черновик; сохранённые снимки остаются в библиотеке.</p><form className="twin-save" onSubmit={e => { e.preventDefault(); save(name); setName(''); }}><label>Название сценария<input value={name} maxLength={100} onChange={e => setName(e.target.value)} placeholder="Например, приоритет транспорта" /></label><button disabled={!name.trim()}>Сохранить снимок</button></form>{snapshots.map(s => <article className="twin-snapshot" key={s.id}><div><strong>{s.name}</strong><p>Месяц {s.session.city.month} · качество {fmt(quality(s.session.city),1)} · {new Date(s.savedAt).toLocaleString('ru-RU')}</p></div><button onClick={() => { setPlaying(false); setSession(structuredClone(s.session)); setError(''); }}>Загрузить {s.name}</button><button onClick={() => remove(s.id)}>Удалить {s.name}</button></article>)}</section>
    <details className="twin-card"><summary>Как устроена модель</summary><p>Начальное население — 1 млн условных жителей, распределённых по весам районов. Доход — 0,00042 у.е. на жителя в месяц; базовое содержание каждого направления — 0,000075 у.е. на жителя. Индекс качества — среднее пяти систем, взвешенное по населению.</p><p>Ежемесячный рост населения: 0,18% плюс 0,002 процентного пункта за каждый пункт качества выше 60. Износ — 0,22 пункта в месяц; дополнительное содержание меняет состояние на 0,65 × (фактическое финансирование − 1). Зимой спрос на транспорт и ЖКХ выше. Перегрузка транспорта снижает экологический показатель.</p><p>Мощности измеряются числом обслуживаемых жителей. Качество системы определяется покрытием спроса и состоянием инфраструктуры. Базовый вариант использует те же начальные условия и календарь. Строительство проектов не отменяется; несколько проектов одного типа допустимы. Реальные источники данных не подключены.</p></details>
  </main>;
}
