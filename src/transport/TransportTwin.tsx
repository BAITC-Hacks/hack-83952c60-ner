import React, { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Box, Check, ChevronRight, CircleHelp, Crosshair, Expand, Gauge, GitBranch, Layers3, MapPin, Maximize2, MoveUpRight, Navigation, Orbit, Pause, Play, RotateCcw, Route, ScanLine, Settings2, Sparkles, X } from 'lucide-react';
import type { SceneController, SceneOptions, Telemetry } from './scene';
import { AGENT_COUNT, CameraView, ScenarioId, SCENARIO_METRICS } from './simulation';
import './transport.css';
import { getLanguage, t, useLanguage } from '../i18n';

const initialTelemetry: Telemetry = { blend: 0, occupancy: [0, 0, 0], congestion: [0, 1, 0], fps: 0, elapsed: 0, completed: 0, metrics: SCENARIO_METRICS.baseline, transitioning: false };
const number = (n: number) => Math.round(n).toLocaleString(getLanguage());
const scenarios: { id: ScenarioId; title: string; subtitle: string; caption: string; mapTitle: string; nodeTitle: string; nodeDetail: string; insight: string }[] = [
  { id: 'baseline', title: 'Текущая ситуация', subtitle: 'Час пик · Базовый сценарий', caption: '3 моста. Привычные маршруты. Город на пределе пропускной способности.', mapTitle: 'Вечерний час пик', nodeTitle: 'Критическая нагрузка', nodeDetail: 'Центральный мост · узкое горлышко', insight: 'Выберите сценарий и сравните, как инфраструктура и управление движением влияют на город.' },
  { id: 'interchange', title: 'Новая развязка', subtitle: '+ выделенный Bus Lane', caption: 'Новый маршрут через реку. 40% потока переходит на эстакаду.', mapTitle: 'Новая связь берегов', nodeTitle: 'Новая связь берегов', nodeDetail: 'Эстакада + выделенная полоса', insight: 'Новая развязка принимает 40% потока, а доля общественного транспорта достигает 40%.' },
  { id: 'transit', title: 'Приоритет общественного транспорта', subtitle: 'Выделенные полосы · Экспресс', caption: 'Автобусные полосы на существующих мостах. 60% агентов выбирают общественный транспорт.', mapTitle: 'Город выбирает общественный транспорт', nodeTitle: 'Приоритет автобусов', nodeDetail: 'Выделенные полосы на трёх мостах', insight: 'Выделенные полосы ускоряют автобусы. Доля общественного транспорта растёт до 60% без новой развязки.' },
  { id: 'signals', title: 'Умные светофоры', subtitle: 'Зелёная волна · Три моста', caption: 'Согласованные светофоры сокращают остановки на подходах к мостам.', mapTitle: 'Движение в ритме зелёной волны', nodeTitle: 'Зелёная волна', nodeDetail: 'Согласованные сигналы на подходах', insight: 'Зелёная волна сокращает остановки на существующих маршрутах. Доля общественного транспорта остаётся 20%.' },
];

function Sparkline({ project, type }: { project: number; type: 'speed' | 'delay' | 'impact' }) {
  const base = [22, 27, 20, 29, 25, 34, 29, 32, 26, 35, 30, 34, 29, 33, 31, 35, 32, 36];
  const points = base.map((v, i) => `${i * 7},${type === 'delay' ? 50 - v + project * i * 1.15 : v - project * i * 1.3}`).join(' ');
  return <svg className={`tr-spark tr-spark-${type}`} viewBox="0 0 120 52" aria-hidden="true"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.8" /><polyline points={`0,52 ${points} 119,52`} fill="currentColor" opacity=".06" /></svg>;
}

