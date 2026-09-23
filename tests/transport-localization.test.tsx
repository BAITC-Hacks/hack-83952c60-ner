// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import TransportTwin from '../src/transport/TransportTwin';
import { Language, setLanguage, t } from '../src/i18n';
import type { Telemetry } from '../src/transport/scene';
import { SCENARIO_METRICS, type ScenarioId } from '../src/transport/simulation';

const scene = vi.hoisted(() => ({
  create: vi.fn(),
  controller: { setOptions: vi.fn(), reset: vi.fn(), dispose: vi.fn(), updateLanguage: vi.fn() },
}));
vi.mock('../src/transport/scene', () => ({
  createTransportScene: scene.create.mockImplementation(() => scene.controller),
}));
afterEach(() => { cleanup(); setLanguage('ru'); localStorage.clear(); vi.clearAllMocks(); });

it.each(['ru', 'kk', 'en'] as Language[])('renders transport controls, status and metrics in %s', language => {
  setLanguage(language);
  const html = renderToStaticMarkup(<TransportTwin />);
  expect(html).toContain(`lang="${language}"`);
  for (const label of ['Текущая ситуация', 'Новая развязка', 'Приоритет общественного транспорта', 'Умные светофоры', 'Средняя задержка', 'Собираем цифровой город…']) {
    expect(html).toContain(t(label));
  }
  if (language !== 'ru') {
    for (const label of ['Приоритет общественного транспорта', 'Умные светофоры']) expect(t(label)).not.toBe(label);
  }
  if (language === 'en') {
    expect(html.replace(/<[^>]*>/g, '').match(/[А-Яа-яЁё]+/g)).toBeNull();
    const labels = [...html.matchAll(/(?:aria-label|title)="([^"]*)"/g)].map(match => match[1]).join(' ');
    expect(labels.match(/[А-Яа-яЁё]+/g)).toBeNull();
  }
});

it('switches every scenario exclusively and resumes paused traffic without recreating the scene', async () => {
  render(<TransportTwin />);
  await waitFor(() => expect(scene.create).toHaveBeenCalledTimes(1));
  expect(scene.create.mock.calls[0][1]).toEqual(expect.objectContaining({ scenario: 'baseline', paused: false }));
  const scenarios: [ScenarioId, string][] = [
    ['baseline', 'Текущая ситуация'],
    ['interchange', 'Новая развязка'],
    ['transit', 'Приоритет общественного транспорта'],
    ['signals', 'Умные светофоры'],
  ];
  const scenarioButton = (title: string) => screen.getByRole('button', { name: new RegExp(title) });
  for (const next of ['transit', 'signals', 'interchange', 'baseline'] as ScenarioId[]) {
    fireEvent.click(screen.getByRole('button', { name: 'Приостановить симуляцию' }));
    expect(scene.controller.setOptions).toHaveBeenLastCalledWith(expect.objectContaining({ paused: true }));
    fireEvent.click(scenarioButton(scenarios.find(([id]) => id === next)![1]));
    for (const [id, title] of scenarios) expect(scenarioButton(title).getAttribute('aria-pressed')).toBe(String(id === next));
    expect(scene.controller.setOptions).toHaveBeenLastCalledWith(expect.objectContaining({ scenario: next, paused: false }));
    expect(screen.getByRole('button', { name: 'Приостановить симуляцию' })).toBeTruthy();
  }
  expect(scene.create).toHaveBeenCalledTimes(1);
  expect(scene.controller.dispose).not.toHaveBeenCalled();
});

