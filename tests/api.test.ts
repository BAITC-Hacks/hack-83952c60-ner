import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app';
import { analyzeSimulation, createOpenAIProvider, type AnalysisProvider } from '../server/analysis';
import { buildAnalysisContext } from '../server/context';
import { runSimulation } from '../src/engine/simulator';
import { generateAIAnalysis } from '../src/ai/analyzer';
import type { SelectedDecision, ValidSimulationResult } from '../src/engine/types';

const decisions: SelectedDecision[] = [
  { measureId: 'M7', districtId: 'nura' },
  { measureId: 'M8', districtId: 'nura' },
  { measureId: 'M10', districtId: 'nura' },
  { measureId: 'M12' },
  { measureId: 'M5', districtId: 'saryarka' },
];
const simulation = runSimulation(decisions) as ValidSimulationResult;

function validProviderOutput(answer: string | null = null) {
  return {
    analysis: {
      ...generateAIAnalysis(simulation),
      executiveSummary: 'Модель объясняет данные, рассчитанные сервером.',
    },
    answer,
  };
}

describe('POST /api/analyze', () => {
  it('calculates the scenario on the server and returns validated model output', async () => {
    const provider = vi.fn<AnalysisProvider>().mockResolvedValue(JSON.stringify(validProviderOutput('Улучшение связано с социальными мерами в Нуре.')));
    const app = createApp({ apiKey: '', provider, model: 'test-model' });
    const response = await request(app).post('/api/analyze').send({ decisions, question: ' Почему вырос Score? ' });
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.source).toBe('llm');
    expect(response.body.reason).toBeUndefined();
    expect(response.body.answer).toBe('Улучшение связано с социальными мерами в Нуре.');
    expect(response.body.analysis.executiveSummary).toBe('Модель объясняет данные, рассчитанные сервером.');
    expect(response.body.simulation.finalScore).toBeCloseTo(56.54307, 6);
    expect(response.body.simulation.validation.totalCost).toBe(95);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(provider.mock.calls[0][0].question).toBe('Почему вырос Score?');
    expect(provider.mock.calls[0][1].model).toBe('test-model');
  });

  it('allows a question-free request without inventing a model answer', async () => {
    const provider = vi.fn<AnalysisProvider>().mockResolvedValue(validProviderOutput());
    const response = await request(createApp({ apiKey: '', provider })).post('/api/analyze').send({ decisions });
    expect(response.status).toBe(200);
    expect(response.body.source).toBe('llm');
    expect(response.body.answer).toBeUndefined();
  });

  it.each([
    { name: 'empty decisions', value: [] },
    { name: 'null decisions', value: null },
    { name: 'string decisions', value: 'five decisions' },
    { name: 'null item', value: [null, ...decisions.slice(1)] },
    { name: 'inherited measure ID', value: [{ measureId: 'toString', districtId: 'nura' }, ...decisions.slice(1)] },
    { name: 'inherited district ID', value: [{ measureId: 'M7', districtId: 'constructor' }, ...decisions.slice(1)] },
    { name: 'city measure with district', value: [...decisions.slice(0, 3), { measureId: 'M12', districtId: 'esil' }, decisions[4]] },
    { name: 'six decisions', value: [...decisions, { measureId: 'M11', districtId: 'esil' }] },
  ])('rejects $name before contacting the provider', async ({ value: invalidDecisions }) => {
    const provider = vi.fn<AnalysisProvider>();
    const response = await request(createApp({ apiKey: '', provider })).post('/api/analyze').send({ decisions: invalidDecisions });
    expect(response.status).toBe(422);
    expect(response.body.simulation.isValid).toBe(false);
    expect(response.body.simulation.finalScore).toBeNull();
    expect(response.body.simulation.validation.errors.length).toBeGreaterThan(0);
    expect(provider).not.toHaveBeenCalled();
  });

  it.each([
    {},
    [],
    { decisions, question: null },
    { decisions, question: '' },
    { decisions, question: '   ' },
    { decisions, question: 15 },
    { decisions, question: 'x'.repeat(2001) },
    { decisions, finalScore: 100 },
    { decisions, simulation: { finalScore: 100 } },
    { decisions, events: [] },
  ].map((body, index) => ({ body, index })))('rejects malformed envelope $index', async ({ body }) => {
    const provider = vi.fn<AnalysisProvider>();
    const response = await request(createApp({ apiKey: '', provider })).post('/api/analyze').send(body);
    expect(response.status).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON and oversized bodies without leaking implementation errors', async () => {
    const provider = vi.fn<AnalysisProvider>();
    const app = createApp({ apiKey: '', provider });
    const malformed = await request(app).post('/api/analyze').set('Content-Type', 'application/json').send('{"decisions":');
    expect(malformed.status).toBe(400);
    expect(malformed.body).toEqual({ error: 'Некорректный JSON.' });
    const oversized = await request(app).post('/api/analyze').send({ decisions, question: 'x'.repeat(17_000) });
    expect(oversized.status).toBe(413);
    expect(provider).not.toHaveBeenCalled();
  });

  it('returns an explicit rules fallback when no server key is configured', async () => {
    const response = await request(createApp({ apiKey: '' })).post('/api/analyze').send({ decisions, question: 'Что улучшить?' });
    expect(response.status).toBe(200);
    expect(response.body.source).toBe('rules');
    expect(response.body.reason).toBe('missing_key');
    expect(response.body.analysis).toEqual(JSON.parse(JSON.stringify(generateAIAnalysis(simulation))));
    expect(response.body.answer).toContain('Индивидуальный ответ модели недоступен');
  });

  it('falls back on provider failure without serializing errors or secrets', async () => {
    const provider = vi.fn<AnalysisProvider>().mockRejectedValue(new Error('secret-test-token raw upstream error'));
    const response = await request(createApp({ apiKey: '', provider })).post('/api/analyze').send({ decisions });
    expect(response.status).toBe(200);
    expect(response.body.source).toBe('rules');
    expect(response.body.reason).toBe('provider_error');
    expect(response.text).not.toContain('secret-test-token');
    expect(response.body.simulation.finalScore).toBeCloseTo(56.54307, 6);
  });

  it.each([
    'not JSON',
    null,
    { analysis: { executiveSummary: 'Incomplete' }, answer: null },
    { ...validProviderOutput(), analysis: { ...validProviderOutput().analysis, strengths: [42] } },
    { ...validProviderOutput(), analysis: { ...validProviderOutput().analysis, districtHighlights: [] } },
    { ...validProviderOutput(), analysis: { ...validProviderOutput().analysis, districtHighlights: Array(5).fill({ district: 'Нура', verdict: 'Рост' }) } },
  ])('falls back when provider returns invalid response %j', async (output) => {
    const provider = vi.fn<AnalysisProvider>().mockResolvedValue(output);
    const response = await request(createApp({ apiKey: '', provider })).post('/api/analyze').send({ decisions });
    expect(response.status).toBe(200);
    expect(response.body.source).toBe('rules');
    expect(response.body.reason).toBe('invalid_response');
  });

  it('requires a valid answer when the request includes a question', async () => {
    const provider = vi.fn<AnalysisProvider>().mockResolvedValue(validProviderOutput());
    const response = await request(createApp({ apiKey: '', provider })).post('/api/analyze').send({ decisions, question: 'Почему?' });
    expect(response.body.source).toBe('rules');
    expect(response.body.reason).toBe('invalid_response');
  });

  it('ends a hanging request at the deadline, aborts it, and discards any late result', async () => {
    let resolveProvider!: (value: unknown) => void;
    let observedSignal: AbortSignal | undefined;
    const provider: AnalysisProvider = (_context, { signal }) => {
      observedSignal = signal;
      return new Promise((resolve) => { resolveProvider = resolve; });
    };
    const response = await request(createApp({ apiKey: '', provider, timeoutMs: 5 })).post('/api/analyze').send({ decisions });
    expect(response.status).toBe(200);
    expect(response.body.source).toBe('rules');
    expect(response.body.reason).toBe('timeout');
    expect(observedSignal?.aborted).toBe(true);
    resolveProvider(validProviderOutput());
    await Promise.resolve();
    expect(response.body.source).toBe('rules');
  });

  it('keeps concurrent scenario responses tied to their own server calculations', async () => {
    let finishFirst!: (value: unknown) => void;
    const changed = decisions.map((decision) => decision.measureId === 'M5' ? { ...decision, districtId: 'esil' as const } : decision);
    const changedSimulation = runSimulation(changed) as ValidSimulationResult;
    const provider: AnalysisProvider = (context) => context.decisions[4].districtId === 'saryarka'
      ? new Promise((resolve) => { finishFirst = resolve; })
      : Promise.resolve(validProviderOutput());
    const first = analyzeSimulation(simulation, { provider, model: 'test-model' });
    const second = await analyzeSimulation(changedSimulation, { provider, model: 'test-model' });
    finishFirst(validProviderOutput());
    const firstResponse = await first;
    expect(second.simulation.decisions[4].districtId).toBe('esil');
    expect(firstResponse.simulation.decisions[4].districtId).toBe('saryarka');
    expect(firstResponse.simulation.finalScore).not.toBe(second.simulation.finalScore);
  });
});

