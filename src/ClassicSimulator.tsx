import React, { useCallback, useEffect, useState } from 'react';
import { t, useLanguage } from './i18n';
import { Header } from './components/Header';
import { DistrictCouncil } from './components/DistrictCouncil';
import { DecisionJourney } from './components/DecisionJourney';
import { BudgetBar } from './components/BudgetBar';
import { ScoreDashboard } from './components/ScoreDashboard';
import { DistrictMap } from './components/DistrictMap';
import { AstanaTransitMap } from './components/AstanaTransitMap';
import { WorkspaceTabs } from './components/WorkspaceTabs';
import { DecisionPanel } from './components/DecisionPanel';
import { RadarAnalytics } from './components/RadarAnalytics';
import { AIInsightCard } from './components/AIInsightCard';
import { OptimizerCard } from './components/OptimizerCard';
import { CompareModal } from './components/CompareModal';
import { CrisisModal } from './components/CrisisModal';
import { PresentationModal } from './components/PresentationModal';
import { CityEvent, DistrictId, IndicatorId, SelectedDecision } from './engine/types';
import { runSimulation } from './engine/simulator';
import { validateDecisions } from './engine/validator';
import { RecommendationSwap } from './engine/optimizer';
import { useScenarioStorage } from './scenarios/useScenarioStorage';

const ENABLE_EXPERIMENTS = import.meta.env.VITE_ENABLE_EXPERIMENTS === 'true';
type WorkspaceSection = 'decisions' | 'maps' | 'analytics' | 'requests';

