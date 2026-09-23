// @vitest-environment jsdom
import React, { StrictMode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SelectedDecision } from '../src/engine/types';
import {
  DRAFT_STORAGE_KEY, SCENARIOS_STORAGE_KEY, STORAGE_UNAVAILABLE_NOTICE,
} from '../src/scenarios/storage';
import type { SavedScenario } from '../src/scenarios/storage';
import { useScenarioStorage } from '../src/scenarios/useScenarioStorage';

const benchmark: SelectedDecision[] = [
  { measureId: 'M7', districtId: 'nura' },
  { measureId: 'M8', districtId: 'nura' },
  { measureId: 'M10', districtId: 'nura' },
  { measureId: 'M12' },
  { measureId: 'M5', districtId: 'saryarka' },
];
const saved: SavedScenario = {
  id: 'benchmark', name: 'Эталон', createdAt: '2026-09-23T10:00:00.000Z', decisions: benchmark,
};
const writeDraft = (draft: unknown, version = 1) =>
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ version, draft }));
const writeLibrary = (scenarios: unknown, version = 1) =>
  localStorage.setItem(SCENARIOS_STORAGE_KEY, JSON.stringify({ version, scenarios }));

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('scenario storage hydration and snapshots', () => {
  it('starts with an empty nura draft and an empty library', () => {
    const { result } = renderHook(useScenarioStorage);
    expect(result.current.draft).toEqual({ decisions: [], selectedDistrictId: 'nura' });
    expect(result.current.scenarios).toEqual([]);
    expect(result.current.notices).toEqual([]);
  });

  it('hydrates an incomplete draft and district before autosaving even in StrictMode', () => {
    const draft = { decisions: benchmark.slice(0, 2), selectedDistrictId: 'esil' };
    writeDraft(draft);
    writeLibrary([saved]);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(useScenarioStorage, {
      wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
    });
    expect(result.current.draft).toEqual(draft);
    expect(result.current.scenarios).toEqual([saved]);
    for (const [key, value] of writes.mock.calls) {
      if (key === DRAFT_STORAGE_KEY) expect(JSON.parse(value).draft).toEqual(draft);
      if (key === SCENARIOS_STORAGE_KEY) expect(JSON.parse(value).scenarios).toEqual([saved]);
    }
    expect(result.current.notices).toEqual([]);
  });

  it('persists district selection and an intentionally empty reset across remounts', () => {
    writeDraft({ decisions: benchmark, selectedDistrictId: 'nura' });
    writeLibrary([saved]);
    const first = renderHook(useScenarioStorage);
    act(() => first.result.current.setDraft({ decisions: [], selectedDistrictId: null }));
    first.unmount();
    const second = renderHook(useScenarioStorage);
    expect(second.result.current.draft).toEqual({ decisions: [], selectedDistrictId: null });
    expect(second.result.current.scenarios).toEqual([saved]);
  });

  it('requires a name and a valid complete set, allowing duplicate names as separate snapshots', () => {
    const { result } = renderHook(useScenarioStorage);
    act(() => {
      expect(result.current.saveScenario('   ', benchmark)).toBe(false);
      expect(result.current.saveScenario('Неполный', benchmark.slice(0, 4))).toBe(false);
      expect(result.current.saveScenario('Неверный район', [
        { measureId: 'M7', districtId: 'unknown' } as unknown as SelectedDecision, ...benchmark.slice(1),
      ])).toBe(false);
      expect(result.current.saveScenario('  Эталон  ', benchmark)).toBe(true);
      expect(result.current.saveScenario('Эталон', benchmark)).toBe(true);
    });
    expect(result.current.scenarios.map(({ name }) => name)).toEqual(['Эталон', 'Эталон']);
    expect(new Set(result.current.scenarios.map(({ id }) => id)).size).toBe(2);
    expect(result.current.scenarios.every(({ createdAt }) => Number.isFinite(Date.parse(createdAt)))).toBe(true);
  });

  it('keeps a deep independent snapshot and persists only canonical scenario fields', () => {
    const decisions = benchmark.map((decision) => ({ ...decision, unexpected: 'ignored' }));
    const { result, unmount } = renderHook(useScenarioStorage);
    act(() => { result.current.saveScenario('Эталон', decisions); });
    decisions[0].districtId = 'esil';
    decisions.pop();
    expect(result.current.scenarios[0].decisions).toEqual(benchmark);
    const record = JSON.parse(localStorage.getItem(SCENARIOS_STORAGE_KEY)!);
    expect(Object.keys(record.scenarios[0]).sort()).toEqual(['createdAt', 'decisions', 'id', 'name']);
    expect(record.scenarios[0].decisions).toEqual(benchmark);
    unmount();
    const restored = renderHook(useScenarioStorage);
    expect(restored.result.current.scenarios[0].decisions).toEqual(benchmark);
  });

  it('deletes only the requested snapshot and leaves current draft untouched', () => {
    const draft = { decisions: benchmark.slice(0, 3), selectedDistrictId: 'almaty' };
    writeDraft(draft);
    writeLibrary([saved, { ...saved, id: 'second' }]);
    const { result } = renderHook(useScenarioStorage);
    act(() => result.current.deleteScenario(saved.id));
    expect(result.current.scenarios.map(({ id }) => id)).toEqual(['second']);
    expect(result.current.draft).toEqual(draft);
    expect(JSON.parse(localStorage.getItem(SCENARIOS_STORAGE_KEY)!).scenarios).toEqual([{ ...saved, id: 'second' }]);
  });
});

