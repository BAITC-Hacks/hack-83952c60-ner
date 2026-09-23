// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChartTooltip } from '../src/components/ChartTooltip';
import { RadarAnalytics } from '../src/components/RadarAnalytics';
import { ScoreDashboard } from '../src/components/ScoreDashboard';
import { setLanguage, t } from '../src/i18n';
import { runSimulation } from '../src/engine/simulator';
import { INDICATORS } from '../src/data/indicators';

function pointer(element: Element, type: string, pointerType = 'mouse', x = 20, y = 20) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { pointerType, clientX: x, clientY: y });
  fireEvent(element, event);
}

beforeEach(() => setLanguage('en'));
afterEach(() => { cleanup(); setLanguage('ru'); vi.useRealTimers(); });

describe('short chart explanations', () => {
  it('opens on hover, remains hoverable, and dismisses on Escape', () => {
    vi.useFakeTimers();
    render(<ChartTooltip label="City chart" description="Scenario 60; baseline 50."><svg aria-hidden="true" /></ChartTooltip>);
    const chart = screen.getByRole('group', { name: 'City chart' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    pointer(chart, 'pointerover');
    expect(screen.getByRole('tooltip').textContent).toBe('Scenario 60; baseline 50.');
    expect(chart.getAttribute('aria-describedby')).toBe(screen.getByRole('tooltip').id);
    pointer(chart, 'pointerout');
    pointer(screen.getByRole('tooltip'), 'pointerover');
    act(() => vi.advanceTimersByTime(150));
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(chart.getAttribute('aria-describedby')).toBeNull();
  });

  it('supports keyboard focus and toggling without moving focus', () => {
    render(<ChartTooltip label="City chart" description="A short explanation."><svg aria-hidden="true" /></ChartTooltip>);
    const chart = screen.getByRole('group', { name: 'City chart' });
    act(() => chart.focus());
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.keyDown(chart, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(document.activeElement).toBe(chart);
    fireEvent.keyDown(chart, { key: 'Enter' });
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.keyDown(chart, { key: ' ' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.keyDown(chart, { key: 'Enter' });
    act(() => chart.blur());
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('supports tapping and outside dismissal without treating a swipe as a tap', () => {
    render(<><ChartTooltip label="City chart" description="A short explanation."><svg aria-hidden="true" /></ChartTooltip><button>Elsewhere</button></>);
    const chart = screen.getByRole('group', { name: 'City chart' });
    pointer(chart, 'pointerdown', 'touch');
    pointer(chart, 'pointerup', 'touch');
    expect(screen.getByRole('tooltip')).toBeTruthy();
    pointer(chart, 'pointerdown', 'touch');
    pointer(chart, 'pointerup', 'touch');
    expect(screen.queryByRole('tooltip')).toBeNull();
    pointer(chart, 'pointerdown', 'touch');
    pointer(chart, 'pointerup', 'touch', 70, 20);
    expect(screen.queryByRole('tooltip')).toBeNull();
    pointer(chart, 'pointerdown', 'touch');
    pointer(chart, 'pointerup', 'touch');
    pointer(screen.getByRole('button', { name: 'Elsewhere' }), 'pointerdown');
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('keeps and repositions a focused tooltip after automatic scrolling, closing when the chart leaves view', () => {
    render(<ChartTooltip label="City chart" description="A short explanation."><svg aria-hidden="true" /></ChartTooltip>);
    const chart = screen.getByRole('group', { name: 'City chart' });
    let chartTop = 1000;
    vi.spyOn(chart, 'getBoundingClientRect').mockImplementation(() => new DOMRect(20, chartTop, 200, 80));
    act(() => chart.focus());
    const bubble = screen.getByRole('tooltip');
    vi.spyOn(bubble, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 180, 44));

    // Browser focus brings a below-fold chart into view and then emits scroll.
    chartTop = 200;
    fireEvent.scroll(window);
    expect(screen.getByRole('tooltip')).toBe(bubble);
    expect(bubble.style.top).toBe('148px');
    expect(document.activeElement).toBe(chart);

    chartTop = -100;
    fireEvent.scroll(window);
    expect(screen.queryByRole('tooltip')).toBeNull();

    act(() => chart.blur());
    chartTop = 200;
    pointer(chart, 'pointerover');
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.scroll(window);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('uses actual indicator values, including zero, and updates an open explanation with the language', () => {
    const simulation = runSimulation([]);
    simulation.districts.nura.initialIndicators.T1 = 60;
    simulation.districts.nura.finalIndicators.T1 = 0;
    render(<RadarAnalytics simulation={simulation} selectedDistrictId="nura" />);
    act(() => screen.getByRole('group', { name: t(INDICATORS.T1.nameRu) }).focus());
    expect(screen.getByRole('tooltip').textContent).toBe('Before: 60.0; after: 0.0; change: -60.0. Below 40 is critical.');
    for (const language of ['kk', 'ru', 'en'] as const) {
      act(() => setLanguage(language));
      expect(screen.getByRole('tooltip').textContent).toBe(t('До: {0}; после: {1}; изменение: {2}. Ниже 40 — критический уровень.', ['60.0', '0.0', '-60.0']));
    }
  });

  it('explains why an incomplete scenario has no final score', () => {
    const simulation = runSimulation([]);
    render(<ScoreDashboard simulation={simulation} />);
    act(() => screen.getByRole('group', { name: t('Astana Quality of Life Score') }).focus());
    expect(screen.getByRole('tooltip').textContent).toBe(`The score appears after five valid decisions. Baseline: ${simulation.baseScore.toFixed(2)}.`);
  });
});
