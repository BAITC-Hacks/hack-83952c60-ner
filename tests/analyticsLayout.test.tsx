// @vitest-environment jsdom
import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RadarAnalytics } from '../src/components/RadarAnalytics';
import { runSimulation } from '../src/engine/simulator';
import { DistrictId } from '../src/engine/types';
import { setLanguage, t } from '../src/i18n';
import { INDICATORS, DIRECTION_LIST } from '../src/data/indicators';

beforeEach(() => setLanguage('en'));
afterEach(() => { cleanup(); setLanguage('ru'); });

const simulation = () => {
  const result = runSimulation([]);
  result.districts.nura.initialIndicators.T1 = 60;
  result.districts.nura.finalIndicators.T1 = 0;
  result.districts.esil.initialIndicators.T1 = 70;
  result.districts.esil.finalIndicators.T1 = 81.4;
  return result;
};

describe('grouped district analytics', () => {
  it('shows five directions, then filters to the two indicators in a selected category', () => {
    render(<RadarAnalytics simulation={simulation()} selectedDistrictId="nura" />);
    expect(screen.getAllByRole('article')).toHaveLength(10);
    for (const direction of DIRECTION_LIST) {
      expect(screen.getByRole('heading', { name: t(direction.nameRu), level: 4 })).toBeTruthy();
    }

    const filter = screen.getByRole('combobox', { name: 'Analysis category' });
    fireEvent.change(filter, { target: { value: 'ecology' } });
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByRole('article', { name: t(INDICATORS.E1.nameRu) })).toBeTruthy();
    expect(screen.getByRole('article', { name: t(INDICATORS.E2.nameRu) })).toBeTruthy();
    expect(screen.queryByRole('article', { name: t(INDICATORS.T1.nameRu) })).toBeNull();
    fireEvent.change(filter, { target: { value: 'all' } });
    expect(screen.getAllByRole('article')).toHaveLength(10);
  });

  it('preserves a zero result and displays baseline, result, and the negative change', () => {
    render(<RadarAnalytics simulation={simulation()} selectedDistrictId="nura" />);
    const road = screen.getByRole('article', { name: t(INDICATORS.T1.nameRu) });
    expect(within(road).getByText('60.0')).toBeTruthy();
    expect(within(road).getByText('0.0')).toBeTruthy();
    expect(within(road).getByText('-60.0')).toBeTruthy();
    expect(within(road).getByText('Critical level')).toBeTruthy();
  });

  it('changes districts independently of the map and notifies the shared selection', () => {
    const onSelect = vi.fn();
    const result = simulation();
    function ConnectedAnalytics() {
      const [district, setDistrict] = useState<DistrictId>('nura');
      return <RadarAnalytics simulation={result} selectedDistrictId={district} onSelectDistrict={next => { onSelect(next); setDistrict(next); }} />;
    }
    render(<ConnectedAnalytics />);
    fireEvent.change(screen.getByRole('combobox', { name: 'District to analyze' }), { target: { value: 'esil' } });
    expect(onSelect).toHaveBeenCalledWith('esil');
    const road = screen.getByRole('article', { name: t(INDICATORS.T1.nameRu) });
    expect(within(road).getByText('70.0')).toBeTruthy();
    expect(within(road).getByText('81.4')).toBeTruthy();
    expect(within(road).getByText('+11.4')).toBeTruthy();
    expect(within(road).queryByText('Critical level')).toBeNull();
  });

  it('keeps the category and district while labels switch languages', () => {
    render(<RadarAnalytics simulation={simulation()} selectedDistrictId="nura" />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Analysis category' }), { target: { value: 'transport' } });
    for (const language of ['kk', 'ru', 'en'] as const) {
      act(() => setLanguage(language));
      expect(screen.getByRole('heading', { name: t('Показатели по направлениям') })).toBeTruthy();
      expect((screen.getByRole('combobox', { name: t('Направление анализа') }) as HTMLSelectElement).value).toBe('transport');
      expect((screen.getByRole('combobox', { name: t('Район для анализа') }) as HTMLSelectElement).value).toBe('nura');
      expect(screen.getAllByRole('article')).toHaveLength(2);
      const road = screen.getByRole('article', { name: t(INDICATORS.T1.nameRu) });
      expect(within(road).getByText('-60.0')).toBeTruthy();
    }
  });
});
