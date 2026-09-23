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
  year?: 1 | 2 | 3,
): Promise<AnalysisResponse> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decisions, ...(question ? { question } : {}), ...(year !== undefined ? { year } : {}) }),
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

import { getLanguage, Language, translate } from '../i18n';
import { DISTRICTS } from '../data/districts';
import { SimulationResult } from '../engine/types';
import { generateAIAnalysis } from './analyzer';

export interface LLMConfig {
  language?: Language;
  apiKey?: string;
  provider: 'gemini' | 'openai' | 'local';
}

export async function askAICityAdvisor(
  sim: SimulationResult,
  userQuestion: string,
  config: LLMConfig
): Promise<string> {
  const language = config.language ?? getLanguage();
  const t = (source: string, params: readonly unknown[] = []) => translate(source, language, params);
  const localAnalysis = generateAIAnalysis(sim, language);
  if (!sim.isValid) return localAnalysis.executiveSummary;

  if (config.provider === 'local' || !config.apiKey) {
    // High-quality local agent response
    const qLower = userQuestion.toLowerCase();
    if (/нур|нұр|nura|аутсайдер|weakest/.test(qLower)) {
      return t("В районе Нура на старте симуляции два критических показателя: Школы (S1: 38) и Поликлиники (S2: 35). Формула Astana Quality of Life Score наказывает город штрафом -1.0 за каждый показатель ниже 40 баллов, а также выделяет 30% веса минимальному районному баллу. Чтобы поднять общий Score мегаполиса, первоочередной задачей Акима является направление мер M7 (Школа + детсад) и M8 (Поликлиника) именно в район Нура.");
    }
    if (/бюджет|деньги|остаток|budget|money|remaining|қалдық|қаражат/.test(qLower)) {
      return t("Бюджет симулятора строго фиксирован на уровне 100 у.е. В вашем текущем сценарии израсходовано {0} у.е., доступный остаток составляет {1} у.е. Правило хакатона гласит: остаток не сгорает, но и не дает дополнительного бонуса. Поэтому рационально использовать бюджет по максимуму на быстродействующие инициативы.", [sim.validation.totalCost, sim.validation.remainingBudget]);
    }
    if (/синерги|бонус|synerg|bonus/.test(qLower)) {
      return t("В модели заложены 3 мощные синергии:\n1. M1 (Автобусные полосы) + M2 (Умные светофоры) = бонус +2 к T1 в районе автобусных полос.\n2. M10 (Safe City камеры) + M12 (Платформа обращений iKomek) = бонус +2 к безопасности B1 в районе камер.\n3. M5 (Чистое топливо/газ) + M6 (Зеленый пояс столицы) = бонус +2 к чистоте воздуха E2 в газифицированном районе.\nЭти бонусы не урезаются фактором лага и начисляются в полном объеме!");
    }

    return t("Господин Аким, по итогам анализа вашего текущего сценария:\n• Итоговый Astana Quality of Life Score: {0} (динамика к базе: +{1}).\n• Слабейший район: {2} с баллом {3}.\n• Критических дефицитов (<40): {4}.\n{5}\n\nРекомендация AI-советника:\n{6}", [sim.finalScore.toFixed(2), sim.scoreDelta.toFixed(2), DISTRICTS[sim.weakestDistrictId].nameRu, sim.finalMinDistrictScore.toFixed(2), sim.finalCritCount, localAnalysis.executiveSummary, localAnalysis.actionableRecommendations.join('\n')]);
  }

  // If live OpenAI or Gemini key is provided
  if (config.provider === 'openai' && config.apiKey) {
    try {
      const prompt = t("Ты — главный AI-советник Акима города Астаны в симуляторе городского развития «Аким на 5 часов».\nКонтекст текущего сценария:\n- Astana Quality of Life Score: {0} (базовый 52.56, дельта: +{1})\n- Средний балл по городу D_avg: {2}\n- Слабейший район: {3} ({4})\n- Число критических провалов (<40): {5}\n- Бюджет: потрачено {6} из 100 у.е.\n- Активные синергии: {7}\nВопрос Акима: \"{8}\"\nОтветь кратко, профессионально, государственным языком городского управления, с упором на городские компромиссы.", [sim.finalScore.toFixed(2), sim.scoreDelta.toFixed(2), sim.finalCityAverage.toFixed(2), sim.weakestDistrictId, sim.finalMinDistrictScore.toFixed(2), sim.finalCritCount, sim.validation.totalCost, sim.activeSynergies.map(value => t(value)).join('; ') || t('нет'), userQuestion]);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      const data = await response.json();
      return data.choices[0]?.message?.content || localAnalysis.executiveSummary;
    } catch (err: any) {
      return t("[Ошибка вызова внешнего API: {0}]. Переключение на встроенного AI-аналитика:\n\n{1}", [err.message, localAnalysis.executiveSummary]);
    }
  }

  return localAnalysis.executiveSummary;
}
