import React, { useCallback, useState } from 'react';
import { Header } from './components/Header';
import { DecisionJourney } from './components/DecisionJourney';
import { BudgetBar } from './components/BudgetBar';
import { ScoreDashboard } from './components/ScoreDashboard';
import { DistrictMap } from './components/DistrictMap';
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

export const App: React.FC = () => {
  const { draft, setDraft, scenarios, saveScenario, deleteScenario, notices } = useScenarioStorage();
  const { decisions, selectedDistrictId } = draft;
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
        {notices.map((notice) => <p key={notice}>{notice}</p>)}
      </div>}
      {activeEvents.length > 0 && <p className="analysis-notice">
        Черновик сохраняет только выбранные меры. После перезагрузки экспериментальные кризисы будут отключены.
      </p>}

      {/* 2. Hero Score Dashboard */}
      <DecisionJourney districtId={selectedDistrictId ?? 'nura'} focus={problemFocus}
        simulation={simulation} savedCount={scenarios.length}
        onDistrict={selectDistrict} onProblem={setProblemFocus}
        onCompare={() => setIsCompareOpen(true)} />
      <ScoreDashboard simulation={simulation} />

      {/* 3. Budget and Decisions Slots Control Bar */}
      <BudgetBar
        validation={simulation.validation}
        decisions={decisions}
        onRemoveDecision={handleRemoveDecision}
      />
      {selectionErrors.length > 0 && <div role="alert" className="analysis-notice">{selectionErrors.join(' ')}</div>}

      {/* 4. AI Optimizer recommendations */}
      {ENABLE_EXPERIMENTS && <OptimizerCard
        simulation={simulation}
        decisions={decisions}
        onApplySwap={handleApplySwap}
      />}

      {/* 5. Main Simulation Workspace Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>
        
        {/* Left Column: 14 Measures Catalog (5 cols on wide screens) */}
        <div style={{ gridColumn: 'span 12', minWidth: 0 }} className="lg:grid-column-5">
          <style>{`
            @media (min-width: 1024px) {
              .lg\\:grid-column-5 { grid-column: span 5 !important; }
              .lg\\:grid-column-7 { grid-column: span 7 !important; }
            }
          `}</style>
          <DecisionPanel
            key={selectedDistrictId}
            districtId={selectedDistrictId ?? 'nura'}
            problemFocus={problemFocus}
            onClearProblem={() => setProblemFocus(null)}
            decisions={decisions}
            onAddDecision={handleAddDecision}
            onRemoveDecision={handleRemoveDecision}
          />
        </div>

        {/* Right Column: Map, Indicators, and AI analysis (7 cols on wide screens) */}
        <div style={{ gridColumn: 'span 12', display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }} className="lg:grid-column-7">
          
          {/* Interactive District Heatmap of Astana */}
          <DistrictMap
            districts={simulation.districts}
            selectedDistrictId={selectedDistrictId}
            onSelectDistrict={selectDistrict}
            decisions={decisions}
          />

          {/* Detailed 10 Indicators Before/After */}
          <RadarAnalytics
            simulation={simulation}
            selectedDistrictId={selectedDistrictId}
          />

          {/* Server analysis and optional question */}
          <AIInsightCard simulation={simulation} scenarioRevision={scenarioRevision} hasExperimentalEvents={activeEvents.length > 0} />

        </div>

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
