import { describe, expect, it, vi } from 'vitest';
import {
  countQuoteWords, createCitizenVoiceService, parseAkimDecision, isAkimDecision,
  type CitizenBatchRequest, type CitizenVoiceProvider,
} from '../server/citizenVoices';
import { isDirectlyAffected, selectAffectedAgents } from '../src/population/selection';
import type { AkimDecision, CitizenAgent } from '../src/population/types';

const schoolDecision: AkimDecision = {
  id: 'school-1', topic: 'schools', districtIds: ['nura'], effect: 'improve',
  summary: 'Объявлено строительство школы в Нуре.',
};

function agent(id: string, overrides: Partial<CitizenAgent> = {}): CitizenAgent {
  return {
    id, name: `Житель ${id}`, age: 35, homeDistrict: 'nura', workDistrict: 'esil',
    profession: 'учитель', hasChildren: true, childrenAges: [9], stress: 65,
    currentAction: 'везёт детей в школу', transport: 'school', income: 'middle',
    interests: ['schools', 'transport', 'heating'],
    routes: [{ from: 'nura', to: 'esil', purpose: 'school', bridgeId: 'bridge-1' }],
    biography: 'Живёт в Нуре, утром сопровождает ребёнка в школу.',
    speechStyle: 'Прямо, эмоционально.', focusGroup: true, ...overrides,
  };
}
const cohort = Array.from({ length: 8 }, (_, index) => agent(`resident-${index}`));
function inputOf(request: CitizenBatchRequest): { agents: { id: string }[]; maxWords: number } {
  return JSON.parse(request.messages[1].content as string);
}
function outputOf(request: CitizenBatchRequest) {
  return { thoughts: inputOf(request).agents.map(person => ({
    agentId: person.id, quote: 'Надеюсь, школа станет ближе. Чат КСК ждёт подробностей.',
  })) };
}

describe('direct impact selection', () => {
  it('requires school-age children and a home or actual school destination in the district', () => {
    const workOnly = agent('work-only', { homeDistrict: 'saryarka', workDistrict: 'nura', routes: [] });
    const toddler = agent('toddler', { childrenAges: [2] });
    const noChildren = agent('no-children', { hasChildren: false, childrenAges: [] });
    const schoolDestination = agent('school-destination', {
      homeDistrict: 'saryarka', routes: [{ from: 'saryarka', to: 'nura', purpose: 'school' }],
    });
    const unrelated = agent('unrelated', { interests: ['transport'] });
    expect(isDirectlyAffected(workOnly, schoolDecision)).toBe(false);
    expect(isDirectlyAffected(toddler, schoolDecision)).toBe(false);
    expect(isDirectlyAffected(noChildren, schoolDecision)).toBe(false);
    expect(isDirectlyAffected(unrelated, schoolDecision)).toBe(false);
    expect(isDirectlyAffected(schoolDestination, schoolDecision)).toBe(true);
    expect(selectAffectedAgents([workOnly, toddler, noChildren, schoolDestination], schoolDecision))
      .toEqual([schoolDestination]);
  });

  it('intersects bridge use and district scope and samples without replacement', () => {
    const decision: AkimDecision = { ...schoolDecision, topic: 'transport', bridgeIds: ['bridge-1'] };
    const wrongBridge = agent('other-bridge', {
      routes: [{ from: 'nura', to: 'esil', purpose: 'work', bridgeId: 'bridge-2' }],
    });
    const wrongDistrict = agent('other-district', {
      homeDistrict: 'almaty', workDistrict: 'esil',
      routes: [{ from: 'almaty', to: 'esil', purpose: 'work', bridgeId: 'bridge-1' }],
    });
    expect(isDirectlyAffected(wrongBridge, decision)).toBe(false);
    expect(isDirectlyAffected(wrongDistrict, decision)).toBe(false);
    const selected = selectAffectedAgents([...cohort, cohort[0], wrongBridge, wrongDistrict], decision, { random: () => 0.999 });
    expect(selected).toHaveLength(5);
    expect(new Set(selected.map(person => person.id)).size).toBe(5);
  });
});

