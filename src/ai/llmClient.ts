import type { AIAnalysis, SelectedDecision, ValidSimulationResult } from '../engine/types';

export interface AnalysisResponse {
  simulation: ValidSimulationResult;
  analysis: AIAnalysis;
  answer?: string;
  source: 'llm' | 'rules';
  reason?: 'missing_key' | 'timeout' | 'provider_error' | 'invalid_response';
}

export class AnalysisRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function requestScenarioAnalysis(
  decisions: SelectedDecision[],
  question?: string,
  signal?: AbortSignal,
): Promise<AnalysisResponse> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decisions, ...(question ? { question } : {}) }),
    signal,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new AnalysisRequestError(
      typeof body.error === 'string' ? body.error : `Сервер анализа вернул ошибку ${response.status}.`,
      response.status,
    );
  }
  const body = await response.json() as AnalysisResponse;
  if (!body.simulation?.isValid || !body.analysis || !['llm', 'rules'].includes(body.source)) {
    throw new Error('Сервер вернул некорректный ответ анализа.');
  }
  return body;
}
