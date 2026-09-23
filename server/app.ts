import express, { type ErrorRequestHandler } from 'express';
import { resolve } from 'node:path';
import { runSimulationAtQuarter } from '../src/engine/simulator';
import { analyzeSimulation, createOpenAIProvider, type AnalysisProvider } from './analysis';
import { createCitizenVoiceService, parseAkimDecision, type CitizenVoiceProvider } from './citizenVoices';
import { generateAgents } from '../src/population/agents';
import { DISTRICT_IDS } from '../src/population/data';
import type { DistrictId } from '../src/population/types';

export interface AppOptions {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  provider?: AnalysisProvider;
  timeoutMs?: number;
  frontendDirectory?: string;
  citizenApiKey?: string;
  citizenModel?: string;
  citizenProvider?: CitizenVoiceProvider;
}

export function createApp(options: AppOptions = {}) {
  const apiKey = (options.apiKey ?? process.env.OPENAI_API_KEY ?? process.env.NVIDIA_API_KEY ?? process.env.BREV_API_KEY ?? '').trim();
  const baseURL = (options.baseURL ?? process.env.OPENAI_BASE_URL ?? process.env.NVIDIA_BASE_URL ?? process.env.BREV_BASE_URL)?.trim() || undefined;
  const model = options.model ?? (process.env.OPENAI_MODEL?.trim() || process.env.NVIDIA_MODEL?.trim() || 'gpt-4o-mini');
  const provider = options.provider ?? (apiKey ? createOpenAIProvider(apiKey, baseURL) : undefined);
  // Voices are an independent OpenAI integration. Never send NVIDIA/Brev credentials to OpenAI.
  const voices = createCitizenVoiceService({
    apiKey: options.citizenApiKey ?? (process.env.CITIZEN_OPENAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || ''),
    model: options.citizenModel ?? (process.env.CITIZEN_MODEL?.trim() || 'gpt-4.1-mini'),
    provider: options.citizenProvider,
  });
  const citizens = generateAgents(42);
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', express.json({ limit: '16kb', strict: true }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', llmConfigured: Boolean(provider) });
  });

  app.post('/api/population/voices', async (req, res, next) => {
    try {
      const body: unknown = req.body;
      if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        res.status(400).json({ error: 'Ожидается объект с решением акима.' });
        return;
      }
      const input = body as Record<string, unknown>;
      const decision = parseAkimDecision(input.decision);
      if (!decision || Object.keys(input).some(key => !['decision', 'mode', 'selectedDistrict'].includes(key))
        || (input.mode !== undefined && input.mode !== 'focus' && input.mode !== 'cohort')
        || (input.selectedDistrict !== undefined && !DISTRICT_IDS.includes(input.selectedDistrict as DistrictId))) {
        res.status(400).json({ error: 'Проверьте decision, mode (focus/cohort) и selectedDistrict.' });
        return;
      }
      const selectedDistrict = (input.selectedDistrict ?? decision.districtIds[0]) as DistrictId | undefined;
      if (input.mode !== 'cohort' && !selectedDistrict) {
        res.status(400).json({ error: 'Для фокус-группы укажите selectedDistrict.' });
        return;
      }
      const thoughts = input.mode === 'cohort'
        ? await voices.generateCitizenThoughts(citizens, decision)
        : await voices.generateVoiceOfCitizens(selectedDistrict!, decision);
      res.json({ thoughts });
    } catch (error) { next(error); }
  });

  app.post('/api/analyze', async (req, res, next) => {
    try {
      const body: unknown = req.body;
      if (typeof body !== 'object' || body === null || Array.isArray(body)
        || !Object.hasOwn(body, 'decisions')) {
        res.status(400).json({ error: 'Ожидается JSON-объект с полем decisions.' });
        return;
      }
      const input = body as Record<string, unknown>;
      if (Object.keys(input).some((key) => key !== 'decisions' && key !== 'question' && key !== 'year')) {
        res.status(400).json({ error: 'Разрешены только поля decisions, question и year. Результаты рассчитывает сервер.' });
        return;
      }
      if (input.year !== undefined && input.year !== 1 && input.year !== 2 && input.year !== 3) {
        res.status(400).json({ error: 'Год анализа должен быть числом 1, 2 или 3.' });
        return;
      }
      if (input.question !== undefined && (typeof input.question !== 'string'
        || input.question.trim().length === 0 || input.question.length > 2000)) {
        res.status(400).json({ error: 'Вопрос должен быть непустой строкой длиной до 2000 символов.' });
        return;
      }
      const simulation = runSimulationAtQuarter(input.decisions, ((input.year ?? 2) as number) * 4);
      if (!simulation.isValid) {
        res.status(422).json({ error: 'Сценарий нарушает правила симулятора.', simulation });
        return;
      }
      const question = typeof input.question === 'string' ? input.question.trim() : undefined;
      res.json(await analyzeSimulation(simulation, { provider, model, timeoutMs: options.timeoutMs, question }));
    } catch (error) { next(error); }
  });

  app.use('/api', (_req, res) => { res.status(404).json({ error: 'API-маршрут не найден.' }); });
  if (options.frontendDirectory) {
    const frontendDirectory = resolve(options.frontendDirectory);
    app.use(express.static(frontendDirectory));
    app.get(/.*/, (req, res, next) => {
      if (!req.accepts('html')) { next(); return; }
      res.sendFile(resolve(frontendDirectory, 'index.html'));
    });
  }
  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (res.headersSent) return;
    if (error?.type === 'entity.too.large') {
      res.status(413).json({ error: 'Слишком большой запрос. Лимит тела — 16 КБ.' });
    } else if (error?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Некорректный JSON.' });
    } else {
      // Provider exceptions and secrets are never serialized or logged.
      res.status(500).json({ error: 'Не удалось обработать запрос.' });
    }
  };
  app.use(handleError);
  return app;
}
