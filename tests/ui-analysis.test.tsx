// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AIInsightCard } from '../src/components/AIInsightCard';
import { DecisionPanel } from '../src/components/DecisionPanel';
import App from '../src/App';
import { runSimulation } from '../src/engine/simulator';
import type { SelectedDecision, ValidSimulationResult } from '../src/engine/types';
import type { AnalysisResponse } from '../src/ai/llmClient';

const benchmark: SelectedDecision[] = [
  { measureId: 'M7', districtId: 'nura' },
  { measureId: 'M8', districtId: 'nura' },
  { measureId: 'M10', districtId: 'nura' },
  { measureId: 'M12' },
  { measureId: 'M5', districtId: 'saryarka' },
];

const simulation = runSimulation(benchmark) as ValidSimulationResult;
const response: AnalysisResponse = {
  simulation,
  source: 'llm',
  analysis: {
    executiveSummary: 'Объяснение от серверной модели', strengths: ['Социальные дефициты устранены'],
    risksAndTradeoffs: ['Транспорт остался без новых мер'], districtHighlights: [],
    actionableRecommendations: ['Оцените транспорт в следующем сценарии'], akimatRatingVerdict: 'Социальный приоритет',
  },
};
const apiResponse = (payload = response) => ({ ok: true, json: async () => payload }) as Response;

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); });

