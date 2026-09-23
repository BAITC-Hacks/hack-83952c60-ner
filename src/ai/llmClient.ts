import { SimulationResult } from '../engine/types';
import { generateAIAnalysis } from './analyzer';

export interface LLMConfig {
  apiKey?: string;
  provider: 'gemini' | 'openai' | 'local';
}

export async function askAICityAdvisor(
  sim: SimulationResult,
  userQuestion: string,
  config: LLMConfig
): Promise<string> {
  const localAnalysis = generateAIAnalysis(sim);

  if (config.provider === 'local' || !config.apiKey) {
    // High-quality local agent response
    const qLower = userQuestion.toLowerCase();
    if (qLower.includes('нур') || qLower.includes('аутсайдер')) {
      return `В районе Нура на старте симуляции два критических показателя: Школы (S1: 38) и Поликлиники (S2: 35). Формула Astana Quality of Life Score наказывает город штрафом -1.0 за каждый показатель ниже 40 баллов, а также выделяет 30% веса минимальному районному баллу. Чтобы поднять общий Score мегаполиса, первоочередной задачей Акима является направление мер M7 (Школа + детсад) и M8 (Поликлиника) именно в район Нура.`;
    }
    if (qLower.includes('бюджет') || qLower.includes('деньги') || qLower.includes('остаток')) {
      return `Бюджет симулятора строго фиксирован на уровне 100 у.е. В вашем текущем сценарии израсходовано ${sim.validation.totalCost} у.е., доступный остаток составляет ${sim.validation.remainingBudget} у.е. Правило хакатона гласит: остаток не сгорает, но и не дает дополнительного бонуса. Поэтому рационально использовать бюджет по максимуму на быстродействующие инициативы.`;
    }
    if (qLower.includes('синерги') || qLower.includes('бонус')) {
      return `В модели заложены 3 мощные синергии:
1. M1 (Автобусные полосы) + M2 (Умные светофоры) = бонус +2 к T1 в районе автобусных полос.
2. M10 (Safe City камеры) + M12 (Платформа обращений iKomek) = бонус +2 к безопасности B1 в районе камер.
3. M5 (Чистое топливо/газ) + M6 (Зеленый пояс столицы) = бонус +2 к чистоте воздуха E2 в газифицированном районе.
Эти бонусы не урезаются фактором лага и начисляются в полном объеме!`;
    }

    return `Господин Аким, по итогам анализа вашего текущего сценария:
• Итоговый Astana Quality of Life Score: ${sim.finalScore.toFixed(2)} (динамика к базе: +${sim.scoreDelta.toFixed(2)}).
• Слабейший район: ${sim.weakestDistrictId.toUpperCase()} с баллом ${sim.finalMinDistrictScore.toFixed(2)}.
• Критических дефицитов (<40): ${sim.finalCritCount}.
${localAnalysis.executiveSummary}

Рекомендация AI-советника:
${localAnalysis.actionableRecommendations.join('\n')}`;
  }

  // If live OpenAI or Gemini key is provided
  if (config.provider === 'openai' && config.apiKey) {
    try {
      const prompt = `Ты — главный AI-советник Акима города Астаны в симуляторе городского развития «Аким на 5 часов».
Контекст текущего сценария:
- Astana Quality of Life Score: ${sim.finalScore.toFixed(2)} (базовый 52.56, дельта: +${sim.scoreDelta.toFixed(2)})
- Средний балл по городу D_avg: ${sim.finalCityAverage.toFixed(2)}
- Слабейший район: ${sim.weakestDistrictId} (${sim.finalMinDistrictScore.toFixed(2)})
- Число критических провалов (<40): ${sim.finalCritCount}
- Бюджет: потрачено ${sim.validation.totalCost} из 100 у.е.
- Активные синергии: ${sim.activeSynergies.join('; ') || 'нет'}
Вопрос Акима: "${userQuestion}"
Ответь кратко, профессионально, государственным языком городского управления, с упором на городские компромиссы.`;

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
      return `[Ошибка вызова внешнего API: ${err.message}]. Переключение на встроенного AI-аналитика:\n\n${localAnalysis.executiveSummary}`;
    }
  }

  return localAnalysis.executiveSummary;
}
