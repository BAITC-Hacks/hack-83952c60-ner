import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app';
import { analyzeSimulation, createOpenAIProvider, type AnalysisProvider } from '../server/analysis';
import { buildAnalysisContext } from '../server/context';
import { buildAnalysisFacts } from '../server/facts';
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
const evidence = buildAnalysisFacts(simulation);

function validProviderOutput(withAnswer = false, facts = evidence) {
  return {
    summaryFactIds: facts.summaryIds.slice(0, 2),
    strengthFactIds: facts.strengthIds.slice(0, 3),
    riskFactIds: facts.riskIds.slice(0, 3),
    recommendationFactIds: facts.recommendationIds.slice(0, 3),
    answerFactIds: withAnswer ? facts.summaryIds.slice(0, 2) : [],
    answerSupported: withAnswer,
  };
}

describe('POST /api/analyze', () => {
  it('calculates the scenario on the server and returns validated model output', async () => {
    const selected = validProviderOutput(true);
    const provider = vi.fn<AnalysisProvider>().mockResolvedValue(JSON.stringify(selected));
    const app = createApp({ apiKey: '', provider, model: 'test-model' });
    const response = await request(app).post('/api/analyze').send({ decisions, question: ' Почему вырос Score? ' });
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.source).toBe('llm');
    expect(response.body.reason).toBeUndefined();
    expect(response.body.answer).toBe(selected.answerFactIds.map((id) => evidence.facts[id]).join(' '));
    expect(response.body.analysis.executiveSummary).toBe(selected.summaryFactIds.map((id) => evidence.facts[id]).join(' '));
    expect(response.body.analysis.districtHighlights).toEqual(JSON.parse(JSON.stringify(evidence.districtHighlights)));
    expect(response.body.analysis.akimatRatingVerdict).toBe(evidence.verdict);
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
    { name: 'invalid JSON', output: 'not JSON' },
    { name: 'null output', output: null },
    { name: 'old unrestricted prose', output: { analysis: { executiveSummary: 'Нура S1=0' }, answer: null } },
    { name: 'empty summary', output: { ...validProviderOutput(), summaryFactIds: [] } },
    { name: 'prototype fact ID', output: { ...validProviderOutput(), summaryFactIds: ['toString'] } },
    { name: 'invented critical warning', output: { ...validProviderOutput(), riskFactIds: ['nura.S1.below40'] } },
    { name: 'invented duplicate replacement', output: { ...validProviderOutput(), recommendationFactIds: ['replace-M8-with-M7'] } },
    { name: 'wrong value type', output: { ...validProviderOutput(), strengthFactIds: [42] } },
    { name: 'repeated summary facts', output: { ...validProviderOutput(), summaryFactIds: [evidence.summaryIds[0], evidence.summaryIds[0]] } },
    { name: 'more than three strengths', output: { ...validProviderOutput(), strengthFactIds: Array(4).fill(evidence.strengthIds[0]) } },
    { name: 'unrequested answer', output: validProviderOutput(true) },
    { name: 'freeform prose injection', output: { ...validProviderOutput(), answer: 'UNTRUSTED_MODEL_PROSE_100_POINTS' } },
  ])('falls back for $name', async ({ output }) => {
    const provider = vi.fn<AnalysisProvider>().mockResolvedValue(output);
    const response = await request(createApp({ apiKey: '', provider })).post('/api/analyze').send({ decisions });
    expect(response.status).toBe(200);
    expect(response.body.source).toBe('rules');
    expect(response.body.reason).toBe('invalid_response');
    expect(response.text).not.toContain('UNTRUSTED_MODEL_PROSE_100_POINTS');
    expect(response.body.simulation.finalScore).toBeCloseTo(56.54307, 6);
    expect(response.body.simulation.finalCritCount).toBe(0);
  });

  it('explains when the model finds no supported answer without inventing one', async () => {
    const provider = vi.fn<AnalysisProvider>().mockResolvedValue(validProviderOutput());
    const response = await request(createApp({ apiKey: '', provider })).post('/api/analyze').send({ decisions, question: 'Сколько ДТП случилось вчера?' });
    expect(response.body.source).toBe('llm');
    expect(response.body.answer).toContain('недостаточно фактов');
  });

  it.each([
    { ...validProviderOutput(), answerSupported: true },
    { ...validProviderOutput(true), answerSupported: false },
    { ...validProviderOutput(true), answerFactIds: ['constructor'] },
    { ...validProviderOutput(true), answerFactIds: [evidence.summaryIds[0], evidence.summaryIds[0]] },
  ])('rejects inconsistent or invented answer evidence %#', async (output) => {
    const provider = vi.fn<AnalysisProvider>().mockResolvedValue(output);
    const response = await request(createApp({ apiKey: '', provider })).post('/api/analyze').send({ decisions, question: 'Почему вырос Score?' });
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
      : Promise.resolve(validProviderOutput(false, context.evidence));
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
    expect(cityMeasure.targetDistricts).toHaveLength(6);
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

describe('Responses API evidence contract', () => {
  it.each([
    { name: 'permits only known answer facts for a question', question: 'Почему вырос Score?' },
    { name: 'requires an empty answer when no question was asked', question: undefined },
  ])('$name', async ({ question }) => {
    const selection = validProviderOutput(Boolean(question));
    let outgoing: Record<string, any> | undefined;
    const mockedFetch = vi.fn(async (_input: unknown, init?: RequestInit) => {
      outgoing = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({
        id: 'resp_test', object: 'response', status: 'completed',
        output: [{ type: 'message', role: 'assistant', status: 'completed', content: [
          { type: 'output_text', text: JSON.stringify(selection), annotations: [] },
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
      const schema = outgoing?.text.format.schema;
      const answerSchema = schema.properties.answerFactIds;
      expect(schema.additionalProperties).toBe(false);
      expect(schema.properties.summaryFactIds.items.enum).toEqual(evidence.summaryIds);
      expect(schema.properties.recommendationFactIds.items.enum).toEqual(evidence.recommendationIds);
      expect(schema.properties.analysis).toBeUndefined();
      expect(schema.properties.answer).toBeUndefined();
      if (question) {
        expect(answerSchema.items.enum).toEqual(Object.keys(evidence.facts));
        expect(result.answer).toBe(selection.answerFactIds.map((id) => evidence.facts[id]).join(' '));
      } else {
        expect(answerSchema.maxItems).toBe(0);
        expect(schema.properties.answerSupported.enum).toEqual([false]);
        expect(result.answer).toBeUndefined();
      }
      expect(result.source).toBe('llm');
    } finally { vi.unstubAllGlobals(); }
  });
});
