import React, { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Box, Check, ChevronRight, CircleHelp, Crosshair, Expand, Gauge, GitBranch, Layers3, MapPin, Maximize2, MoveUpRight, Navigation, Orbit, Pause, Play, RotateCcw, Route, ScanLine, Settings2, Sparkles, X } from 'lucide-react';
import type { SceneController, SceneOptions, Telemetry } from './scene';
import { AGENT_COUNT, CameraView } from './simulation';
import './transport.css';
import { getLanguage, t, useLanguage } from '../i18n';
import { ChartTooltip } from '../components/ChartTooltip';

const initialTelemetry: Telemetry = { blend: 0, occupancy: [0, 0, 0], congestion: [0, 1, 0], fps: 0, elapsed: 0, completed: 0 };
const number = (n: number) => Math.round(n).toLocaleString(getLanguage());

function Sparkline({ project, type }: { project: number; type: 'speed' | 'delay' | 'impact' }) {
  const base = [22, 27, 20, 29, 25, 34, 29, 32, 26, 35, 30, 34, 29, 33, 31, 35, 32, 36];
  const points = base.map((v, i) => `${i * 7},${type === 'delay' ? 50 - v + project * i * 1.15 : v - project * i * 1.3}`).join(' ');
  const label = t(type === 'speed' ? 'Скорость потока' : type === 'delay' ? 'Средняя задержка' : 'Влияние на качество жизни');
  const unit = t(type === 'speed' ? 'км/ч' : type === 'delay' ? 'мин' : 'пт.');
  const current = type === 'speed' ? number(12 + project * 32) : type === 'delay' ? number(48 - project * 39) : (project * 8.4).toLocaleString(getLanguage(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const baseline = type === 'speed' ? '12' : type === 'delay' ? '48' : '0';
  return <ChartTooltip className={`tr-spark tr-spark-${type}`} label={label}
    description={t('Сценарий: {0}; база: {1}. Иллюстрация, не история измерений.', [`${current} ${unit}`, `${baseline} ${unit}`])}>
    <svg width="100%" height="100%" viewBox="0 0 120 52" aria-hidden="true"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.8" /><polyline points={`0,52 ${points} 119,52`} fill="currentColor" opacity=".06" /></svg>
  </ChartTooltip>;
}

/** Drop-in React component. WebGL is dynamically imported and disposed on unmount. */
export default function TransportTwin() {
  const language = useLanguage();
  const host = useRef<HTMLDivElement>(null), shell = useRef<HTMLElement>(null);
  const controller = useRef<SceneController | null>(null);
  const [project, setProject] = useState(false), [paused, setPaused] = useState(false);
  const [view, setView] = useState<CameraView>('orbit');
  const [agentsVisible, setAgentsVisible] = useState(true), [buildingsVisible, setBuildingsVisible] = useState(true);
  const [telemetry, setTelemetry] = useState(initialTelemetry);
  const [error, setError] = useState(''), [ready, setReady] = useState(false), [retry, setRetry] = useState(0);
  const [help, setHelp] = useState(false), [layersOpen, setLayersOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const options: SceneOptions = { project, paused, view, agentsVisible, buildingsVisible };
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
  useEffect(() => { controller.current?.setOptions({ project, paused, view, agentsVisible, buildingsVisible }); }, [project, paused, view, agentsVisible, buildingsVisible]);
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
  const p = telemetry.blend, transitioning = ready && !error && (project ? p < .999 : p > .001);
  const speed = 12 + p * 32, delay = 48 - p * 39, throughput = 1920 + p * 2880;
  const reset = () => { setProject(false); setPaused(false); setView('orbit'); controller.current?.reset(); setTelemetry(initialTelemetry); };
  const choose = (next: boolean) => { setProject(next); setPaused(false); };
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
          {(!ready || error) && <div className="tr-canvas-message" role={error ? 'alert' : 'status'}><ScanLine size={30} /><strong>{t(error || 'Собираем цифровой город…')}</strong>{error && <button onClick={() => { setRetry(n => n + 1); setProject(false); }}>{t("Перезапустить сцену")}</button>}</div>}
          <div className="tr-map-top"><div className="tr-live-badge"><span className={paused ? 'tr-dot-paused' : 'tr-status-dot'} />{t(paused ? 'ПАУЗА' : 'СИМУЛЯЦИЯ В РЕАЛЬНОМ ВРЕМЕНИ')}<span className="tr-live-divider" />{AGENT_COUNT} {t("АГЕНТОВ")}</div><button className="tr-icon-button" aria-label={t("Полноэкранный режим")} title={t("Полноэкранный режим")} onClick={toggleFullscreen}><Expand size={17} /></button></div>
          <div className="tr-map-title"><span>{t('АСТАНА / ТРАНСПОРТНАЯ СЕТЬ')}</span><strong>{t(p > .8 ? 'Город в свободном движении' : 'Вечерний час пик')}</strong><small>18:00 — 19:00 <span>UTC +5</span></small></div>
          <div className={`tr-node-card ${p > .5 ? 'is-resolved' : ''}`}><span className="tr-node-icon">{p > .5 ? <Check size={15} /> : <Activity size={15} />}</span><div><strong>{t(p > .5 ? 'Новая связь берегов' : 'Критическая нагрузка')}</strong><small>{t(p > .5 ? 'Эстакада + выделенная полоса' : 'Центральный мост · узкое горлышко')}</small></div><span className="tr-node-index">01</span></div>
          <div className="tr-map-tools"><button className={`tr-icon-button ${layersOpen ? 'active' : ''}`} aria-label={t("Слои карты")} aria-expanded={layersOpen} onClick={() => setLayersOpen(!layersOpen)} title={t("Слои карты")}><Layers3 size={17} /></button><button className="tr-icon-button" aria-label={t("Переключить ракурс камеры")} title={t("Переключить ракурс камеры")} onClick={() => setView(view === 'orbit' ? 'junction' : 'orbit')}><Crosshair size={17} /></button></div>
          {layersOpen && <div className="tr-layers"><strong>{t("Слои карты")}</strong><label><input type="checkbox" checked={agentsVisible} onChange={e => setAgentsVisible(e.target.checked)} />{t("Агенты и потоки")}</label><label><input type="checkbox" checked={buildingsVisible} onChange={e => setBuildingsVisible(e.target.checked)} />{t("Здания и ориентиры")}</label></div>}
          <div className="tr-compass"><Navigation size={21} strokeWidth={1.2} /><span>N</span></div>
          <div className="tr-map-bottom"><div className="tr-legend"><span><i className="tr-dot-car" />{t("Автомобили")}</span><span><i className="tr-dot-bus" />{t("Общественный транспорт")}</span><span><i className="tr-dot-jam" />{t("Затор")}</span></div><div className="tr-scale"><span>{t("СХЕМА / 1 : 25 000")}</span><i /></div></div>
          <div className="tr-viewbar"><div className="tr-view-switch" aria-label={t("Ракурс камеры")}><button aria-pressed={view === 'orbit'} onClick={() => setView('orbit')}><Orbit size={14} />{t("Орбитальный обзор")}</button><button aria-pressed={view === 'junction'} onClick={() => setView('junction')}><Maximize2 size={13} />{t("Крупный план")}</button></div><span className="tr-map-hint">{t("Вращайте карту · Скролл для масштаба")}</span><button className="tr-icon-button" aria-label={t(paused ? 'Продолжить симуляцию' : 'Приостановить симуляцию')} onClick={() => setPaused(!paused)}>{paused ? <Play size={15} /> : <Pause size={15} />}</button></div>
        </section>
        <aside className="tr-sidebar">
          <section className="tr-panel tr-scenario-panel"><div className="tr-panel-heading"><span><Settings2 size={15} />{t("Сценарий моделирования")}</span><span className="tr-panel-number">01—02</span></div><p className="tr-panel-description">{t("Измените инфраструктуру.")}<br />{' '}{t("Посмотрите, как отреагирует город.")}</p>
            <button className={`tr-scenario ${!project ? 'selected baseline' : ''}`} onClick={() => choose(false)} aria-pressed={!project}><span className="tr-scenario-top"><span className="tr-option-number">01</span><span className="tr-radio" /></span><strong>{t("Текущая ситуация")}</strong><span className="tr-scenario-meta"><span className="tr-tiny-dot" />{t("Час пик · Базовый сценарий")}</span><span className="tr-scenario-caption">{t("3 моста. Привычные маршруты.")}<br />{t("Город на пределе пропускной способности.")}</span></button>
            <button className={`tr-scenario project ${project ? 'selected' : ''}`} onClick={() => choose(true)} aria-pressed={project}><span className="tr-scenario-top"><span className="tr-option-number">02</span><span className="tr-project-tag"><Sparkles size={10} />{t('ЧТО ЕСЛИ')}</span><span className="tr-radio" /></span><strong>{t("Новая развязка")}<br /><span>{t("+ выделенный Bus Lane")}</span></strong><span className="tr-scenario-meta"><GitBranch size={12} />{t("Симуляция проекта")}</span><span className="tr-scenario-caption">{t("Новый маршрут. Приоритет экспресса.")}<br />{t("Движение без узких мест.")}</span><span className="tr-scenario-cta">{t(project ? transitioning ? 'Преобразуем инфраструктуру' : 'Проект активен' : 'Запустить сценарий')}{project && !transitioning ? <Check size={15} /> : <ArrowRight size={15} />}</span></button>
            <div className="tr-transition-status" role="status"><span className={transitioning ? 'tr-status-dot' : ''} />{t(paused ? 'Симуляция приостановлена' : transitioning ? 'Агенты адаптируют маршруты…' : project ? 'Потоки перераспределены' : 'Модель готова к эксперименту')}</div>
          </section>
          <section className="tr-panel tr-flow-panel"><div className="tr-panel-heading"><span><Route size={15} />{t("Распределение потока")}</span><span className="tr-panel-number">{t('В РЕАЛЬНОМ ВРЕМЕНИ')}</span></div><div className="tr-modal-split"><strong>{number(80 - p * 20)}<small>%</small></strong><span>{t("личный")}<br />{t("транспорт")}</span><strong className="tr-cyan">{number(20 + p * 20)}<small>%</small></strong><span>{t("общественный")}<br />{t("транспорт")}</span></div><ChartTooltip className="chart-tooltip-target--bar" label={t('Распределение потока')} description={t('Личный транспорт: {0}%; общественный: {1}%. Доли заданы сценарием.', [number(80 - p * 20), number(20 + p * 20)])}><div className="tr-split-bar" aria-hidden="true"><span style={{ width: `${80 - p * 20}%` }} /><span /></div></ChartTooltip><div className="tr-reroute"><GitBranch size={14} /><span>{t("На новую развязку")}</span><strong>{number(p * 40)}%</strong></div></section>
          <div className="tr-sidebar-note"><ScanLine size={16} /><span>{t("Демонстрационная модель · Синтетические данные")}</span></div>
        </aside>
      </div>
      <section className="tr-metrics" aria-label={t("Телеметрия сценария")}>
        <article className="tr-metric"><div className="tr-metric-label"><Gauge size={15} />{t("Скорость потока")}<span className="tr-metric-index">01</span></div><div className="tr-metric-value"><strong>{number(speed)}</strong><span>{t("км/ч")}</span><Sparkline project={p} type="speed" /></div><div className="tr-metric-footer"><span className={p > .5 ? 'tr-positive' : 'tr-negative'}>{p > .5 ? <ArrowUpRight size={13} /> : <Activity size={13} />}{t(p > .5 ? '+267% к базовому сценарию' : 'Перегруженная сеть')}</span></div></article>
        <article className="tr-metric"><div className="tr-metric-label"><Activity size={15} />{t("Средняя задержка")}<span className="tr-metric-index">02</span></div><div className="tr-metric-value"><strong>+{number(delay)}</strong><span>{t("мин")}</span><Sparkline project={p} type="delay" /></div><div className="tr-metric-footer"><span className={p > .5 ? 'tr-positive' : 'tr-negative'}>{p > .5 ? <ArrowDownRight size={13} /> : <Activity size={13} />}{t(p > .5 ? 'На 39 минут быстрее' : 'Потерянное время в пути')}</span></div></article>
        <article className="tr-metric"><div className="tr-metric-label"><Route size={15} />{t("Пропускная способность")}<span className="tr-metric-index">03</span></div><div className="tr-metric-value"><strong>{number(throughput)}</strong><span>{t("агентов/ч")}</span></div><div className="tr-metric-footer"><span>{t('Пропускная способность')}</span><span className="tr-positive"><ArrowUpRight size={13} />{number(p * 150)}%</span></div></article>
        <article className="tr-metric tr-impact"><div className="tr-metric-label"><Sparkles size={15} />{t("Влияние на качество жизни")}<span className="tr-metric-index">04</span></div><div className="tr-metric-value"><strong>+{(p * 8.4).toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong><span>{t('пт.')}</span><Sparkline project={p} type="impact" /></div><div className="tr-metric-footer"><span>{t('Влияние на AQLS')}</span><span className="tr-positive">{t(p > .5 ? 'Город становится комфортнее' : 'Потенциал для изменений')}</span></div></article>
      </section>
      <section className="tr-insight"><span className="tr-insight-icon"><GitBranch size={19} /></span><div><strong>{t(p > .8 ? 'Меньше времени в дороге. Больше времени для жизни.' : 'Один новый маршрут может изменить ритм целого города.')}</strong><p>{t(p > .8 ? '40% потока на новой развязке · Приоритет общественного транспорта · Пиковая задержка снижена на 73%' : 'Запустите проект и наблюдайте, как агенты выбирают новые пути, а центральный мост освобождается.')}</p></div><span className="tr-insight-tag">{t(p > .8 ? '−73% ПИКОВОЙ ЗАДЕРЖКИ' : 'ПРОВЕРЬТЕ ГИПОТЕЗУ')}<MoveUpRight size={14} /></span></section>
      <footer className="tr-footer"><span><span className="tr-status-dot" />{t("ДВИЖОК АГЕНТНОГО МОДЕЛИРОВАНИЯ")} <span className="tr-footer-separator">/</span> v1.0</span><span>{ready ? `${telemetry.fps} FPS` : 'WEBGL'}<span className="tr-footer-separator">/</span>{AGENT_COUNT} {t("агентов")}<span className="tr-footer-separator">/</span>{number(telemetry.elapsed)} {t("с")} <button onClick={reset}><RotateCcw size={12} />{t("Сбросить")}</button></span></footer>
    </div>
    {help && <div className="tr-modal-backdrop" onClick={() => setHelp(false)}><section className="tr-modal" role="dialog" aria-modal="true" aria-labelledby="tr-help-title" onClick={e => e.stopPropagation()}><button autoFocus className="tr-modal-close tr-icon-button" aria-label={t("Закрыть описание модели")} onClick={() => setHelp(false)}><X size={20} /></button><div className="tr-eyebrow">{t('АСТАНА / ЛАБОРАТОРИЯ СИМУЛЯЦИИ')}</div><h2 id="tr-help-title">{t("Город, который реагирует")}</h2><p>{t("420 агентов движутся между жилыми и деловыми кластерами Нуры, Есиля и Сарыарки. При превышении вместимости моста скорость агентов падает до 10%.")}</p><p>{t("Сценарий проекта за две секунды поднимает эстакаду, направляет на неё 40% агентов и увеличивает долю пассажиров общественного транспорта с 20% до 40%.")}</p><p>{t("Телеметрия — заданные демонстрационные показатели сценария, а не измеренный прогноз. Средняя задержка снижается с 48 до 9 минут (81%), показатель пиковой задержки 73% задан отдельно. География схематична.")}</p><p>{t("Перетаскивайте карту для вращения, используйте колесо для масштаба. На сенсорном экране — один палец для вращения, два для масштаба. Пауза останавливает агентов и трансформацию.")}</p><button className="tr-modal-action" onClick={() => setHelp(false)}>{t("Начать эксперимент")}<ArrowRight size={15} /></button></section></div>}
  </main>;
}
