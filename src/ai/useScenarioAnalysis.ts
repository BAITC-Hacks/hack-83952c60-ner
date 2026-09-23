import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SimulationResult } from '../engine/types';
import { generateAIAnalysis } from './analyzer';
import { AnalysisRequestError, requestScenarioAnalysis, type AnalysisResponse } from './llmClient';

type DisplayedAnalysis = AnalysisResponse & { notice?: string; stale?: boolean };

/** Every committed change invalidates the request, including A → B → A. */
export function useScenarioAnalysis(simulation: SimulationResult, scenarioRevision: number, year?: 1 | 2 | 3) {
  const [result, setResult] = useState<DisplayedAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const currentRevision = useRef(scenarioRevision);

  useLayoutEffect(() => {
    currentRevision.current = scenarioRevision;
    generation.current += 1;
    controller.current?.abort();
    setResult((previous) => previous ? { ...previous, stale: true } : previous);
    setIsLoading(false);
    setError(null);
  }, [scenarioRevision, year]);

  useEffect(() => () => {
    generation.current += 1;
    controller.current?.abort();
  }, []);

  const analyze = useCallback(async (question?: string) => {
    if (!simulation.isValid) return;
    controller.current?.abort();
    const requestController = new AbortController();
    controller.current = requestController;
    const requestGeneration = ++generation.current;
    const requestRevision = scenarioRevision;
    const isCurrent = () => generation.current === requestGeneration &&
      currentRevision.current === requestRevision && !requestController.signal.aborted;
    setIsLoading(true);
    setError(null);
    try {
      const response = await requestScenarioAnalysis(simulation.decisions, question?.trim() || undefined, requestController.signal, year);
      if (!isCurrent()) return;
      setResult(response);
    } catch (cause) {
      if (!isCurrent()) return;
      if (cause instanceof AnalysisRequestError && cause.status < 500) {
        setError(cause.message);
        return;
      }
      setResult({
        simulation,
        analysis: generateAIAnalysis(simulation),
        source: 'rules',
        notice: 'Сервер анализа недоступен. Показано локальное объяснение по правилам; ответ LLM не получен.',
        ...(question?.trim() ? { answer: 'Ответ на вопрос недоступен без сервера. Ниже — общий анализ текущего сценария по правилам.' } : {}),
      });
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [simulation, scenarioRevision, year]);

  return { result, isStale: result?.stale === true, isLoading, error, analyze };
}