it('resets an alternate scenario, paused simulation and close-up camera to the baseline view', async () => {
  render(<TransportTwin />);
  await waitFor(() => expect(scene.create).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: /Умные светофоры/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Крупный план' }));
  fireEvent.click(screen.getByRole('button', { name: 'Приостановить симуляцию' }));
  expect(scene.controller.setOptions).toHaveBeenLastCalledWith(expect.objectContaining({ scenario: 'signals', paused: true, view: 'junction' }));

  fireEvent.click(screen.getByRole('button', { name: 'Сбросить' }));
  expect(scene.controller.reset).toHaveBeenCalledTimes(1);
  expect(scene.controller.setOptions).toHaveBeenLastCalledWith(expect.objectContaining({ scenario: 'baseline', paused: false, view: 'orbit' }));
  expect(screen.getByRole('button', { name: /Текущая ситуация/ }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: /Умные светофоры/ }).getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByRole('button', { name: 'Орбитальный обзор' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: 'Приостановить симуляцию' })).toBeTruthy();
  expect(scene.create).toHaveBeenCalledTimes(1);
});

it('displays live metrics and transition status for scenarios without an interchange', async () => {
  render(<TransportTwin />);
  await waitFor(() => expect(scene.create).toHaveBeenCalledTimes(1));
  const onTelemetry = scene.create.mock.calls[0][2] as (value: Telemetry) => void;
  const publish = (metrics: Telemetry['metrics'], transitioning = false) => act(() => onTelemetry({
    blend: 0, metrics, transitioning, occupancy: [10, 24, 12], congestion: [0, 0, 0], fps: 60, elapsed: 3, completed: 1,
  }));
  const expectMetrics = (metrics: Telemetry['metrics']) => {
    const cards = screen.getAllByRole('article');
    const values = [
      Math.round(metrics.speed).toLocaleString('ru'),
      `+${Math.round(metrics.delay).toLocaleString('ru')}`,
      Math.round(metrics.throughput).toLocaleString('ru'),
      `+${metrics.impact.toLocaleString('ru', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
    ];
    values.forEach((value, index) => expect(within(cards[index]).getByText(value.replace(/\s+/g, ' '), { exact: true })).toBeTruthy());
  };
  expectMetrics(SCENARIO_METRICS.baseline);
  fireEvent.click(screen.getByRole('button', { name: /Приоритет общественного транспорта/ }));
  const intermediate = { ...SCENARIO_METRICS.baseline, speed: 19, delay: 36, throughput: 2350, impact: 2.3 };
  publish(intermediate, true);
  expectMetrics(intermediate);
  expect(screen.getByText('Агенты адаптируют маршруты…')).toBeTruthy();

  publish(SCENARIO_METRICS.transit);
  expectMetrics(SCENARIO_METRICS.transit);
  expect(screen.queryByText('Агенты адаптируют маршруты…')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Умные светофоры/ }));
  publish(SCENARIO_METRICS.signals);
  expectMetrics(SCENARIO_METRICS.signals);

  fireEvent.click(screen.getByRole('button', { name: 'Сбросить' }));
  expectMetrics(SCENARIO_METRICS.baseline);
  expect(scene.create).toHaveBeenCalledTimes(1);
});

it('switches open help and scene labels without recreating the scene, and restores the current-language title', async () => {
  setLanguage('en');
  const view = render(<TransportTwin />);
  await waitFor(() => expect(scene.create).toHaveBeenCalledTimes(1));
  expect(document.title).toBe('ASTANA · Transport digital twin');
  fireEvent.click(screen.getByRole('button', { name: 'Pause simulation' }));
  expect(screen.getByText('Simulation paused')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'About the model' }));
  expect(screen.getByRole('dialog').textContent).not.toMatch(/[А-Яа-яЁё]/);
  act(() => setLanguage('kk'));
  expect(screen.getByRole('dialog', { name: 'Өзгеріске жауап беретін қала' })).toBeTruthy();
  expect(document.querySelector('main')?.lang).toBe('kk');
  expect(document.title).toBe(t('ASTANA · Транспортный цифровой двойник'));
  expect(scene.controller.updateLanguage).toHaveBeenCalled();
  expect(scene.create).toHaveBeenCalledTimes(1);
  expect(scene.controller.dispose).not.toHaveBeenCalled();
  view.unmount();
  expect(scene.controller.dispose).toHaveBeenCalledTimes(1);
  expect(document.title).toBe('«5 сағатқа әкім»');
});