describe('corruption and storage availability', () => {
  it('retains valid library entries while skipping invalid metadata, decisions and duplicate IDs', () => {
    writeLibrary([
      saved, { ...saved, name: 'Повтор ID' }, null,
      { ...saved, id: 'bad-name', name: ' ' },
      { ...saved, id: 'bad-date', createdAt: 'yesterday' },
      { ...saved, id: 'bad-decisions', decisions: benchmark.slice(0, 2) },
      { ...saved, id: 'bad-id', createdAt: 123 },
      { ...saved, id: 'valid-second', score: 999, name: '  Второй  ' },
    ]);
    const { result } = renderHook(useScenarioStorage);
    expect(result.current.scenarios).toEqual([saved, { ...saved, id: 'valid-second', name: 'Второй' }]);
    expect(result.current.notices.join(' ')).toContain('пропущены: 6');
    expect(JSON.parse(localStorage.getItem(SCENARIOS_STORAGE_KEY)!).scenarios).toEqual(result.current.scenarios);
    expect(localStorage.getItem(SCENARIOS_STORAGE_KEY)).not.toContain('score');
  });

  it.each([
    { decisions: [], selectedDistrictId: 'unknown' },
    { decisions: [], selectedDistrictId: '__proto__' },
    { decisions: [], selectedDistrictId: 12 },
    { decisions: [] },
    { decisions: [{ measureId: 'M7', districtId: 'unknown' }], selectedDistrictId: 'nura' },
    { decisions: [benchmark[0], benchmark[0]], selectedDistrictId: 'nura' },
    { decisions: null, selectedDistrictId: 'nura' },
  ])('rejects a corrupt draft through shape checks and the shared validator: %j', (draft) => {
    writeDraft(draft);
    const { result } = renderHook(useScenarioStorage);
    expect(result.current.draft).toEqual({ decisions: [], selectedDistrictId: 'nura' });
    expect(result.current.notices.join(' ')).toContain('Повреждённый черновик');
  });

  it('recovers from malformed JSON independently for each record', () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, '{');
    writeLibrary([saved]);
    const { result } = renderHook(useScenarioStorage);
    expect(result.current.draft.decisions).toEqual([]);
    expect(result.current.scenarios).toEqual([saved]);
    expect(result.current.notices.join(' ')).toContain('Повреждённые данные черновика');
  });

  it('does not overwrite unsupported versions even after user edits, saves or deletes', () => {
    writeDraft({ decisions: benchmark, selectedDistrictId: 'esil', future: true }, 2);
    writeLibrary([saved], 99);
    const originalDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    const originalLibrary = localStorage.getItem(SCENARIOS_STORAGE_KEY);
    const { result } = renderHook(useScenarioStorage);
    act(() => {
      result.current.setDraft({ decisions: benchmark.slice(0, 1), selectedDistrictId: 'esil' });
      result.current.saveScenario('Сессия', benchmark);
    });
    expect(result.current.scenarios).toHaveLength(1);
    expect(result.current.draft.decisions).toHaveLength(1);
    act(() => result.current.deleteScenario(result.current.scenarios[0].id));
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBe(originalDraft);
    expect(localStorage.getItem(SCENARIOS_STORAGE_KEY)).toBe(originalLibrary);
    expect(result.current.notices.filter((notice) => notice.includes('не поддерживается'))).toHaveLength(2);
  });

  it('continues in memory when obtaining localStorage throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    const { result } = renderHook(useScenarioStorage);
    act(() => {
      result.current.setDraft({ decisions: benchmark, selectedDistrictId: 'saryarka' });
      expect(result.current.saveScenario('В памяти', benchmark)).toBe(true);
    });
    expect(result.current.draft.decisions).toEqual(benchmark);
    expect(result.current.scenarios).toHaveLength(1);
    expect(result.current.notices).toEqual([STORAGE_UNAVAILABLE_NOTICE]);
  });

  it('retains the readable library and does not overwrite a record whose read failed', () => {
    writeDraft({ decisions: benchmark, selectedDistrictId: 'nura' });
    writeLibrary([saved]);
    const originalGetItem = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key === DRAFT_STORAGE_KEY) throw new DOMException('Denied', 'SecurityError');
      return originalGetItem.call(this, key);
    });
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(useScenarioStorage);
    act(() => result.current.setDraft({ decisions: [], selectedDistrictId: 'esil' }));
    expect(result.current.scenarios).toEqual([saved]);
    expect(writes.mock.calls.some(([key]) => key === DRAFT_STORAGE_KEY)).toBe(false);
    expect(result.current.notices).toContain(STORAGE_UNAVAILABLE_NOTICE);
  });

  it('retains edits and snapshots in memory when writes fail without repeated failures', () => {
    writeLibrary([saved]);
    const writes = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    const { result } = renderHook(useScenarioStorage);
    act(() => {
      result.current.setDraft({ decisions: benchmark, selectedDistrictId: 'nura' });
      result.current.saveScenario('В памяти', benchmark);
      result.current.deleteScenario(saved.id);
    });
    expect(result.current.draft.decisions).toEqual(benchmark);
    expect(result.current.scenarios.map(({ name }) => name)).toEqual(['В памяти']);
    expect(result.current.notices).toEqual([STORAGE_UNAVAILABLE_NOTICE]);
    expect(writes).toHaveBeenCalledTimes(1);
  });
});
