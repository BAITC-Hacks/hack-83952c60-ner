import type { AkimDecision, CitizenThought, DistrictId } from './types';

/** Browser transport. The API key and system prompt remain in the Node service. */
export async function requestCitizenThoughts(
  decision: AkimDecision,
  options: { selectedDistrict?: DistrictId; mode?: 'focus' | 'cohort'; signal?: AbortSignal } = {},
): Promise<CitizenThought[]> {
  const response = await fetch('/api/population/voices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, mode: options.mode ?? 'focus', selectedDistrict: options.selectedDistrict }),
    signal: options.signal,
  });
  if (!response.ok) throw new Error(`Не удалось получить мысли жителей (${response.status}).`);
  const data: unknown = await response.json();
  if (typeof data !== 'object' || data === null || !('thoughts' in data) || !Array.isArray(data.thoughts)
    || data.thoughts.length > 5 || data.thoughts.some(item => typeof item !== 'object' || item === null
      || typeof item.agentId !== 'string' || typeof item.quote !== 'string'
      || item.quote.length > 300 || !['llm', 'rules'].includes(item.source))) {
    throw new Error('Некорректный ответ сервиса мнений.');
  }
  return data.thoughts as CitizenThought[];
}