describe('batched citizen voice service', () => {
  it('makes one compact request at 0.8 with a strict ID schema and 600-token ceiling', async () => {
    const provider = vi.fn(async (request: CitizenBatchRequest) => JSON.stringify(outputOf(request)));
    const service = createCitizenVoiceService({ provider, random: () => 0 });
    const thoughts = await service.generateCitizenThoughts(cohort, schoolDecision);
    expect(provider).toHaveBeenCalledTimes(1);
    const request = provider.mock.calls[0][0];
    expect(request.temperature).toBe(0.8);
    expect(request.max_completion_tokens).toBe(600);
    expect(request.messages).toHaveLength(2);
    expect(request.response_format).toMatchObject({ type: 'json_schema', json_schema: { strict: true } });
    expect(inputOf(request).agents).toHaveLength(3);
    expect(thoughts).toHaveLength(3);
    expect(thoughts.every(thought => thought.source === 'llm' && countQuoteWords(thought.quote) <= 15)).toBe(true);
  });

  it('uses no API for zero affected people and provides marked rule quotes without a key', async () => {
    const provider = vi.fn(async (request: CitizenBatchRequest) => outputOf(request));
    const service = createCitizenVoiceService({ provider });
    expect(await service.generateCitizenThoughts([agent('childless', { hasChildren: false })], schoolDecision)).toEqual([]);
    expect(provider).not.toHaveBeenCalled();
    const offline = createCitizenVoiceService({ random: () => 0 });
    const thoughts = await offline.generateCitizenThoughts(cohort, schoolDecision);
    expect(thoughts).toHaveLength(3);
    expect(thoughts.every(thought => thought.source === 'rules' && countQuoteWords(thought.quote) <= 15)).toBe(true);
  });

  it('coalesces concurrent identical decisions before random selection and protects cached results from mutation', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const provider = vi.fn(async (request: CitizenBatchRequest) => { await gate; return outputOf(request); });
    const random = vi.fn(() => 0);
    const service = createCitizenVoiceService({ provider, random });
    const first = service.generateCitizenThoughts(cohort, schoolDecision);
    const second = service.generateCitizenThoughts([...cohort].reverse(), schoolDecision);
    expect(provider).toHaveBeenCalledTimes(1);
    release();
    const [one, two] = await Promise.all([first, second]);
    expect(one).toEqual(two);
    const draws = random.mock.calls.length;
    one[0].quote = 'changed';
    const cached = await service.generateCitizenThoughts(cohort, schoolDecision);
    expect(cached).toEqual(two);
    expect(random).toHaveBeenCalledTimes(draws);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('invalidates changed decision semantics, stress and expired entries; respects bounded cache', async () => {
    let time = 1_000;
    const provider = vi.fn(async (request: CitizenBatchRequest) => outputOf(request));
    const service = createCitizenVoiceService({ provider, random: () => 0, now: () => time, cooldownMs: 0, cacheTtlMs: 50, maxCacheEntries: 1 });
    await service.generateCitizenThoughts(cohort, schoolDecision);
    await service.generateCitizenThoughts(cohort, { ...schoolDecision, effect: 'worsen' });
    await service.generateCitizenThoughts(cohort, schoolDecision);
    await service.generateCitizenThoughts(cohort.map(person => ({ ...person, stress: 99 })), schoolDecision);
    time += 51;
    await service.generateCitizenThoughts(cohort.map(person => ({ ...person, stress: 99 })), schoolDecision);
    expect(provider).toHaveBeenCalledTimes(5);
  });

  it.each(['duplicate', 'unknown', 'too-long', 'extra-key', 'wrong-count', 'invalid-json'])('rejects malformed %s provider output as a whole', async kind => {
    const provider: CitizenVoiceProvider = async request => {
      const output = outputOf(request);
      if (kind === 'duplicate') output.thoughts[1].agentId = output.thoughts[0].agentId;
      if (kind === 'unknown') output.thoughts[0].agentId = 'not-in-batch';
      if (kind === 'too-long') output.thoughts[0].quote = Array(16).fill('слово').join(' ');
      if (kind === 'extra-key') return { ...output, debug: 'extra' };
      if (kind === 'wrong-count') output.thoughts.pop();
      if (kind === 'invalid-json') return 'not JSON';
      return output;
    };
    const thoughts = await createCitizenVoiceService({ provider, random: () => 0 }).generateCitizenThoughts(cohort, schoolDecision);
    expect(thoughts).toHaveLength(3);
    expect(thoughts.every(thought => thought.source === 'rules')).toBe(true);
  });

  it('does not retry failures and isolates caches between services', async () => {
    const provider = vi.fn(async () => { throw new Error('provider secret failure'); });
    const first = createCitizenVoiceService({ provider, random: () => 0 });
    const second = createCitizenVoiceService({ provider, random: () => 0 });
    const thoughts = await first.generateCitizenThoughts(cohort, schoolDecision);
    await first.generateCitizenThoughts(cohort, schoolDecision);
    await second.generateCitizenThoughts(cohort, schoolDecision);
    expect(provider).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(thoughts)).not.toContain('secret');
  });

  it('caps requests per minute, returns local quotes on cooldown, and aborts stalled providers', async () => {
    let time = 0;
    const provider = vi.fn(async (request: CitizenBatchRequest) => outputOf(request));
    const service = createCitizenVoiceService({ provider, random: () => 0, now: () => time, cooldownMs: 100, maxRequestsPerMinute: 1 });
    await service.generateCitizenThoughts(cohort, schoolDecision);
    const guarded = await service.generateCitizenThoughts(cohort, { ...schoolDecision, id: 'second' });
    expect(guarded[0].source).toBe('rules');
    time = 500;
    await service.generateCitizenThoughts(cohort, { ...schoolDecision, id: 'third' });
    expect(provider).toHaveBeenCalledTimes(1);
    time = 60_001;
    await service.generateCitizenThoughts(cohort, { ...schoolDecision, id: 'fourth' });
    expect(provider).toHaveBeenCalledTimes(2);

    let signal: AbortSignal | undefined;
    const stalled = createCitizenVoiceService({ timeoutMs: 100, provider: async (_, requestSignal) => {
      signal = requestSignal;
      return new Promise(() => {});
    } });
    const fallback = await stalled.generateCitizenThoughts(cohort, schoolDecision);
    expect(signal?.aborted).toBe(true);
    expect(fallback.every(thought => thought.source === 'rules')).toBe(true);
  });

  it('the focus-group endpoint caps quotes at twelve words and people at four', async () => {
    const provider = vi.fn(async (request: CitizenBatchRequest) => outputOf(request));
    const service = createCitizenVoiceService({ provider, random: () => 0.999 });
    const thoughts = await service.generateVoiceOfCitizens('nura', { ...schoolDecision, topic: 'heating' });
    expect(thoughts.length).toBeGreaterThan(0);
    expect(thoughts.length).toBeLessThanOrEqual(4);
    expect(thoughts.every(thought => countQuoteWords(thought.quote) <= 12)).toBe(true);
    expect(inputOf(provider.mock.calls[0][0]).maxWords).toBe(12);
  });
});

describe('decision JSON validation', () => {
  it('accepts bounded supported fields and rejects unknown, oversized and duplicate scope values', () => {
    expect(parseAkimDecision(schoolDecision)).toEqual(schoolDecision);
    expect(isAkimDecision(schoolDecision)).toBe(true);
    expect(parseAkimDecision({ ...schoolDecision, districtIds: ['nura', 'nura'] })).toBeNull();
    expect(parseAkimDecision({ ...schoolDecision, districtIds: ['unknown'] })).toBeNull();
    expect(parseAkimDecision({ ...schoolDecision, summary: 'x'.repeat(501) })).toBeNull();
    expect(parseAkimDecision({ ...schoolDecision, apiKey: 'untrusted' })).toBeNull();
    expect(parseAkimDecision({ ...schoolDecision, bridgeIds: ['unknown'] })).toBeNull();
    expect(parseAkimDecision({ ...schoolDecision, bridgeIds: ['central'] })).not.toBeNull();
    expect(parseAkimDecision(null)).toBeNull();
  });
});
