import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app';
import { createPopulationSnapshot, stepCitizens } from '../src/population/simulation';
import type { AkimDecision } from '../src/population/types';
import type { CitizenVoiceProvider } from '../server/citizenVoices';

const schoolDecision: AkimDecision = {
  id: 'nura-school-1', topic: 'schools', districtIds: ['nura'],
  summary: 'Открыть дополнительные школьные места в Нуре.', effect: 'improve',
};

describe('population module integration', () => {
  it('serializes all three layers without losing the user-specified population', () => {
    const state = createPopulationSnapshot();
    expect(state.population).toBe(1_550_000);
    expect(state.visualParticles).toBe(1_550);
    expect(state.agents).toHaveLength(60);
    expect(state.focusGroup).toHaveLength(30);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(createPopulationSnapshot()).toEqual(state);
  });

  it('updates agent stress independently of tick size without mutating source agents', () => {
    const state = createPopulationSnapshot();
    const before = structuredClone(state.agents);
    const metrics = { hour: 8, districts: state.districts, trafficLoad: state.trafficLoad };
    const whole = stepCitizens(state.agents, metrics, 60);
    const halves = stepCitizens(stepCitizens(state.agents, metrics, 30), metrics, 30);
    for (let i = 0; i < whole.length; i++) {
      expect(whole[i].stress).toBeCloseTo(halves[i].stress, 10);
      expect(whole[i].stress).toBeGreaterThanOrEqual(0);
      expect(whole[i].stress).toBeLessThanOrEqual(100);
    }
    expect(state.agents).toEqual(before);
    expect(stepCitizens(state.agents, { ...metrics, hour: 2 }, 60).every(a => a.currentAction === 'дома')).toBe(true);
    expect(() => stepCitizens(state.agents, metrics, Number.NaN)).toThrow();
    expect(() => stepCitizens(state.agents, { ...metrics, hour: 24 }, 1)).toThrow();
  });

  it('serves short local reactions without a key or network', async () => {
    const app = createApp({ apiKey: '', citizenApiKey: '' });
    const response = await request(app).post('/api/population/voices')
      .send({ decision: schoolDecision, selectedDistrict: 'nura', mode: 'focus' });
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.thoughts).toHaveLength(3);
    for (const item of response.body.thoughts) {
      expect(item.agentId).toMatch(/^nura-/);
      expect(item.source).toBe('rules');
      expect(item.quote.split(/\s+/u).length).toBeLessThanOrEqual(12);
    }
  });

  it('batches through the server and deduplicates repeat decisions', async () => {
    const provider = vi.fn<CitizenVoiceProvider>().mockImplementation(async batch => {
      const input = JSON.parse(batch.messages[1].content as string);
      return { thoughts: input.agents.map((a: { id: string }) => ({ agentId: a.id, quote: 'Школы Нуры нужны рядом. Надеюсь, сроки не подведут.' })) };
    });
    const app = createApp({ apiKey: '', citizenApiKey: '', citizenProvider: provider });
    const body = { decision: schoolDecision, selectedDistrict: 'nura' };
    const first = await request(app).post('/api/population/voices').send(body);
    const second = await request(app).post('/api/population/voices').send(body);
    expect(first.status).toBe(200);
    expect(first.body.thoughts.every((a: { source: string }) => a.source === 'llm')).toBe(true);
    expect(second.body).toEqual(first.body);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(provider.mock.calls[0][0].temperature).toBe(.8);
  });

  it.each([
    { decision: schoolDecision, apiKey: 'do-not-accept-browser-keys' },
    { decision: { ...schoolDecision, districtIds: ['invalid'] } },
    { decision: { ...schoolDecision, summary: 'x'.repeat(501) } },
    { decision: schoolDecision, selectedDistrict: 'invalid' },
    { decision: schoolDecision, mode: 'unlimited' },
    { decision: { ...schoolDecision, id: null } },
  ])('rejects invalid input before spending tokens: %j', async body => {
    const provider = vi.fn<CitizenVoiceProvider>();
    const response = await request(createApp({ apiKey: '', citizenApiKey: '', citizenProvider: provider }))
      .post('/api/population/voices').send(body);
    expect(response.status).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });
});
