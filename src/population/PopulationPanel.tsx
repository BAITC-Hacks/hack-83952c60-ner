import { useEffect, useRef, useState } from 'react';
import { PopulationCanvas } from './PopulationCanvas';
import { requestCitizenThoughts } from './client';
import type { PopulationSnapshot } from './simulation';
import type { AkimDecision, CitizenThought, DistrictId } from './types';
import './population.css';
import type { SwarmDiagnostics } from './ParticleSwarm';

export interface PopulationPanelProps {
  snapshot: PopulationSnapshot;
  selectedDistrict: DistrictId;
  /** Explicit game event, not free text inferred by the LLM. */
  decision?: AkimDecision;
  onDiagnostics?: (diagnostics: SwarmDiagnostics) => void;
}

/** Embed in an existing React screen. Parent updates snapshot at ~1 Hz, canvas owns RAF. */
export function PopulationPanel({ snapshot, selectedDistrict, decision, onDiagnostics }: PopulationPanelProps) {
  const [thoughts, setThoughts] = useState<CitizenThought[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const decisionKey = JSON.stringify(decision);
  useEffect(() => {
    request.current?.abort();
    setThoughts([]);
    setError('');
    setBusy(false);
    return () => request.current?.abort();
  }, [decisionKey, selectedDistrict]);

  const generate = async () => {
    if (!decision || busy) return;
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setBusy(true);
    setError('');
    try {
      const result = await requestCitizenThoughts(decision, { selectedDistrict, signal: controller.signal });
      if (!controller.signal.aborted) setThoughts(result);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Сервис мнений недоступен.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return <section className="population-panel" aria-label="Пульс города и мысли жителей">
    <div className="population-heading">
      <div><h2>Пульс города</h2><p>{snapshot.population.toLocaleString('ru-RU')} жителей · {snapshot.visualParticles.toLocaleString('ru-RU')} потоков · 1:1000</p></div>
      <div className={`population-pulse population-pulse--${snapshot.pulse.color}${snapshot.pulse.pulsing ? ' population-pulse--alert' : ''}`} role="status">
        <strong>{snapshot.pulse.stressIndex}%</strong><span>{snapshot.pulse.status}</span>
      </div>
    </div>
    <p className="population-state">{snapshot.pulse.state} · {String(Math.floor(snapshot.hour)).padStart(2, '0')}:{String(Math.floor(snapshot.hour % 1 * 60)).padStart(2, '0')}</p>
    <PopulationCanvas flows={snapshot.flows} trafficLoad={snapshot.trafficLoad} onDiagnostics={onDiagnostics} style={{ width: '100%', height: 'clamp(300px, 48vw, 520px)' }} />
    <ul className="population-legend" aria-label="Виды потоков">
      <li><i style={{ background: '#fbbf24' }} />Личный транспорт</li>
      <li><i style={{ background: '#22d3ee' }} />Автобусы</li>
      <li><i style={{ background: '#c084fc' }} />Родители с детьми</li>
      <li><i style={{ background: '#ef4444' }} />Затор</li>
    </ul>
    <p className="population-note">Схематическая игровая модель. Частицы показывают распределение потоков; не все жители едут одновременно.</p>
    <div className="population-table-wrap"><table className="population-table">
      <thead><tr><th scope="col">Район</th><th scope="col">Жителей</th><th scope="col">Стресс инфраструктуры</th><th scope="col">Стресс когорты</th></tr></thead>
      <tbody>{snapshot.pulse.districts.map(row => <tr key={row.districtId}>
        <th scope="row">{snapshot.districts.find(d => d.id === row.districtId)?.name}</th>
        <td>{row.population.toLocaleString('ru-RU')}</td><td>{row.infrastructureStress.toFixed(1)}%</td>
        <td>{row.averageStress === null ? 'Нет выборки' : `${row.averageStress.toFixed(1)}%`}</td>
      </tr>)}</tbody>
    </table></div>
    <div className="population-heading">
      <h3>Голоса жителей</h3>
      <button type="button" onClick={generate} disabled={!decision || busy}>{busy ? 'Жители отвечают…' : 'Узнать реакцию на решение'}</button>
    </div>
    {error && <p role="alert">{error}</p>}
    <div className="population-voices" aria-live="polite">
      {thoughts.map(thought => {
        const agent = snapshot.agents.find(item => item.id === thought.agentId);
        return <blockquote key={thought.agentId}><p>«{thought.quote}»</p>
          <footer>{agent?.name ?? thought.agentId} · {agent?.profession ?? 'житель'} · {thought.source === 'llm' ? 'AI-персонаж' : 'реплика по правилам'}</footer>
        </blockquote>;
      })}
      {!busy && !error && !thoughts.length && <p className="population-note">Реакции виртуальных жителей появятся по запросу, если решение затрагивает выбранную фокус-группу.</p>}
    </div>
  </section>;
}
