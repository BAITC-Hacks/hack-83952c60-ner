// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../src/App';
import { AnnualPlanAnalytics } from '../src/components/AnnualPlanAnalytics';
import { runAnnualPlan } from '../src/engine/annualPlan';
import { INDICATORS } from '../src/data/indicators';
import { setLanguage, t } from '../src/i18n';
import type { SelectedDecision } from '../src/engine/types';

const benchmark: SelectedDecision[] = [
  { measureId: 'M7', districtId: 'nura' }, { measureId: 'M8', districtId: 'nura' },
  { measureId: 'M10', districtId: 'nura' }, { measureId: 'M12' },
  { measureId: 'M5', districtId: 'saryarka' },
];

beforeEach(() => { localStorage.clear(); setLanguage('ru'); window.location.hash = ''; });
afterEach(() => { cleanup(); localStorage.clear(); setLanguage('ru'); vi.unstubAllGlobals(); });

it('removes projections when the decision set becomes incomplete', () => {
  const { rerender } = render(<AnnualPlanAnalytics plan={runAnnualPlan(benchmark)} selectedYear={3} onYearChange={() => {}} />);
  expect(screen.getByRole('table', { name: 'Результаты и бюджет по годам' })).toBeTruthy();
  rerender(<AnnualPlanAnalytics plan={runAnnualPlan(benchmark.slice(1))} selectedYear={3} onYearChange={() => {}} />);
  expect(screen.queryByRole('table')).toBeNull();
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.getByText('Соберите план из пяти решений')).toBeTruthy();
});

it('updates Score, district indicators and advisor period together without losing the chosen year', () => {
  vi.stubGlobal('fetch', vi.fn());
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Эталон ТЗ' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Аналитика' }));
  const plan = runAnnualPlan(benchmark);
  expect(screen.getByRole('button', { name: 'Год 3 Конец 12-го квартала' }).getAttribute('aria-pressed')).toBe('true');
  const table = screen.getByRole('table', { name: 'Результаты и бюджет по годам' });
  const rows = within(table).getAllByRole('row').slice(1);
  expect(rows.map(row => within(row).getAllByRole('cell').slice(-3).map(cell => cell.textContent))).toEqual([
    ['95', '95', '5'], ['0', '95', '5'], ['0', '95', '5'],
  ]);
  for (const snapshot of plan.years) {
    fireEvent.click(screen.getByRole('button', { name: `Год ${snapshot.year} Конец ${snapshot.quarter}-го квартала` }));
    const details = within(screen.getByRole('region', { name: `Показатели на конец ${snapshot.year}-го года` }));
    expect(details.getByText(snapshot.simulation.finalScore!.toFixed(2).replace('.', ','))).toBeTruthy();
    const school = details.getByRole('article', { name: t(INDICATORS.S1.nameRu) });
    expect(within(school).getByText(snapshot.simulation.districts.nura.finalIndicators.S1.toFixed(1))).toBeTruthy();
    expect(screen.getByText(`Год анализа: ${snapshot.year}`)).toBeTruthy();
  }
  fireEvent.change(screen.getByLabelText('Направление анализа'), { target: { value: 'social' } });
  for (const language of ['en', 'kk', 'ru'] as const) {
    act(() => setLanguage(language));
    expect(screen.getByRole('button', { name: `${t('Год {0}', [3])} ${t('Конец {0}-го квартала', [12])}` }).getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByLabelText(t('Направление анализа')) as HTMLSelectElement).value).toBe('social');
  }
  fireEvent.click(screen.getByRole('tab', { name: 'Решения и бюджет' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Аналитика' }));
  expect(screen.getByRole('button', { name: 'Год 3 Конец 12-го квартала' }).getAttribute('aria-pressed')).toBe('true');
  expect(fetch).not.toHaveBeenCalled();
}, 15000);