describe('server-owned model context', () => {
  it('includes effects, lag, synergy scope, metrics and the exact score decomposition', () => {
    const context = buildAnalysisContext(simulation);
    const school = context.decisions.find((decision) => decision.measureId === 'M7')!;
    expect(school.lagQuarters).toBe(3);
    expect(school.lagFactor).toBe(0.625);
    expect(school.rawEffects).toEqual({ S1: 16 });
    expect(school.realizedEffectsBeforeClipping).toEqual({ S1: 10 });
    const cityMeasure = context.decisions.find((decision) => decision.measureId === 'M12')!;
    expect(cityMeasure.targetDistricts).toHaveLength(5);
    expect(context.synergies).toEqual([expect.objectContaining({ measures: ['M10', 'M12'], targetDistricts: ['nura'], fixedBonus: { B1: 2 } })]);
    expect(context.criticalIndicatorsBefore).toHaveLength(2);
    expect(context.criticalIndicatorsAfter).toHaveLength(0);
    expect(context.districts.find((district) => district.districtId === 'nura')?.indicatorDeltas.S1).toBe(10);
    expect(context.budget).toMatchObject({ available: 100, spent: 95, remaining: 5 });
    expect(context.catalog.measures).toHaveLength(14);
    expect(context.catalog.incompatibilities).toContainEqual(expect.objectContaining({ measures: ['M1', 'M3'], scope: 'any_district' }));
    expect(context.catalog.synergies).toHaveLength(3);
    const parts = context.score.decompositionAfter;
    expect(parts.cityAverageContribution + parts.minimumDistrictContribution + parts.criticalPenalty).toBe(simulation.finalScore);
  });

  it('includes negative effects without erasing the transport tradeoff', () => {
    const negative = runSimulation([
      { measureId: 'M9', districtId: 'nura' },
      { measureId: 'M11', districtId: 'almaty' },
      { measureId: 'M10', districtId: 'saryarka' },
      { measureId: 'M12' },
      { measureId: 'M4', districtId: 'esil' },
    ]) as ValidSimulationResult;
    const context = buildAnalysisContext(negative);
    expect(context.decisions.find((decision) => decision.measureId === 'M11')?.realizedEffectsBeforeClipping.T1).toBe(-1.75);
  });
});