export const App: React.FC<{ onDecisionsChange?: (decisions: SelectedDecision[]) => void }> = ({ onDecisionsChange }) => {
  useLanguage();
  const [section, setSection] = useState<WorkspaceSection>('decisions');
  const openSection = (next: WorkspaceSection) => {
    setSection(next);
    queueMicrotask(() => document.getElementById(`planner-panel-${next}`)?.focus());
  };
  const { draft, setDraft, scenarios, saveScenario, deleteScenario, notices } = useScenarioStorage();
  const { decisions, selectedDistrictId } = draft;
  useEffect(() => { onDecisionsChange?.(decisions); }, [decisions, onDecisionsChange]);
  const setDecisions = (next: SelectedDecision[]) => {
    setDraft((current) => ({ ...current, decisions: next.map((decision) => ({ ...decision })) }));
  };
  const [scenarioRevision, setScenarioRevision] = useState(0);
  const [selectionErrors, setSelectionErrors] = useState<string[]>([]);
  const [problemFocus, setProblemFocus] = useState<IndicatorId | null>(null);
  const selectDistrict = (id: DistrictId) => {
    setDraft((current) => ({ ...current, selectedDistrictId: id }));
    setProblemFocus(null);
  };

  const [activeEvents, setActiveEvents] = useState<CityEvent[]>([]);

  // Modal states
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isCrisisOpen, setIsCrisisOpen] = useState(false);
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);
  const closeScenarios = useCallback(() => setIsCompareOpen(false), []);

  // Run simulation in real-time
  const simulation = runSimulation(decisions, activeEvents);

  const handleAddDecision = (decision: SelectedDecision) => {
    const nextDecisions = [...decisions, decision];
    const validation = validateDecisions(nextDecisions, { allowIncomplete: true });
    setSelectionErrors(validation.errors);
    if (!validation.isValid) return;
    setDecisions(nextDecisions);
    setScenarioRevision((revision) => revision + 1);
  };

  const handleRemoveDecision = (index: number) => {
    setDecisions(decisions.filter((_, i) => i !== index));
    setSelectionErrors([]);
    setScenarioRevision((revision) => revision + 1);
  };

  const handleReset = () => {
    setDraft({ decisions: [], selectedDistrictId: 'nura' });
    setActiveEvents([]);
    setSelectionErrors([]);
    setScenarioRevision((revision) => revision + 1);
  };

  const handleLoadPreset = (preset: SelectedDecision[]) => {
    const validation = validateDecisions(preset);
    setSelectionErrors(validation.errors);
    if (!validation.isValid) return;
    setDecisions(preset);
    setActiveEvents([]);
    setScenarioRevision((revision) => revision + 1);
  };

  const handleToggleEvent = (event: CityEvent) => {
    setScenarioRevision((revision) => revision + 1);
    setActiveEvents((prev) =>
      prev.some((e) => e.id === event.id)
        ? prev.filter((e) => e.id !== event.id)
        : [...prev, event]
    );
  };

  const handleApplySwap = (swap: RecommendationSwap) => {
    const nextDecisions = decisions.filter((d) => d.measureId !== swap.removeMeasureId);
    nextDecisions.push(swap.addDecision);
    handleLoadPreset(nextDecisions);
  };

  return (
    <main className="app-shell" style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 20px 60px' }}>

      {/* 1. Header with shift timer and actions */}
      <Header
        onLoadPreset={handleLoadPreset}
        onReset={handleReset}
        onOpenCompare={() => setIsCompareOpen(true)}
        onOpenCrisis={() => setIsCrisisOpen(true)}
        onOpenPresentation={() => setIsPresentationOpen(true)}
        crisisActive={activeEvents.length > 0}
        enableExperiments={ENABLE_EXPERIMENTS}
      />

      {notices.length > 0 && <div role="status" className="analysis-notice">
        {notices.map((notice) => <p key={notice}>{t(notice)}</p>)}
      </div>}
      {activeEvents.length > 0 && <p className="analysis-notice">
        {t('Черновик сохраняет только выбранные меры. После перезагрузки экспериментальные кризисы будут отключены.')}
      </p>}


      {/* 3. Budget and Decisions Slots Control Bar */}
      <BudgetBar
        validation={simulation.validation}
        decisions={decisions}
        onRemoveDecision={handleRemoveDecision}
      />
      {selectionErrors.length > 0 && <div role="alert" className="analysis-notice">{selectionErrors.join(' ')}</div>}

      <WorkspaceTabs idPrefix="planner" label={t('Разделы планирования')} value={section} onChange={setSection} items={[
        { id: 'decisions', label: t('Решения и бюджет'), description: t('Выберите пять мер') },
        { id: 'maps', label: t('Карты города'), description: t('Районы, автобусы и LRT') },
        { id: 'analytics', label: t('Аналитика'), description: t('Показатели и AI-советник') },
        { id: 'requests', label: t('Запросы районов'), description: t('Приоритеты жителей') },
      ]} />

      <div id="planner-panel-decisions" role="tabpanel" aria-labelledby="planner-tab-decisions" hidden={section !== 'decisions'} className="workspace-panel" tabIndex={0}>
        <DecisionJourney districtId={selectedDistrictId ?? 'nura'} focus={problemFocus}
          simulation={simulation} savedCount={scenarios.length}
          onDistrict={selectDistrict} onProblem={setProblemFocus}
          onCompare={() => setIsCompareOpen(true)} />
        {ENABLE_EXPERIMENTS && <OptimizerCard simulation={simulation} decisions={decisions} onApplySwap={handleApplySwap} />}
        <DecisionPanel key={selectedDistrictId} districtId={selectedDistrictId ?? 'nura'}
          problemFocus={problemFocus} onClearProblem={() => setProblemFocus(null)}
          decisions={decisions} onAddDecision={handleAddDecision} onRemoveDecision={handleRemoveDecision} />
        <div className="glass-panel workspace-next">
          <p>{t('Проверьте, как выбранные меры меняют показатели города.')}</p>
          <button className="btn-primary" onClick={() => openSection('analytics')}>{t('Открыть аналитику')}</button>
        </div>
      </div>

      <div id="planner-panel-maps" role="tabpanel" aria-labelledby="planner-tab-maps" hidden={section !== 'maps'} className="workspace-panel" tabIndex={0}>
        <div className="workspace-panel-heading"><div><h2>{t('Карты города')}</h2><p>{t('Выберите район на схеме или изучите остановки на транспортной карте.')}</p></div></div>
        <div className="city-map-pair">
          <DistrictMap districts={simulation.districts} selectedDistrictId={selectedDistrictId} onSelectDistrict={selectDistrict} decisions={decisions} />
          <AstanaTransitMap />
        </div>
        <div className="glass-panel workspace-next"><p>{t('Выбранный район используется в каталоге мер и аналитике.')}</p><button className="btn-primary" onClick={() => openSection('decisions')}>{t('К выбору мер')}</button></div>
      </div>

      <div id="planner-panel-analytics" role="tabpanel" aria-labelledby="planner-tab-analytics" hidden={section !== 'analytics'} className="workspace-panel" tabIndex={0}>
        <div className="workspace-panel-heading"><div><h2>{t('Аналитика')}</h2><p>{t('Сравните исходные и итоговые показатели по направлениям. Затем запросите объяснение у AI-советника.')}</p></div></div>
        <ScoreDashboard simulation={simulation} />
        <div className="workspace-analytics">
          <RadarAnalytics simulation={simulation} selectedDistrictId={selectedDistrictId} onSelectDistrict={selectDistrict} />
          <AIInsightCard simulation={simulation} scenarioRevision={scenarioRevision} hasExperimentalEvents={activeEvents.length > 0} />
        </div>
        <div className="glass-panel workspace-next"><p>{t('Примите выбранные пять решений и наблюдайте последствия по месяцам. Экспериментальные кризисы не переносятся.')}</p><a className="btn-primary" href="#/digital-twin">{t('Перейти в симулятор города →')}</a></div>
      </div>

      <div id="planner-panel-requests" role="tabpanel" aria-labelledby="planner-tab-requests" hidden={section !== 'requests'} className="workspace-panel" tabIndex={0}>
        <DistrictCouncil simulation={simulation} onRequest={(district, indicator) => {
          selectDistrict(district);
          setProblemFocus(indicator);
          setSection('decisions');
          queueMicrotask(() => {
            const catalog = document.getElementById('measure-catalog');
            catalog?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
            catalog?.focus({ preventScroll: true });
          });
        }} />
      </div>

      <CompareModal
        isOpen={isCompareOpen}
        onClose={closeScenarios}
        currentSim={simulation}
        scenarios={scenarios}
        onSaveScenario={(name) => !activeEvents.length && simulation.isValid && saveScenario(name, decisions)}
        onDeleteScenario={deleteScenario}
        onLoadScenario={handleLoadPreset}
        hasExperimentalEvents={activeEvents.length > 0}
        notices={notices}
      />

      {/* Modals for Optional Features */}
      {ENABLE_EXPERIMENTS && <><CrisisModal
        isOpen={isCrisisOpen}
        onClose={() => setIsCrisisOpen(false)}
        activeEvents={activeEvents}
        onToggleEvent={handleToggleEvent}
      />

      <PresentationModal
        isOpen={isPresentationOpen}
        onClose={() => setIsPresentationOpen(false)}
        simulation={simulation}
      /></>}

    </main>
  );
};

export default App;