/** Drop-in React component. WebGL is dynamically imported and disposed on unmount. */
export default function TransportTwin() {
  const language = useLanguage();
  const host = useRef<HTMLDivElement>(null), shell = useRef<HTMLElement>(null);
  const controller = useRef<SceneController | null>(null);
  const [scenario, setScenario] = useState<ScenarioId>('baseline'), [paused, setPaused] = useState(false);
  const [view, setView] = useState<CameraView>('orbit');
  const [agentsVisible, setAgentsVisible] = useState(true), [buildingsVisible, setBuildingsVisible] = useState(true);
  const [telemetry, setTelemetry] = useState(initialTelemetry);
  const [error, setError] = useState(''), [ready, setReady] = useState(false), [retry, setRetry] = useState(0);
  const [help, setHelp] = useState(false), [layersOpen, setLayersOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const options: SceneOptions = { scenario, paused, view, agentsVisible, buildingsVisible };
  const latestOptions = useRef(options); latestOptions.current = options;
  useEffect(() => {
    document.title = t('ASTANA · Транспортный цифровой двойник');
    return () => { document.title = t('«Аким на 5 часов»'); };
  }, [language]);
  useEffect(() => { controller.current?.updateLanguage(); }, [language]);
  useEffect(() => {
    let cancelled = false;
    setReady(false); setError('');
    import('./scene').then(({ createTransportScene }) => {
      if (cancelled || !host.current) return;
      try { controller.current = createTransportScene(host.current, latestOptions.current, setTelemetry, setError); setReady(true); }
      catch (e) { setError('Не удалось запустить WebGL. Проверьте аппаратное ускорение браузера.'); console.error(e); }
    }).catch(() => { if (!cancelled) setError('Не удалось загрузить 3D-модуль. Проверьте соединение и повторите.'); });
    return () => { cancelled = true; controller.current?.dispose(); controller.current = null; };
  }, [retry]);
  useEffect(() => { controller.current?.setOptions({ scenario, paused, view, agentsVisible, buildingsVisible }); }, [scenario, paused, view, agentsVisible, buildingsVisible]);
  useEffect(() => {
    if (!help) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHelp(false);
      if (e.key === 'Tab') {
        const buttons = shell.current?.querySelectorAll<HTMLButtonElement>('.tr-modal button');
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [help]);
  const activeScenario = scenarios.find(item => item.id === scenario)!;
  const { speed, delay, throughput, impact, transitShare, reroutedShare, peakDelayReduction } = telemetry.metrics;
  const p = (speed - SCENARIO_METRICS.baseline.speed) / 32;
  const transitioning = ready && !error && (telemetry.transitioning || Math.abs(speed - SCENARIO_METRICS[scenario].speed) > .01);
  const improved = p > .01;
  const reset = () => { setScenario('baseline'); setPaused(false); setView('orbit'); controller.current?.reset(); setTelemetry(initialTelemetry); };
  const choose = (next: ScenarioId) => { setScenario(next); setPaused(false); };
  const toggleFullscreen = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await shell.current?.requestFullscreen(); }
    catch { setNotice('Полноэкранный режим недоступен в этом браузере.'); }
  };

  return <main className="tr-app" lang={language} ref={shell}>
    <header className="tr-topbar">
      <a className="tr-brand" href="#/transport" aria-label="Astana Urban Intelligence"><span className="tr-brand-symbol"><Box size={23} strokeWidth={1.4} /></span><span>ASTANA<span className="tr-brand-sub">URBAN INTELLIGENCE</span></span><span className="tr-version">LAB / 01</span></a>
      <nav className="tr-nav" aria-label={t("Разделы приложения")}><a href="#">{t("Обзор города")}</a><a href="#/digital-twin">{t("Симулятор")}</a><a href="#/transport" aria-current="page">{t("Транспорт · 3D")}</a></nav>
      <div className="tr-system"><span className="tr-status-dot" />{t("Система активна")}<span className="tr-avatar">AK</span></div>
    </header>
    <div className="tr-content">
      {notice && <p className="tr-notice" role="status">{t(notice)}<button aria-label={t("Скрыть уведомление")} onClick={() => setNotice('')}><X size={14} /></button></p>}
      <div className="tr-breadcrumb"><span>{t("Ситуационный центр")}</span><ChevronRight size={12} /><span>{t("Цифровой двойник")}</span><ChevronRight size={12} /><strong>{t("Транспорт")}</strong></div>
      <section className="tr-heading">
        <div><div className="tr-eyebrow"><span /> {t("ГОРОД КАК ЖИВАЯ СИСТЕМА")}</div><h1>{t("Цифровой двойник")}<span className="tr-heading-dot">.</span></h1><p>{t("Агентное транспортное моделирование")} <span>/</span> {t("Астана, Казахстан")}</p></div>
        <div className="tr-heading-actions"><div className="tr-location"><MapPin size={14} /><span>51.1694° N · 71.4491° E</span></div><button className="tr-help-button" onClick={() => setHelp(true)}><CircleHelp size={15} />{t("О модели")}</button></div>
      </section>
      <div className="tr-workspace">
        <section className="tr-map" aria-label={t("Транспортная 3D-симуляция")}>
          <div className="tr-canvas" ref={host} />
          {(!ready || error) && <div className="tr-canvas-message" role={error ? 'alert' : 'status'}><ScanLine size={30} /><strong>{t(error || 'Собираем цифровой город…')}</strong>{error && <button onClick={() => { reset(); setRetry(n => n + 1); }}>{t("Перезапустить сцену")}</button>}</div>}
          <div className="tr-map-top"><div className="tr-live-badge"><span className={paused ? 'tr-dot-paused' : 'tr-status-dot'} />{t(paused ? 'ПАУЗА' : 'СИМУЛЯЦИЯ В РЕАЛЬНОМ ВРЕМЕНИ')}<span className="tr-live-divider" />{AGENT_COUNT} {t("АГЕНТОВ")}</div><button className="tr-icon-button" aria-label={t("Полноэкранный режим")} title={t("Полноэкранный режим")} onClick={toggleFullscreen}><Expand size={17} /></button></div>
          <div className="tr-map-title"><span>{t('АСТАНА / ТРАНСПОРТНАЯ СЕТЬ')}</span><strong>{t(activeScenario.mapTitle)}</strong><small>18:00 — 19:00 <span>UTC +5</span></small></div>
          <div className={`tr-node-card ${improved ? 'is-resolved' : ''}`}><span className="tr-node-icon">{improved ? <Check size={15} /> : <Activity size={15} />}</span><div><strong>{t(activeScenario.nodeTitle)}</strong><small>{t(activeScenario.nodeDetail)}</small></div><span className="tr-node-index">{String(scenarios.indexOf(activeScenario) + 1).padStart(2, '0')}</span></div>
          <div className="tr-map-tools"><button className={`tr-icon-button ${layersOpen ? 'active' : ''}`} aria-label={t("Слои карты")} aria-expanded={layersOpen} onClick={() => setLayersOpen(!layersOpen)} title={t("Слои карты")}><Layers3 size={17} /></button><button className="tr-icon-button" aria-label={t("Переключить ракурс камеры")} title={t("Переключить ракурс камеры")} onClick={() => setView(view === 'orbit' ? 'junction' : 'orbit')}><Crosshair size={17} /></button></div>
          {layersOpen && <div className="tr-layers"><strong>{t("Слои карты")}</strong><label><input type="checkbox" checked={agentsVisible} onChange={e => setAgentsVisible(e.target.checked)} />{t("Агенты и потоки")}</label><label><input type="checkbox" checked={buildingsVisible} onChange={e => setBuildingsVisible(e.target.checked)} />{t("Здания и ориентиры")}</label></div>}
          <div className="tr-compass"><Navigation size={21} strokeWidth={1.2} /><span>N</span></div>
          <div className="tr-map-bottom"><div className="tr-legend"><span><i className="tr-dot-car" />{t("Автомобили")}</span><span><i className="tr-dot-bus" />{t("Общественный транспорт")}</span><span><i className="tr-dot-jam" />{t("Затор")}</span></div><div className="tr-scale"><span>{t("СХЕМА / 1 : 25 000")}</span><i /></div></div>
          <div className="tr-viewbar"><div className="tr-view-switch" aria-label={t("Ракурс камеры")}><button aria-pressed={view === 'orbit'} onClick={() => setView('orbit')}><Orbit size={14} />{t("Орбитальный обзор")}</button><button aria-pressed={view === 'junction'} onClick={() => setView('junction')}><Maximize2 size={13} />{t("Крупный план")}</button></div><span className="tr-map-hint">{t("Вращайте карту · Скролл для масштаба")}</span><button className="tr-icon-button" aria-label={t(paused ? 'Продолжить симуляцию' : 'Приостановить симуляцию')} onClick={() => setPaused(!paused)}>{paused ? <Play size={15} /> : <Pause size={15} />}</button></div>
        </section>
        <aside className="tr-sidebar">
          <section className="tr-panel tr-scenario-panel"><div className="tr-panel-heading"><span><Settings2 size={15} />{t("Сценарий моделирования")}</span><span className="tr-panel-number">01—04</span></div><p className="tr-panel-description">{t('Три способа изменить движение.')}<br />{' '}{t('Сравните их с текущей ситуацией.')}</p>
            <div className="tr-scenario-list" role="group" aria-label={t('Сценарий моделирования')}>
              {scenarios.map((item, index) => {
                const selected = scenario === item.id;
                return <button key={item.id} className={`tr-scenario ${item.id === 'baseline' ? 'baseline' : 'project'} ${selected ? 'selected' : ''}`} onClick={() => choose(item.id)} aria-label={t(item.title)} aria-pressed={selected}>
                  <span className="tr-scenario-header"><span className="tr-option-number">{String(index + 1).padStart(2, '0')}</span><strong>{t(item.title)}</strong><span className="tr-radio" /></span>
                  <span className="tr-scenario-meta">{item.id === 'baseline' ? <span className="tr-tiny-dot" /> : <GitBranch size={12} />}{t(item.subtitle)}</span>
                  {selected && <span className="tr-scenario-caption">{t(item.caption)}</span>}
                  {selected && item.id !== 'baseline' && <span className="tr-scenario-cta">{t(error ? 'Сцена недоступна' : !ready ? 'Загрузка сценария…' : paused ? 'Симуляция приостановлена' : transitioning ? 'Преобразуем инфраструктуру' : 'Проект активен')}{ready && !error && !transitioning ? <Check size={15} /> : <ArrowRight size={15} />}</span>}
                </button>;
              })}
            </div>
            <div className="tr-transition-status" role="status"><span className={transitioning ? 'tr-status-dot' : ''} />{t(error ? 'Сцена недоступна' : !ready ? 'Собираем цифровой город…' : paused ? 'Симуляция приостановлена' : transitioning ? 'Агенты адаптируют маршруты…' : scenario !== 'baseline' ? 'Потоки перераспределены' : 'Модель готова к эксперименту')}</div>
          </section>
          <section className="tr-panel tr-flow-panel"><div className="tr-panel-heading"><span><Route size={15} />{t("Распределение потока")}</span><span className="tr-panel-number">{t('В РЕАЛЬНОМ ВРЕМЕНИ')}</span></div><div className="tr-modal-split"><strong>{number(100 - transitShare)}<small>%</small></strong><span>{t("личный")}<br />{t("транспорт")}</span><strong className="tr-cyan">{number(transitShare)}<small>%</small></strong><span>{t("общественный")}<br />{t("транспорт")}</span></div><div className="tr-split-bar"><span style={{ width: `${100 - transitShare}%` }} /><span /></div><div className="tr-reroute"><GitBranch size={14} /><span>{t("На новую развязку")}</span><strong>{number(reroutedShare)}%</strong></div></section>
          <div className="tr-sidebar-note"><ScanLine size={16} /><span>{t("Демонстрационная модель · Синтетические данные")}</span></div>
        </aside>
      </div>
      <section className="tr-metrics" aria-label={t("Телеметрия сценария")}>
        <article className="tr-metric"><div className="tr-metric-label"><Gauge size={15} />{t("Скорость потока")}<span className="tr-metric-index">01</span></div><div className="tr-metric-value"><strong>{number(speed)}</strong><span>{t("км/ч")}</span><Sparkline project={p} type="speed" /></div><div className="tr-metric-footer"><span className={improved ? 'tr-positive' : 'tr-negative'}>{improved ? <ArrowUpRight size={13} /> : <Activity size={13} />}{improved ? t('+{0}% к базовому сценарию', [number((speed / SCENARIO_METRICS.baseline.speed - 1) * 100)]) : t('Перегруженная сеть')}</span></div></article>
        <article className="tr-metric"><div className="tr-metric-label"><Activity size={15} />{t("Средняя задержка")}<span className="tr-metric-index">02</span></div><div className="tr-metric-value"><strong>+{number(delay)}</strong><span>{t("мин")}</span><Sparkline project={p} type="delay" /></div><div className="tr-metric-footer"><span className={improved ? 'tr-positive' : 'tr-negative'}>{improved ? <ArrowDownRight size={13} /> : <Activity size={13} />}{improved ? t('Экономия времени: {0} мин', [number(SCENARIO_METRICS.baseline.delay - delay)]) : t('Потерянное время в пути')}</span></div></article>
        <article className="tr-metric"><div className="tr-metric-label"><Route size={15} />{t("Пропускная способность")}<span className="tr-metric-index">03</span></div><div className="tr-metric-value"><strong>{number(throughput)}</strong><span>{t("агентов/ч")}</span></div><div className="tr-metric-footer"><span>{t('Пропускная способность')}</span><span className="tr-positive"><ArrowUpRight size={13} />{number((throughput / SCENARIO_METRICS.baseline.throughput - 1) * 100)}%</span></div></article>
        <article className="tr-metric tr-impact"><div className="tr-metric-label"><Sparkles size={15} />{t("Влияние на качество жизни")}<span className="tr-metric-index">04</span></div><div className="tr-metric-value"><strong>+{impact.toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong><span>{t('пт.')}</span><Sparkline project={p} type="impact" /></div><div className="tr-metric-footer"><span>{t('Влияние на AQLS')}</span><span className="tr-positive">{t(improved ? 'Город становится комфортнее' : 'Потенциал для изменений')}</span></div></article>
      </section>
      <section className="tr-insight"><span className="tr-insight-icon"><GitBranch size={19} /></span><div><strong>{t(scenario !== 'baseline' ? 'Меньше времени в дороге. Больше времени для жизни.' : 'Три сценария — три способа разгрузить город.')}</strong><p>{t(activeScenario.insight)}</p></div><span className="tr-insight-tag">{improved ? t('−{0}% ПИКОВОЙ ЗАДЕРЖКИ', [number(peakDelayReduction)]) : t('ПРОВЕРЬТЕ ГИПОТЕЗУ')}<MoveUpRight size={14} /></span></section>
      <footer className="tr-footer"><span><span className="tr-status-dot" />{t("ДВИЖОК АГЕНТНОГО МОДЕЛИРОВАНИЯ")} <span className="tr-footer-separator">/</span> v1.0</span><span>{ready ? `${telemetry.fps} FPS` : 'WEBGL'}<span className="tr-footer-separator">/</span>{AGENT_COUNT} {t("агентов")}<span className="tr-footer-separator">/</span>{number(telemetry.elapsed)} {t("с")} <button onClick={reset}><RotateCcw size={12} />{t("Сбросить")}</button></span></footer>
    </div>
    {help && <div className="tr-modal-backdrop" onClick={() => setHelp(false)}><section className="tr-modal" role="dialog" aria-modal="true" aria-labelledby="tr-help-title" onClick={e => e.stopPropagation()}><button autoFocus className="tr-modal-close tr-icon-button" aria-label={t("Закрыть описание модели")} onClick={() => setHelp(false)}><X size={20} /></button><div className="tr-eyebrow">{t('АСТАНА / ЛАБОРАТОРИЯ СИМУЛЯЦИИ')}</div><h2 id="tr-help-title">{t("Город, который реагирует")}</h2><p>{t("420 агентов движутся между жилыми и деловыми кластерами Нуры, Есиля и Сарыарки. При превышении вместимости моста скорость агентов падает до 10%.")}</p><p>{t("Три сценария: новая развязка переносит 40% потока на эстакаду; выделенные полосы увеличивают долю общественного транспорта до 60%; умные светофоры согласуют движение на подходах к мостам. Переход занимает две секунды, сценарий можно сменить в любой момент.")}</p><p>{t("Телеметрия — заданные демонстрационные показатели, а не измеренный прогноз. Средняя задержка: 48 минут в базе, 9 с развязкой, 18 с автобусными полосами, 25 с умными светофорами. Пиковая задержка — отдельный показатель. География схематична.")}</p><p>{t("Перетаскивайте карту для вращения, используйте колесо для масштаба. На сенсорном экране — один палец для вращения, два для масштаба. Пауза останавливает агентов и трансформацию.")}</p><button className="tr-modal-action" onClick={() => setHelp(false)}>{t("Начать эксперимент")}<ArrowRight size={15} /></button></section></div>}
  </main>;
}
