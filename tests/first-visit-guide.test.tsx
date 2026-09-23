// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import App from '../src/App';
import { setLanguage } from '../src/i18n';
import { GUIDE_STORAGE_KEY } from '../src/onboarding/useFirstVisitGuide';
import { DRAFT_STORAGE_KEY, STORAGE_VERSION } from '../src/scenarios/storage';

afterEach(() => { cleanup(); vi.restoreAllMocks(); setLanguage('ru'); localStorage.clear(); window.location.hash = ''; });

const guide = () => document.querySelector<HTMLElement>('.first-visit-guide')!;

it('guides real district/problem/measure choices into analytics, persists completion and can replay without clearing the plan', () => {
  const view = render(<App />);
  expect(guide().dataset.guideStep).toBe('district');
  fireEvent.change(screen.getByLabelText('Район для работы'), { target: { value: 'saryarka' } });
  fireEvent.click(within(guide()).getByRole('button', { name: 'Продолжить с районом Сарыарка' }));
  expect(guide().dataset.guideStep).toBe('problem');
  expect(document.activeElement).toBe(within(guide()).getByRole('heading'));
  expect((within(guide()).getByRole('button', { name: 'К подбору мер' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(within(screen.getByRole('region', { name: 'Путь решения' })).getByRole('button', { name: /Качество воздуха/ }));
  fireEvent.click(within(guide()).getByRole('button', { name: 'К подбору мер' }));
  expect(guide().dataset.guideStep).toBe('measures');
  expect((within(guide()).getByRole('button', { name: 'Посмотреть результат' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Выбрать M5' }));
  expect((screen.getByLabelText('Район для M5') as HTMLSelectElement).value).toBe('saryarka');
  fireEvent.click(screen.getByRole('button', { name: 'Показать все меры' }));
  for (const id of ['M7', 'M8', 'M10', 'M12']) fireEvent.click(screen.getByRole('button', { name: `Выбрать ${id}` }));
  fireEvent.click(within(guide()).getByRole('button', { name: 'Посмотреть результат' }));
  expect(guide().dataset.guideStep).toBe('review');
  expect(screen.getByRole('tab', { name: 'Аналитика' }).getAttribute('aria-selected')).toBe('true');
  fireEvent.click(within(guide()).getByRole('button', { name: 'Назад' }));
  expect(guide().dataset.guideStep).toBe('measures');
  expect(screen.getByText('5/5')).toBeTruthy();
  fireEvent.click(within(guide()).getByRole('button', { name: 'Посмотреть результат' }));
  fireEvent.click(within(guide()).getByRole('button', { name: 'Завершить знакомство' }));
  expect(guide()).toBeNull();
  expect(localStorage.getItem(GUIDE_STORAGE_KEY)).toBe('complete');
  view.unmount();
  render(<App />);
  expect(guide()).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Как начать' }));
  expect(guide().dataset.guideStep).toBe('district');
  expect(screen.getByText('5/5')).toBeTruthy();
  expect((screen.getByLabelText('Район для работы') as HTMLSelectElement).value).toBe('saryarka');
}, 15000);

it('remembers skip, resumes from another tab, and switches language during a guide', () => {
  const view = render(<App />);
  fireEvent.click(screen.getByRole('tab', { name: 'Карты города' }));
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить знакомство' }));
  expect(screen.getByRole('tab', { name: 'Решения и бюджет' }).getAttribute('aria-selected')).toBe('true');
  act(() => setLanguage('en'));
  expect(within(guide()).getByRole('heading', { name: 'Choose a district' })).toBeTruthy();
  act(() => setLanguage('kk'));
  expect(within(guide()).getByRole('heading', { name: 'Ауданды таңдаңыз' })).toBeTruthy();
  fireEvent.click(within(guide()).getByRole('button', { name: 'Танысуды өткізіп жіберу' }));
  expect(localStorage.getItem(GUIDE_STORAGE_KEY)).toBe('skipped');
  view.unmount();
  render(<App />);
  expect(guide()).toBeNull();
});

it('does not interrupt an existing saved draft', () => {
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, draft: { decisions: [{ measureId: 'M12' }], selectedDistrictId: 'almaty' } }));
  render(<App />);
  expect(guide()).toBeNull();
  expect(screen.getByText('1/5')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Как начать' }));
  expect(guide()).toBeTruthy();
  expect((screen.getByLabelText('Район для работы') as HTMLSelectElement).value).toBe('almaty');
});

it('can skip and reopen when browser storage is blocked', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  render(<App />);
  fireEvent.click(within(guide()).getByRole('button', { name: 'Пропустить знакомство' }));
  expect(guide()).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Как начать' }));
  expect(guide().dataset.guideStep).toBe('district');
});
