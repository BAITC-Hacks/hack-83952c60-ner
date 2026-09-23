/** Shared application screen; the standalone example mounts the same component. */
import { useMemo, useState } from 'react';
import { PopulationPanel } from './PopulationPanel';
import { createPopulationSnapshot } from './simulation';
import { calculateCityPulse } from './pulse';
import type { SwarmDiagnostics } from './ParticleSwarm';
import type { AkimDecision } from './types';

const decision: AkimDecision = {
  id: 'nura-schools-demo', topic: 'schools', districtIds: ['nura'],
  summary: 'Добавить школьные места в Нуре, сократив поездки семей в другие районы.', effect: 'improve',
};

export default function PopulationScreen() {
  const [hour, setHour] = useState(8);
  const [scenario, setScenario] = useState('baseline');
  const [diagnostics, setDiagnostics] = useState<SwarmDiagnostics | null>(null);
  const snapshot = useMemo(() => {
    const base = createPopulationSnapshot({ hour });
    if (scenario === 'baseline') return base;
    const crisis = scenario === 'crisis';
    const districts = base.districts.map(d => ({ ...d,
      schoolPlaces: crisis ? d.schoolDemand * .4 : d.schoolDemand,
      heatSupplyC: d.heatTargetC - (crisis ? 30 : 0),
    }));
    const trafficLoad = {
      bridges: base.trafficLoad.bridges.map(b => ({ ...b, loadRatio: crisis ? 1.9 : .65, delayMinutes: crisis ? 50 : 0 })),
      districtLoad: Object.fromEntries(base.districts.map(d => [d.id, crisis ? 1.6 : .8])),
    };
    return { ...base, districts, trafficLoad, pulse: calculateCityPulse(base.agents, { hour, districts, trafficLoad }) };
  }, [hour, scenario]);

  return <main className="population-screen">
    <h1>Пульс города</h1>
    <p className="population-screen-intro">1 550 000 жителей, городские потоки и голоса районов.</p>
    <div className="population-controls">
      <label>Время <input aria-label="Час симуляции" type="range" min="0" max="23" value={hour} onChange={event => setHour(Number(event.target.value))} /><output>{hour}:00</output></label>
      <label>Инфраструктура <select aria-label="Сценарий инфраструктуры" value={scenario} onChange={event => setScenario(event.target.value)}>
        <option value="baseline">Исходная нагрузка</option><option value="calm">Достаточная мощность</option><option value="crisis">Перегрузка и мороз</option>
      </select></label>
    </div>
    <PopulationPanel snapshot={snapshot} selectedDistrict="nura" decision={decision} onDiagnostics={setDiagnostics} />
    <p className="population-diagnostics" aria-label="Диагностика роя">{diagnostics
      ? `${diagnostics.particles} частиц · ${diagnostics.fps} FPS · ${diagnostics.frameCostMs} мс/кадр CPU · DPR ${diagnostics.dpr} · в заторе ${diagnostics.congestedParticles}`
      : 'Измерение времени кадра…'}</p>
  </main>;
}