describe('server status', () => {
  it('reports only provider availability and does not disclose configuration values', async () => {
    const app = createApp({ apiKey: '', provider: vi.fn<AnalysisProvider>(), model: 'private-model-name' });
    const response = await request(app).get('/api/health');
    expect(response.body).toEqual({ status: 'ok', llmConfigured: true });
    const unconfigured = await request(createApp({ apiKey: '' })).get('/api/health');
    expect(unconfigured.body.llmConfigured).toBe(false);
    const missing = await request(app).get('/api/missing');
    expect(missing.status).toBe(404);
    expect(missing.type).toBe('application/json');
  });
});

describe('Responses API output contract', () => {
  it.each([
    { name: 'requires an answer to a question', question: 'Почему вырос Score?', answer: 'Социальные меры улучшили показатели Нуры.' },
    { name: 'requires null when no question was asked', question: undefined, answer: null },
  ])('$name', async ({ question, answer }) => {
    let outgoing: Record<string, any> | undefined;
    const mockedFetch = vi.fn(async (_input: unknown, init?: RequestInit) => {
      outgoing = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({
        id: 'resp_test', object: 'response', status: 'completed',
        output: [{ type: 'message', role: 'assistant', status: 'completed', content: [
          { type: 'output_text', text: JSON.stringify(validProviderOutput(answer)), annotations: [] },
        ] }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', mockedFetch);
    try {
      const provider = createOpenAIProvider('test-key');
      const result = await analyzeSimulation(simulation, { provider, model: 'gpt-4o-mini', question });
      expect(mockedFetch).toHaveBeenCalledTimes(1);
      expect(outgoing?.text.format.type).toBe('json_schema');
      expect(outgoing?.text.format.strict).toBe(true);
      const answerSchema = outgoing?.text.format.schema.properties.answer;
      if (question) {
        // Regression: the former static schema allowed null, and the live model used it.
        expect(answerSchema.type).toBe('string');
        expect(answerSchema.pattern).toBe('\\S');
        expect(result.answer).toBe(answer);
      } else {
        expect(answerSchema.type).toBe('null');
        expect(result.answer).toBeUndefined();
      }
      expect(result.source).toBe('llm');
    } finally { vi.unstubAllGlobals(); }
  });
});
