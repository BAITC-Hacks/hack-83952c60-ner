import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Layers, Plus, Trash2, X } from 'lucide-react';
import { runSimulation } from '../engine/simulator';
import type { SelectedDecision, SimulationResult, ValidSimulationResult } from '../engine/types';
import type { SavedScenario } from '../scenarios/storage';
import { ScenarioComparison, formatScenarioNumber, formatScenarioDifference } from './ScenarioComparison';

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSim: SimulationResult;
  scenarios: SavedScenario[];
  onSaveScenario: (name: string) => boolean;
  onDeleteScenario: (id: string) => void;
  onLoadScenario: (decisions: SelectedDecision[]) => void;
  hasExperimentalEvents: boolean;
  notices: string[];
}

export interface EvaluatedScenario extends SavedScenario {
  simulation: ValidSimulationResult;
}

export function rankScenarios(scenarios: SavedScenario[]): EvaluatedScenario[] {
  return scenarios.flatMap((scenario) => {
    const simulation = runSimulation(scenario.decisions);
    return simulation.isValid ? [{ ...scenario, simulation }] : [];
  }).sort((a, b) => b.simulation.finalScore - a.simulation.finalScore
    || Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

const focusableSelector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]';

export const CompareModal: React.FC<CompareModalProps> = ({
  isOpen, onClose, currentSim, scenarios, onSaveScenario, onDeleteScenario,
  onLoadScenario, hasExperimentalEvents, notices,
}) => {
  const [name, setName] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [scenarioAId, setScenarioAId] = useState('');
  const [scenarioBId, setScenarioBId] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();
  const nameId = useId();
  const saveHelpId = useId();
  const scenarioASelectId = useId();
  const scenarioBSelectId = useId();
  const ranked = useMemo(() => rankScenarios(scenarios), [scenarios]);
  const scenarioA = ranked.find((scenario) => scenario.id === scenarioAId);
  const scenarioB = ranked.find((scenario) => scenario.id === scenarioBId);

  useEffect(() => {
    const ids = new Set(scenarios.map((scenario) => scenario.id));
    setScenarioAId((id) => ids.has(id) ? id : '');
    setScenarioBId((id) => ids.has(id) ? id : '');
  }, [scenarios]);

  useEffect(() => {
    if (!isOpen) return;
    setSaveStatus('');
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = dialogRef.current;
    // Preserve DOM order even in selector engines that group comma-separated matches.
    const focusables = () => Array.from(dialog?.querySelectorAll<HTMLElement>('*') ?? [])
      .filter((element) => element.matches(focusableSelector));
    dialog?.querySelector<HTMLInputElement>('input')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      const activeElement = document.activeElement;
      if (!first) {
        event.preventDefault();
        dialog?.focus();
      } else if (!dialog?.contains(activeElement) || (event.shiftKey && activeElement === first)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog?.contains(event.target)) {
        (focusables()[0] ?? dialog)?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      document.body.style.overflow = originalOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const saveHelp = hasExperimentalEvents
    ? 'Сохранение недоступно при активных кризисах. Сбросьте события и соберите сценарий без кризисов.'
    : !currentSim.isValid
      ? 'Для сохранения выберите допустимый набор из пяти решений.'
      : 'Сохранится независимая копия пяти решений. Введите название сценария.';
  const canSave = currentSim.isValid && !hasExperimentalEvents && Boolean(name.trim());

  return (
    <div className="scenarios-overlay">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="glass-panel scenarios-dialog">
        <header className="scenarios-header">
          <div className="scenarios-heading">
            <Layers size={24} aria-hidden="true" />
            <div>
              <h2 id={titleId}>Сценарии</h2>
              <p>Личная библиотека решений и подробное сравнение</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-secondary scenarios-close" aria-label="Закрыть сценарии"><X size={20} aria-hidden="true" /></button>
        </header>

        <div className="scenarios-content">
          {notices.length > 0 && <div role="status" className="scenarios-notices">{notices.map((notice) => <p key={notice}>{notice}</p>)}</div>}
          <form className="scenarios-save" onSubmit={(event) => {
            event.preventDefault();
            if (!canSave) return;
            if (onSaveScenario(name.trim())) {
              setName('');
              setSaveStatus('Сценарий добавлен в библиотеку.');
            } else {
              setSaveStatus('Не удалось добавить сценарий. Проверьте выбранные решения.');
            }
          }}>
            <div className="scenarios-field">
              <label htmlFor={nameId}>Название сценария</label>
              <input id={nameId} value={name} onChange={(event) => { setName(event.target.value); setSaveStatus(''); }} placeholder="Например, социальный приоритет" aria-describedby={saveHelpId} />
            </div>
            <button type="submit" className="btn-primary" disabled={!canSave} aria-describedby={saveHelpId}><Plus size={16} aria-hidden="true" />Сохранить сценарий</button>
            <p id={saveHelpId} className="scenarios-help">{saveHelp}</p>
            {saveStatus && <p role="status" className="scenarios-help">{saveStatus}</p>}
          </form>

          <section aria-label="Библиотека сценариев" className="scenarios-section">
            <h3>Библиотека <span className="scenarios-count">{ranked.length}</span></h3>
            <p className="scenarios-help">По Score: сначала лучший результат, при равенстве — новый сценарий. Данные доступны в этом браузере для текущего адреса приложения.</p>
            {ranked.length === 0 ? <p className="scenarios-empty">Пока нет сохранённых сценариев. Соберите пять решений и сохраните первый вариант.</p> : (
              <div className="scenarios-table-scroll" tabIndex={0} role="region" aria-label="Таблица сохранённых сценариев">
                <table className="scenarios-table scenarios-library-table">
                  <thead><tr><th scope="col">Название и дата</th><th scope="col">Score</th><th scope="col">Прирост</th><th scope="col">Бюджет</th><th scope="col">Критические показатели</th><th scope="col">Действия</th></tr></thead>
                  <tbody>{ranked.map((scenario, index) => (
                    <tr key={scenario.id}>
                      <th scope="row"><span className="scenarios-name">{index + 1}. {scenario.name}</span><time dateTime={scenario.createdAt}>{new Date(scenario.createdAt).toLocaleString('ru-RU')}</time></th>
                      <td className="scenarios-score">{formatScenarioNumber(scenario.simulation.finalScore)}</td>
                      <td>{formatScenarioDifference(scenario.simulation.scoreDelta)}</td>
                      <td>{scenario.simulation.validation.totalCost}/100</td>
                      <td>{scenario.simulation.finalCritCount}</td>
                      <td><div className="scenarios-actions">
                        <button type="button" className="btn-secondary" aria-label={`Загрузить сценарий ${index + 1}: ${scenario.name}`} onClick={() => { onLoadScenario(scenario.decisions.map((decision) => ({ ...decision }))); onClose(); }}><ArrowUpRight size={14} aria-hidden="true" />Загрузить</button>
                        <button type="button" className="btn-secondary" aria-label={`Удалить сценарий ${index + 1}: ${scenario.name}`} onClick={() => onDeleteScenario(scenario.id)}><Trash2 size={15} aria-hidden="true" /></button>
                      </div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-label="Сравнение сценариев" className="scenarios-section">
            <h3>Сравнение A и B</h3>
            <p className="scenarios-help">Все разницы рассчитаны как B − A. Показатели пересчитываются по сохранённым решениям.</p>
            {ranked.length < 2 && <p className="scenarios-empty">Сохраните хотя бы два сценария, чтобы сравнить результаты.</p>}
            <div className="scenarios-pair-fields">
              <div className="scenarios-field"><label htmlFor={scenarioASelectId}>Сценарий A</label><select id={scenarioASelectId} value={scenarioA?.id ?? ''} onChange={(event) => setScenarioAId(event.target.value)} disabled={ranked.length === 0}><option value="">Выберите сценарий A</option>{ranked.map((scenario, index) => <option key={scenario.id} value={scenario.id} disabled={scenario.id === scenarioBId}>{index + 1}. {scenario.name}</option>)}</select></div>
              <div className="scenarios-field"><label htmlFor={scenarioBSelectId}>Сценарий B</label><select id={scenarioBSelectId} value={scenarioB?.id ?? ''} onChange={(event) => setScenarioBId(event.target.value)} disabled={ranked.length < 2}><option value="">Выберите сценарий B</option>{ranked.map((scenario, index) => <option key={scenario.id} value={scenario.id} disabled={scenario.id === scenarioAId}>{index + 1}. {scenario.name}</option>)}</select></div>
            </div>
            {ranked.length >= 2 && (!scenarioA || !scenarioB) && <p className="scenarios-help">Выберите два разных сценария в полях A и B.</p>}
            {scenarioA && scenarioB && scenarioA.id !== scenarioB.id && <ScenarioComparison scenarioA={scenarioA} scenarioB={scenarioB} />}
          </section>
        </div>
      </div>
    </div>
  );
};
