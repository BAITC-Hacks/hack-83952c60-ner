// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import App from '../src/App';
import { setLanguage } from '../src/i18n';
import { setTheme } from '../src/theme';

afterEach(() => { cleanup(); setLanguage('ru'); setTheme('dark'); localStorage.clear(); window.location.hash = ''; });

it('shows one workspace category and supports keyboard navigation without losing decisions', () => {
  render(<App />);
  const tabs = within(screen.getByRole('tablist', { name: 'Разделы планирования' }));
  expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  expect(screen.queryByRole('heading', { name: 'Транспортная карта Астаны' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Получить AI-анализ' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Выбрать M12' }));
  const decisions = tabs.getByRole('tab', { name: 'Решения и бюджет' });
  fireEvent.keyDown(decisions, { key: 'ArrowRight' });
  expect(screen.getByRole('heading', { name: 'Транспортная карта Астаны' })).toBeTruthy();
  expect(document.activeElement).toBe(tabs.getByRole('tab', { name: 'Карты города' }));
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
  expect(screen.getByRole('button', { name: 'Получить AI-анализ' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Транспортная карта Астаны' })).toBeNull();
  fireEvent.keyDown(document.activeElement!, { key: 'Home' });
  expect(decisions.getAttribute('aria-selected')).toBe('true');
  expect(screen.getByText('1/5')).toBeTruthy();
  expect(within(screen.getByTestId('measure-M12')).getByRole('button', { name: 'Убрать' })).toBeTruthy();
}, 10000);

it('preserves category and district selections while language and theme change', () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('Категория мер'), { target: { value: 'social' } });
  expect(screen.queryByTestId('measure-M1')).toBeNull();
  expect(screen.getByTestId('measure-M7')).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: 'Аналитика' }));
  fireEvent.change(screen.getByLabelText('Район для анализа'), { target: { value: 'almaty' } });
  fireEvent.click(screen.getByRole('switch', { name: 'Светлая тема' }));
  expect(document.documentElement.dataset.theme).toBe('light');
  act(() => setLanguage('en'));
  expect(screen.getByRole('tab', { name: 'Analytics' }).getAttribute('aria-selected')).toBe('true');
  fireEvent.click(screen.getByRole('tab', { name: 'Decisions & budget' }));
  expect((screen.getByLabelText('District to work on') as HTMLSelectElement).value).toBe('almaty');
  // A district change intentionally resets district-dependent measure filters.
  fireEvent.change(screen.getByLabelText('Measure category'), { target: { value: 'social' } });
  fireEvent.click(screen.getByRole('tab', { name: 'City maps' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Decisions & budget' }));
  expect((screen.getByLabelText('Measure category') as HTMLSelectElement).value).toBe('social');
}, 10000);
