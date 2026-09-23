// @vitest-environment jsdom
import React, { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from '../src/App';
import { DRAFT_STORAGE_KEY, SCENARIOS_STORAGE_KEY } from '../src/scenarios/storage';
import { runSimulation } from '../src/engine/simulator';
import type { SelectedDecision } from '../src/engine/types';

const benchmark: SelectedDecision[] = [
  { measureId: 'M7', districtId: 'nura' }, { measureId: 'M8', districtId: 'nura' },
  { measureId: 'M10', districtId: 'nura' }, { measureId: 'M12' },
  { measureId: 'M5', districtId: 'saryarka' },
];
const response = {
  simulation: runSimulation(benchmark), source: 'llm',
  analysis: {
    executiveSummary: 'Проверенный анализ сценария', strengths: [], risksAndTradeoffs: [],
    districtHighlights: [], actionableRecommendations: [], akimatRatingVerdict: 'Результат анализа',
  },
};
const apiResponse = () => ({ ok: true, json: async () => response }) as Response;
const readDraft = () => JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY)!).draft;
const readLibrary = () => JSON.parse(localStorage.getItem(SCENARIOS_STORAGE_KEY)!).scenarios;

function openLibrary() {
  fireEvent.click(screen.getByRole('button', { name: 'Сценарии' }));
  return screen.getByRole('dialog', { name: 'Сценарии' });
}
function closeLibrary() {
  fireEvent.keyDown(screen.getByRole('dialog', { name: 'Сценарии' }), { key: 'Escape' });
}
function saveCurrent(name: string) {
  const dialog = openLibrary();
  fireEvent.change(within(dialog).getByLabelText('Название сценария'), { target: { value: name } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить сценарий' }));
  return dialog;
}
function row(dialog: HTMLElement, name: string) {
  return within(dialog).getByRole('row', { name: new RegExp(name) });
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('persistent scenarios in the application', () => {
  it('hydrates an incomplete draft before any autosave, restores district and never starts AI', () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ version: 1, draft: {
      decisions: benchmark.slice(0, 2), selectedDistrictId: 'almaty',
    } }));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const first = render(<StrictMode><App /></StrictMode>);
    expect(screen.getByText('2/5')).toBeTruthy();
    expect((screen.getByLabelText('Район для работы') as HTMLSelectElement).value).toBe('almaty');
    expect(readDraft()).toEqual({ decisions: benchmark.slice(0, 2), selectedDistrictId: 'almaty' });
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать M12' }));
    first.unmount();
    render(<StrictMode><App /></StrictMode>);
    expect(screen.getByText('3/5')).toBeTruthy();
    expect((screen.getByLabelText('Район для работы') as HTMLSelectElement).value).toBe('almaty');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps saved snapshots independent from reset, load, edits, delete and remount', () => {
    let app = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Эталон ТЗ' }));
    let dialog = saveCurrent('Эталон сохранённый');
    const saved = row(dialog, 'Эталон сохранённый');
    expect(within(saved).getByText('56,54')).toBeTruthy();
    expect(within(saved).getByText('95/100')).toBeTruthy();
    expect(readLibrary()).toHaveLength(1);
    expect(readLibrary()[0].decisions).toEqual(benchmark);
    closeLibrary();

    fireEvent.click(screen.getByRole('button', { name: 'Сбросить все решения' }));
    app.unmount();
    app = render(<App />);
    expect(screen.getByText('0/5')).toBeTruthy();
    expect(readDraft().decisions).toEqual([]);
    dialog = openLibrary();
    fireEvent.click(within(row(dialog, 'Эталон сохранённый')).getByRole('button', { name: /Загрузить/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    const annualTable = screen.getByText('Результаты и бюджет по годам').closest('table')!;
    expect(within(annualTable).getByText('56,54')).toBeTruthy();
    expect(readDraft().decisions).toEqual(benchmark);

    // The loaded snapshot is a copy: subsequent edits only change the draft.
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить все решения' }));
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать M12' }));
    expect(readLibrary()[0].decisions).toEqual(benchmark);
    dialog = openLibrary();
    fireEvent.click(within(row(dialog, 'Эталон сохранённый')).getByRole('button', { name: /Удалить/ }));
    closeLibrary();
    expect(screen.getByText('1/5')).toBeTruthy();
    expect(readDraft().decisions).toEqual([{ measureId: 'M12' }]);
    app.unmount();
    render(<App />);
    expect(screen.getByText('1/5')).toBeTruthy();
    expect(readLibrary()).toEqual([]);
  }, 15000);

  it('aborts a pending analysis when loading even the same saved decisions', async () => {
    let resolveRequest!: (value: Response) => void;
    const fetchMock = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { resolveRequest = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Эталон ТЗ' }));
    saveCurrent('Для загрузки');
    closeLibrary();
    fireEvent.click(screen.getByRole('tab', { name: 'Аналитика' }));
    fireEvent.click(screen.getByRole('button', { name: 'Получить AI-анализ' }));
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    const dialog = openLibrary();
    fireEvent.click(within(row(dialog, 'Для загрузки')).getByRole('button', { name: /Загрузить/ }));
    expect(signal.aborted).toBe(true);
    await act(async () => { resolveRequest(apiResponse()); });
    expect(screen.queryByText('Проверенный анализ сценария')).toBeNull();
  });

  it('saving, selecting a comparison and deleting do not stale analysis; loading does', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiResponse()));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Эталон ТЗ' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Аналитика' }));
    fireEvent.click(screen.getByRole('button', { name: 'Получить AI-анализ' }));
    await screen.findByText('Проверенный анализ сценария');
    saveCurrent('Первый вариант');
    closeLibrary();
    const dialog = saveCurrent('Второй вариант');
    const [first, second] = readLibrary();
    fireEvent.change(within(dialog).getByLabelText('Сценарий A'), { target: { value: first.id } });
    fireEvent.change(within(dialog).getByLabelText('Сценарий B'), { target: { value: second.id } });
    fireEvent.click(within(row(dialog, 'Второй вариант')).getByRole('button', { name: /Удалить/ }));
    closeLibrary();
    expect(screen.queryByText(/Анализ устарел/)).toBeNull();
    expect(screen.getByLabelText('Анализ текущего сценария')).toBeTruthy();
    const library = openLibrary();
    fireEvent.click(within(row(library, 'Первый вариант')).getByRole('button', { name: /Загрузить/ }));
    expect(screen.getByLabelText('Устаревший анализ')).toBeTruthy();
  }, 15000);
});
