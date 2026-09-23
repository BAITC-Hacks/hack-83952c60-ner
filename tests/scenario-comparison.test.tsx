// @vitest-environment jsdom
import React, { StrictMode, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { CompareModal, rankScenarios } from '../src/components/CompareModal';
import { runSimulation } from '../src/engine/simulator';
import type { SelectedDecision } from '../src/engine/types';
import type { SavedScenario } from '../src/scenarios/storage';

const benchmark: SelectedDecision[] = [
  { measureId: 'M7', districtId: 'nura' }, { measureId: 'M8', districtId: 'nura' },
  { measureId: 'M10', districtId: 'nura' }, { measureId: 'M12' }, { measureId: 'M5', districtId: 'saryarka' },
];
const economical: SelectedDecision[] = [
  { measureId: 'M9', districtId: 'nura' }, { measureId: 'M11', districtId: 'almaty' },
  { measureId: 'M10', districtId: 'saryarka' }, { measureId: 'M12' }, { measureId: 'M4', districtId: 'esil' },
];
const saved = (id: string, name: string, decisions = benchmark, createdAt = '2026-09-23T10:00:00.000Z'): SavedScenario => ({ id, name, decisions, createdAt });
const referenceScenario = saved('benchmark', 'Эталон');
const economyScenario = saved('economy', 'Экономный', economical);
const defaults = () => ({
  isOpen: true, onClose: vi.fn(), currentSim: runSimulation(benchmark), scenarios: [referenceScenario, economyScenario],
  onSaveScenario: vi.fn((_name: string) => true), onDeleteScenario: vi.fn((_id: string) => {}), onLoadScenario: vi.fn((_decisions: SelectedDecision[]) => {}), hasExperimentalEvents: false, notices: [],
});

afterEach(() => {
  cleanup();
  document.querySelectorAll('[data-test-opener]').forEach((element) => element.remove());
  document.body.style.overflow = '';
  vi.restoreAllMocks();
});

describe('scenario library and detailed comparison', () => {
  it('computes benchmark values and ranks exact scores before newer timestamps', () => {
    const higher: SelectedDecision[] = [
      { measureId: 'M7', districtId: 'esil' }, { measureId: 'M8', districtId: 'esil' },
      { measureId: 'M10', districtId: 'esil' }, { measureId: 'M12' }, { measureId: 'M5', districtId: 'almaty' },
    ];
    const lower: SelectedDecision[] = [
      { measureId: 'M7', districtId: 'esil' }, { measureId: 'M8', districtId: 'esil' },
      { measureId: 'M10', districtId: 'almaty' }, { measureId: 'M12' }, { measureId: 'M5', districtId: 'esil' },
    ];
    const scenarios = [saved('low', 'Ниже, но новее', lower, '2026-09-23T12:00:00Z'), saved('high-old', 'Выше, старый', higher), saved('high-new', 'Выше, новый', higher, '2026-09-23T11:00:00Z')];
    const ranked = rankScenarios(scenarios);
    expect(ranked[0].simulation.finalScore).toBeGreaterThan(ranked[2].simulation.finalScore);
    expect(ranked.map((scenario) => scenario.id)).toEqual(['high-new', 'high-old', 'low']);
    render(<CompareModal {...defaults()} scenarios={[...scenarios, referenceScenario]} />);
    const rows = within(screen.getByRole('region', { name: 'Таблица сохранённых сценариев' })).getAllByRole('row');
    expect(rows.slice(1).map((row) => within(row).getByRole('rowheader').textContent)).toEqual([
      expect.stringContaining('Эталон'), expect.stringContaining('Выше, новый'), expect.stringContaining('Выше, старый'), expect.stringContaining('Ниже, но новее'),
    ]);
    const benchmarkCells = within(rows[1]).getAllByRole('cell');
    expect(benchmarkCells.slice(0, 4).map((cell) => cell.textContent)).toEqual(['56,54', '+3,99', '95/100', '0']);
  });

  it('compares B minus A with improving critical count and neutral budget, district and indicator details', () => {
    render(<CompareModal {...defaults()} />);
    fireEvent.change(screen.getByLabelText('Сценарий A'), { target: { value: 'economy' } });
    fireEvent.change(screen.getByLabelText('Сценарий B'), { target: { value: 'benchmark' } });
    const metrics = within(screen.getByRole('region', { name: 'Итоговые показатели сравнения' }));
    const score = metrics.getByRole('row', { name: /^Score / });
    expect(within(score).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['53,80', '56,54', '+2,74 — улучшение']);
    const critical = metrics.getByRole('row', { name: /^Критические показатели / });
    expect(critical.querySelector('.scenario-difference-positive')?.textContent).toBe('−2 — улучшение');
    const cost = metrics.getByRole('row', { name: /^Расход бюджета / });
    expect(cost.querySelector('.scenario-difference-neutral')?.textContent).toBe('+34');
    expect(metrics.getByRole('row', { name: /^Средний результат города / }).textContent).toContain('−0,02');
    expect(metrics.getByRole('row', { name: /^Оценка слабейшего района / }).textContent).toContain('+2,53');
    expect(metrics.getByRole('row', { name: /^Слабейший район / }).textContent).toContain('НураНура');
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getAllByText('Весь город')).toHaveLength(2);
    expect(within(screen.getByRole('region', { name: 'Сравнение оценок районов' })).getAllByRole('row')).toHaveLength(7);
    const indicators = within(screen.getByRole('region', { name: 'Сравнение показателей района Нура' }));
    expect(indicators.getAllByRole('row')).toHaveLength(11);
    expect(indicators.getByRole('row', { name: /^S1 · / }).textContent).toContain('40,6348,00+7,38');
    fireEvent.change(screen.getByLabelText('Район для сравнения'), { target: { value: 'almaty' } });
    const almaty = within(screen.getByRole('region', { name: 'Сравнение показателей района Алматы' }));
    expect(almaty.getByRole('row', { name: /^T1 · / }).textContent).toContain('38,2540,00+1,75');
    // Swap the pair by clearing one choice first; budget savings remain neutral.
    fireEvent.change(screen.getByLabelText('Сценарий B'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Сценарий A'), { target: { value: 'benchmark' } });
    fireEvent.change(screen.getByLabelText('Сценарий B'), { target: { value: 'economy' } });
    expect(screen.getByRole('row', { name: /^Расход бюджета / }).querySelector('.scenario-difference-neutral')?.textContent).toBe('−34');
    expect(screen.getByRole('row', { name: /^Критические показатели / }).querySelector('.scenario-difference-negative')?.textContent).toBe('+2 — ухудшение');
  });

  it('disables the opposite selection and clears only a deleted participant', () => {
    const deleted = vi.fn();
    function Library() {
      const [scenarios, setScenarios] = useState([referenceScenario, economyScenario]);
      return <CompareModal {...defaults()} scenarios={scenarios} onDeleteScenario={(id) => { deleted(id); setScenarios((current) => current.filter((scenario) => scenario.id !== id)); }} />;
    }
    render(<Library />);
    const selectA = screen.getByRole('combobox', { name: 'Сценарий A' }) as HTMLSelectElement;
    const selectB = screen.getByRole('combobox', { name: 'Сценарий B' }) as HTMLSelectElement;
    fireEvent.change(selectA, { target: { value: 'economy' } });
    expect((within(selectB).getByRole('option', { name: /Экономный/ }) as HTMLOptionElement).disabled).toBe(true);
    fireEvent.change(selectB, { target: { value: 'benchmark' } });
    expect((within(selectA).getByRole('option', { name: /Эталон/ }) as HTMLOptionElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Удалить сценарий .*Экономный/ }));
    expect(deleted).toHaveBeenCalledWith('economy');
    expect(selectA.value).toBe('');
    expect(selectB.value).toBe('benchmark');
    expect(screen.queryByRole('region', { name: 'Итоговые показатели сравнения' })).toBeNull();
    expect(screen.getByText(/Сохраните хотя бы два сценария/)).toBeTruthy();
  });

  it('requires a nonblank name and disables saving incomplete or crisis scenarios with an explanation', () => {
    const props = defaults();
    const { rerender } = render(<CompareModal {...props} />);
    const save = screen.getByRole('button', { name: 'Сохранить сценарий' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Название сценария'), { target: { value: '   ' } });
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Название сценария'), { target: { value: '  Мой вариант  ' } });
    expect(save.disabled).toBe(false);
    rerender(<CompareModal {...props} currentSim={runSimulation(benchmark.slice(0, 4))} />);
    expect(save.disabled).toBe(true);
    expect(screen.getByText(/Для сохранения выберите допустимый набор из пяти решений/)).toBeTruthy();
    rerender(<CompareModal {...props} hasExperimentalEvents />);
    expect(save.disabled).toBe(true);
    expect(screen.getByText(/Сохранение недоступно при активных кризисах/)).toBeTruthy();
    rerender(<CompareModal {...props} notices={['Изменения останутся в памяти и не сохранятся после перезагрузки.']} />);
    fireEvent.click(save);
    expect(props.onSaveScenario).toHaveBeenCalledExactlyOnceWith('Мой вариант');
    expect((screen.getByLabelText('Название сценария') as HTMLInputElement).value).toBe('');
    expect(screen.getByText('Сценарий добавлен в библиотеку.')).toBeTruthy();
    expect(screen.getByText(/Изменения останутся в памяти/)).toBeTruthy();
  });

  it('shows an empty library and loads an independent copy of decisions', () => {
    const props = defaults();
    const { rerender } = render(<CompareModal {...props} scenarios={[]} />);
    expect(screen.getByText(/Пока нет сохранённых сценариев/)).toBeTruthy();
    expect((screen.getByLabelText('Сценарий A') as HTMLSelectElement).disabled).toBe(true);
    rerender(<CompareModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Загрузить сценарий .*Эталон/ }));
    const loaded = props.onLoadScenario.mock.calls[0][0];
    expect(loaded).toEqual(benchmark);
    expect(loaded).not.toBe(benchmark);
    expect(loaded[0]).not.toBe(benchmark[0]);
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('traps focus, uses the latest close callback and restores focus and scrolling in StrictMode', () => {
    const opener = document.createElement('button');
    opener.dataset.testOpener = '';
    opener.textContent = 'Открыть библиотеку';
    document.body.append(opener);
    opener.focus();
    document.body.style.overflow = 'auto';
    const props = defaults();
    const { rerender } = render(<StrictMode><CompareModal {...props} /></StrictMode>);
    expect(screen.getByRole('dialog', { name: 'Сценарии' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('Название сценария'));
    expect(document.body.style.overflow).toBe('hidden');
    const close = screen.getByRole('button', { name: 'Закрыть сценарии' });
    const last = screen.getByLabelText('Сценарий B');
    close.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    opener.focus();
    expect(document.activeElement).toBe(close);
    const latestClose = vi.fn();
    const input = screen.getByLabelText('Название сценария');
    input.focus();
    rerender(<StrictMode><CompareModal {...props} onClose={latestClose} /></StrictMode>);
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(latestClose).toHaveBeenCalledOnce();
    expect(props.onClose).not.toHaveBeenCalled();
    rerender(<StrictMode><CompareModal {...props} isOpen={false} /></StrictMode>);
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).toBe('auto');
  });
});
