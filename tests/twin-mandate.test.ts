import { expect, it } from 'vitest';
import { SelectedDecision } from '../src/engine/types';
import { advanceSession, applyMandate, initializeSession } from '../src/twin/model';
import { readStore, validSession } from '../src/twin/storage';
import { MEASURES } from '../src/data/measures';

const decisions: SelectedDecision[] = [
  { measureId: 'M7', districtId: 'nura' }, { measureId: 'M8', districtId: 'nura' },
  { measureId: 'M10', districtId: 'nura' }, { measureId: 'M12' },
  { measureId: 'M5', districtId: 'saryarka' },
];

it('charges once, preserves the baseline and waits for the quarter-based lag', () => {
  const initial = initializeSession();
  let session = { ...initial, city: applyMandate(initial.city, decisions) };
  expect(initial.city.budget).toBe(2400);
  expect(session.city.budget).toBe(2400 - decisions.reduce((sum, d) => sum + MEASURES[d.measureId].cost * 10, 0));
  expect(session.city.districts).toEqual(session.baseline.districts);
  expect(() => applyMandate(session.city, decisions)).toThrow(/уже/);
  const firstDue = Math.min(...decisions.map(d => MEASURES[d.measureId].lag * 3));
  for (let month = 1; month < firstDue; month++) {
    session = advanceSession(session);
    expect(session.city.districts).toEqual(session.baseline.districts);
  }
  session = advanceSession(session);
  expect(session.city.districts).not.toEqual(session.baseline.districts);
  expect(session.city.history.at(-1)?.districts).not.toEqual(session.baseline.history.at(-1)?.districts);
  expect(session.city.journal.some(e => e.text.includes('эффект введён'))).toBe(true);
});

it('restores pending effects and never applies them twice', () => {
  let session = initializeSession();
  session.city = applyMandate(session.city, decisions);
  for (let i = 0; i < 4; i++) session = advanceSession(session);
  const restored = readStore({ getItem: () => JSON.stringify({ version: 1, draft: session, snapshots: [] }) });
  expect(restored.notice).toBe('');
  let copy = restored.draft;
  for (let i = 4; i < 24; i++) { session = advanceSession(session); copy = advanceSession(copy); }
  expect(copy).toEqual(session);
  expect(copy.city.journal.filter(e => e.text.includes('эффект введён'))).toHaveLength(5);
  expect(validSession(copy)).toBe(true);
  expect(validSession({ ...copy, city: { ...copy.city, mandate: { started: 0, decisions: [] } } })).toBe(false);
});

it('rejects incomplete decisions, exhausted funds and a completed timeline without mutation', () => {
  const city = initializeSession().city;
  expect(() => applyMandate(city, decisions.slice(0, 4))).toThrow();
  expect(() => applyMandate({ ...city, budget: 0 }, decisions)).toThrow(/Недостаточно/);
  expect(() => applyMandate({ ...city, month: 60 }, decisions)).toThrow(/60/);
  expect(city.mandate).toBeUndefined();
});

it('targets districts, applies citywide effects and synergy, and preserves negative tradeoffs', () => {
  let session = initializeSession();
  session.city = applyMandate(session.city, decisions);
  for (let i = 0; i < 3; i++) session = advanceSession(session);
  expect(session.city.districts.nura.condition.safety - session.baseline.districts.nura.condition.safety).toBeCloseTo(8);
  expect(session.city.districts.esil.condition.safety).toBe(session.baseline.districts.esil.condition.safety);
  for (const id of ['esil', 'nura', 'saryarka'] as const) {
    expect(session.city.districts[id].condition.services - session.baseline.districts[id].condition.services).toBeCloseTo(2.5);
  }
  let tradeoff = initializeSession();
  tradeoff.city = applyMandate(tradeoff.city, decisions.map(d => d.measureId === 'M10' ? { measureId: 'M11', districtId: 'nura' } : d));
  for (let i = 0; i < 3; i++) tradeoff = advanceSession(tradeoff);
  expect(tradeoff.city.districts.nura.condition.transport - tradeoff.baseline.districts.nura.condition.transport).toBeCloseTo(-1);
  expect(tradeoff.city.districts.nura.load).toBeGreaterThan(tradeoff.baseline.districts.nura.load);
});
