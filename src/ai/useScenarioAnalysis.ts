import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SimulationResult } from '../engine/types';
import { generateAIAnalysis } from './analyzer';
import { AnalysisRequestError, requestScenarioAnalysis, type AnalysisResponse } from './llmClient';

type DisplayedAnalysis = AnalysisResponse & { notice?: string };

/** Every committed change invalidates the request, including A → B → A. */
export function useScenarioAnalysis(simulation: SimulationResult, scenarioRevision: number) {
  const [result, setResult] = useState<DisplayedAnalysis | null>(null);
  const [resultRevision, setResultRevision] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const currentRevision = useRef(scenarioRevision);

  useLayoutEffect(() => {
    currentRevision.current = scenarioRevision;
    generation.current += 1;
    controller.current?.abort();
    setIsLoading(false);
    setError(null);
  }, [scenarioRevision]);

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
      const response = await requestScenarioAnalysis(simulation.decisions, question?.trim() || undefined, requestController.signal);
      if (!isCurrent()) return;
      setResult(response);
      setResultRevision(requestRevision);
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
      setResultRevision(requestRevision);
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [simulation, scenarioRevision]);

  return { result, isStale: result !== null && resultRevision !== scenarioRevision, isLoading, error, analyze };
}
