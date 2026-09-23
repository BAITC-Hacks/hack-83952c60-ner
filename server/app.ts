import express, { type ErrorRequestHandler } from 'express';
import { resolve } from 'node:path';
import { runSimulation } from '../src/engine/simulator';
import { analyzeSimulation, createOpenAIProvider, type AnalysisProvider } from './analysis';

export interface AppOptions {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  provider?: AnalysisProvider;
  timeoutMs?: number;
  frontendDirectory?: string;
}

export function createApp(options: AppOptions = {}) {
  const apiKey = (options.apiKey ?? process.env.OPENAI_API_KEY ?? process.env.NVIDIA_API_KEY ?? process.env.BREV_API_KEY ?? '').trim();
  const baseURL = (options.baseURL ?? process.env.OPENAI_BASE_URL ?? process.env.NVIDIA_BASE_URL ?? process.env.BREV_BASE_URL)?.trim() || undefined;
  const model = options.model ?? (process.env.OPENAI_MODEL?.trim() || process.env.NVIDIA_MODEL?.trim() || 'gpt-4o-mini');
  const provider = options.provider ?? (apiKey ? createOpenAIProvider(apiKey, baseURL) : undefined);
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

  app.post('/api/analyze', async (req, res, next) => {
    try {
      const body: unknown = req.body;
      if (typeof body !== 'object' || body === null || Array.isArray(body)
        || !Object.hasOwn(body, 'decisions')) {
        res.status(400).json({ error: 'Ожидается JSON-объект с полем decisions.' });
        return;
      }
      const input = body as Record<string, unknown>;
      if (Object.keys(input).some((key) => key !== 'decisions' && key !== 'question')) {
        res.status(400).json({ error: 'Разрешены только поля decisions и question. Результаты рассчитывает сервер.' });
        return;
      }
      if (input.question !== undefined && (typeof input.question !== 'string'
        || input.question.trim().length === 0 || input.question.length > 2000)) {
        res.status(400).json({ error: 'Вопрос должен быть непустой строкой длиной до 2000 символов.' });
        return;
      }
      const simulation = runSimulation(input.decisions);
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