describe('explicit server analysis', () => {
  it('does not request analysis on render and gates an incomplete scenario', () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    render(<AIInsightCard simulation={runSimulation([])} scenarioRevision={0} />);
    expect((screen.getByRole('button', { name: 'Получить AI-анализ' }) as HTMLButtonElement).disabled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends only decisions and optional question on click, shows LLM source', async () => {
    const fetchMock = vi.fn().mockResolvedValue(apiResponse({ ...response, answer: 'Ответ на вопрос' }));
    vi.stubGlobal('fetch', fetchMock);
    render(<AIInsightCard simulation={simulation} scenarioRevision={0} />);
    fireEvent.change(screen.getByLabelText('Вопрос советнику (необязательно)'), { target: { value: '  Какие риски?  ' } });
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Получить AI-анализ' }));
    await screen.findByText('Анализ LLM');
    expect(screen.getByText('Ответ на вопрос')).toBeTruthy();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/analyze');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ decisions: benchmark, question: 'Какие риски?' });
  });

  it('marks the prior response stale after any change, even when returning to A', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiResponse()));
    const { rerender } = render(<AIInsightCard simulation={simulation} scenarioRevision={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Получить AI-анализ' }));
    await screen.findByText(response.analysis.executiveSummary);
    rerender(<AIInsightCard simulation={runSimulation([])} scenarioRevision={1} />);
    expect(screen.getByText(/Анализ устарел/)).toBeTruthy();
    rerender(<AIInsightCard simulation={simulation} scenarioRevision={2} />);
    expect(screen.getByLabelText('Устаревший анализ')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Обновить AI-анализ' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('aborts and discards late A response after A → B → A', async () => {
    let resolveRequest!: (value: Response) => void;
    const fetchMock = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { resolveRequest = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = render(<AIInsightCard simulation={simulation} scenarioRevision={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Получить AI-анализ' }));
    expect((screen.getByRole('button', { name: 'Анализируем…' }) as HTMLButtonElement).disabled).toBe(true);
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    rerender(<AIInsightCard simulation={runSimulation([])} scenarioRevision={1} />);
    rerender(<AIInsightCard simulation={simulation} scenarioRevision={2} />);
    expect(signal.aborted).toBe(true);
    await act(async () => { resolveRequest(apiResponse()); });
    expect(screen.queryByText(response.analysis.executiveSummary)).toBeNull();
    expect((screen.getByRole('button', { name: 'Получить AI-анализ' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('never replaces the new scenario response with an older late response', async () => {
    let resolveOld!: (value: Response) => void;
    const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce(apiResponse({ ...response, analysis: { ...response.analysis, executiveSummary: 'Новый анализ' } }));
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = render(<AIInsightCard simulation={simulation} scenarioRevision={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Получить AI-анализ' }));
    rerender(<AIInsightCard simulation={simulation} scenarioRevision={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Получить AI-анализ' }));
    await screen.findByText('Новый анализ');
    await act(async () => { resolveOld(apiResponse()); });
    expect(screen.getByText('Новый анализ')).toBeTruthy();
    expect(screen.queryByText(response.analysis.executiveSummary)).toBeNull();
  });

  it('labels server fallback and its cause', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiResponse({ ...response, source: 'rules', reason: 'missing_key' })));
    render(<AIInsightCard simulation={simulation} scenarioRevision={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Получить AI-анализ' }));
    await screen.findByText('Анализ по правилам');
    expect(screen.getByText(/LLM не подключён на сервере/)).toBeTruthy();
    expect(screen.queryByText('Анализ LLM')).toBeNull();
  });

  it('clearly labels local fallback on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<AIInsightCard simulation={simulation} scenarioRevision={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Получить AI-анализ' }));
    await screen.findByText('Анализ по правилам');
    expect(screen.getByText(/Сервер анализа недоступен/)).toBeTruthy();
  });

  it('shows validation errors from the server without claiming successful analysis', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({ error: 'Сценарий отклонён' }) }));
    render(<AIInsightCard simulation={simulation} scenarioRevision={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Получить AI-анализ' }));
    await screen.findByRole('alert');
    expect(screen.getByText('Сценарий отклонён')).toBeTruthy();
    expect(screen.queryByText('Анализ по правилам')).toBeNull();
  });
});

describe('scenario selection', () => {
  it('starts empty, hides experiments, loads the benchmark and resets', () => {
    render(<App />);
    expect(screen.getByText('0/5')).toBeTruthy();
    expect(screen.getByText('52,56')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Форс-мажор|Команды|Презентация/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Сценарии' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Эталон ТЗ' }));
    expect(screen.getByText('5/5')).toBeTruthy();
    expect(screen.getByText('56,54')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Выбрать M1' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Выбрать M1' }).title).toMatch(/^При добавлении:/);
    expect(within(screen.getByTestId('measure-M6')).getByText('Возможная синергия с M5')).toBeTruthy();
    expect(screen.getByText('M5: Сарыарка')).toBeTruthy();
    expect(screen.queryByText('saryarka')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить все решения' }));
    expect(screen.getByText('0/5')).toBeTruthy();
    expect(screen.queryByText('56,54')).toBeNull();
  }, 15000);

  it('blocks the third measure of a direction using the shared validator', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать M7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать M8' }));
    const third = screen.getByRole('button', { name: 'Выбрать M9' }) as HTMLButtonElement;
    expect(third.disabled).toBe(true);
    expect(within(screen.getByTestId('measure-M9')).getByText(/Максимум|максимум|направлен/)).toBeTruthy();
    fireEvent.click(third);
    expect(screen.getByText('2/5')).toBeTruthy();
  });

  it('blocks excess cost before accepting a decision', () => {
    const costly: SelectedDecision[] = [{ measureId: 'M7', districtId: 'nura' }, { measureId: 'M8', districtId: 'nura' }, { measureId: 'M5', districtId: 'saryarka' }, { measureId: 'M6' }];
    render(<DecisionPanel decisions={costly} onAddDecision={vi.fn()} onRemoveDecision={vi.fn()} />);
    const m1 = screen.getByRole('button', { name: 'Выбрать M1' }) as HTMLButtonElement;
    expect(m1.disabled).toBe(true);
  });

  it('sends city measures without the district property', () => {
    const add = vi.fn();
    render(<DecisionPanel decisions={[]} onAddDecision={add} onRemoveDecision={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать M12' }));
    expect(add).toHaveBeenCalledWith({ measureId: 'M12' });
    expect(Object.hasOwn(add.mock.calls[0][0], 'districtId')).toBe(false);
  });

  it('rechecks same-district incompatibilities when changing district', () => {
    render(<DecisionPanel districtId="esil" decisions={[{ measureId: 'M7', districtId: 'esil' }]} onAddDecision={vi.fn()} onRemoveDecision={vi.fn()} />);
    const measure = screen.getByTestId('measure-M4');
    expect((within(measure).getByRole('button', { name: 'Выбрать M4' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(measure).getByRole('combobox'), { target: { value: 'nura' } });
    expect((within(measure).getByRole('button', { name: 'Выбрать M4' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
