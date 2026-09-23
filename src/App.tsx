import React, { useState } from 'react';
import { useLanguage } from './i18n';
import { Header } from './components/Header';
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
import { CityEvent, DistrictId, SelectedDecision } from './engine/types';
import { runSimulation } from './engine/simulator';
import { RecommendationSwap } from './engine/optimizer';

export const App: React.FC = () => {
  useLanguage();
  // Start with the official benchmark example from ТЗ Section 3:
  // M7(Нура) + M8(Нура) + M10(Нура) + M12(Город) + M5(Сарыарка)
  const [decisions, setDecisions] = useState<SelectedDecision[]>([
    { measureId: 'M7', districtId: 'nura' },
    { measureId: 'M8', districtId: 'nura' },
    { measureId: 'M10', districtId: 'nura' },
    { measureId: 'M12' },
    { measureId: 'M5', districtId: 'saryarka' },
  ]);

  const [activeEvents, setActiveEvents] = useState<CityEvent[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState<DistrictId | null>('nura');

  // Modal states
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isCrisisOpen, setIsCrisisOpen] = useState(false);
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);

  // Run simulation in real-time
  const simulation = runSimulation(decisions, activeEvents);

  const handleAddDecision = (decision: SelectedDecision) => {
    if (decisions.length < 5) {
      setDecisions([...decisions, decision]);
    }
  };

  const handleRemoveDecision = (index: number) => {
    setDecisions(decisions.filter((_, i) => i !== index));
  };

  const handleReset = () => {
    setDecisions([]);
    setActiveEvents([]);
  };

  const handleLoadPreset = (preset: SelectedDecision[]) => {
    setDecisions(preset);
  };

  const handleToggleEvent = (event: CityEvent) => {
    setActiveEvents((prev) =>
      prev.some((e) => e.id === event.id)
        ? prev.filter((e) => e.id !== event.id)
        : [...prev, event]
    );
  };

  const handleApplySwap = (swap: RecommendationSwap) => {
    const nextDecisions = decisions.filter((d) => d.measureId !== swap.removeMeasureId);
    nextDecisions.push(swap.addDecision);
    setDecisions(nextDecisions);
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 20px 60px' }}>
      
      {/* 1. Header with shift timer and actions */}
      <Header
        onLoadPreset={handleLoadPreset}
        onReset={handleReset}
        onOpenCompare={() => setIsCompareOpen(true)}
        onOpenCrisis={() => setIsCrisisOpen(true)}
        onOpenPresentation={() => setIsPresentationOpen(true)}
        crisisActive={activeEvents.length > 0}
      />

      {/* 2. Hero Score Dashboard */}
      <ScoreDashboard simulation={simulation} />

      {/* 3. Budget and Decisions Slots Control Bar */}
      <BudgetBar
        validation={simulation.validation}
        decisions={decisions}
        onRemoveDecision={handleRemoveDecision}
      />

      {/* 4. AI Optimizer recommendations */}
      <OptimizerCard
        simulation={simulation}
        decisions={decisions}
        onApplySwap={handleApplySwap}
      />

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
            decisions={decisions}
            onAddDecision={handleAddDecision}
            onRemoveDecision={handleRemoveDecision}
            remainingBudget={simulation.validation.remainingBudget}
          />
        </div>

        {/* Right Column: Map, Indicators, and Agentic AI (7 cols on wide screens) */}
        <div style={{ gridColumn: 'span 12', display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }} className="lg:grid-column-7">
          
          {/* Interactive District Heatmap of Astana */}
          <DistrictMap
            districts={simulation.districts}
            selectedDistrictId={selectedDistrictId}
            onSelectDistrict={(id) => setSelectedDistrictId(id)}
            decisions={decisions}
          />

          {/* Detailed 10 Indicators Before/After */}
          <RadarAnalytics
            simulation={simulation}
            selectedDistrictId={selectedDistrictId}
          />

          {/* Agentic AI Analysis & Interactive Advisor */}
          <AIInsightCard simulation={simulation} />

        </div>

      </div>

      {/* Modals for Optional Features */}
      <CompareModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        currentSim={simulation}
        onLoadScenario={handleLoadPreset}
      />

      <CrisisModal
        isOpen={isCrisisOpen}
        onClose={() => setIsCrisisOpen(false)}
        activeEvents={activeEvents}
        onToggleEvent={handleToggleEvent}
      />

      <PresentationModal
        isOpen={isPresentationOpen}
        onClose={() => setIsPresentationOpen(false)}
        simulation={simulation}
      />

    </div>
  );
};

export default App;
