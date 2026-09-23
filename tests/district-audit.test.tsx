// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import CityDistrictMap from '../src/twin/CityDistrictMap';
import { initializeSession } from '../src/twin/model';

const schoolsName = '+ 2 школы шаговой доступности (−15 млрд ₸)';
const hubName = '+ Сервисный хаб / АЗС на окраине (−5 млрд ₸)';
const schoolPinName = 'Построено: 2 школы шаговой доступности';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup() {
  const session = initializeSession();
  const select = vi.fn();
  render(<CityDistrictMap city={session.city} baseline={session.baseline} selected="nura" onSelect={select} active />);
  return { ...session, select };
}

function focusDistrict(name = 'Нура') {
  fireEvent.click(screen.getByRole('button', { name: `Район ${name}` }));
  return screen.getByRole('complementary', { name: `Аудит района ${name}` });
}

it('keeps keyboard focus on map popups while a district audit is open', () => {
  setup();
  const audit = focusDistrict();
  expect(document.activeElement).toBe(audit);
  const settings = screen.getByRole('button', { name: 'Настройки визуализации' });
  settings.focus();
  fireEvent.click(settings);
  expect(document.activeElement).toBe(settings);
  expect(settings.getAttribute('aria-expanded')).toBe('true');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(settings.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(settings);
  expect(screen.getByRole('complementary', { name: 'Аудит района Нура' })).toBe(audit);

  const layers = screen.getByRole('button', { name: 'Нагрузка транспорта' });
  layers.focus();
  fireEvent.click(layers);
  expect(document.activeElement).toBe(layers);
  fireEvent.click(screen.getByRole('button', { name: 'Экология' }));
  expect(document.activeElement).toBe(layers);
  expect(layers.getAttribute('aria-expanded')).toBe('false');
});

it('explains each audit bar with its current value and improvement direction', () => {
  setup();
  const audit = focusDistrict();
  for (const [label, value, direction] of [
    ['Дефицит школьных мест', '65%', 'Меньше — лучше'],
    ['Рабочие места шаговой доступности', '22%', 'Больше — лучше'],
    ['Доступность АЗС и сервисных хабов', '40%', 'Больше — лучше'],
  ]) {
    const indicator = within(audit).getByRole('group', { name: label });
    act(() => indicator.focus());
    expect(screen.getByRole('tooltip').textContent).toContain(value);
    expect(screen.getByRole('tooltip').textContent).toContain(direction);
  }
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).toBeNull();
  expect(screen.getByRole('complementary', { name: 'Аудит района Нура' })).toBe(audit);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('complementary', { name: 'Аудит района Нура' })).toBeNull();
});

it('opens an audit on selection and allows closing or resetting focus without changing the supplied selection', () => {
  const { select } = setup();
  expect(screen.queryByRole('complementary', { name: 'Аудит района Нура' })).toBeNull();

  focusDistrict();
  expect(select).toHaveBeenCalledWith('nura');
  fireEvent.click(screen.getByRole('button', { name: 'Закрыть аудит района' }));
  expect(screen.queryByRole('complementary', { name: 'Аудит района Нура' })).toBeNull();

  focusDistrict();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('complementary', { name: 'Аудит района Нура' })).toBeNull();

  focusDistrict();
  fireEvent.click(screen.getByRole('button', { name: 'Сбросить фокус' }));
  expect(screen.queryByRole('complementary', { name: 'Аудит района Нура' })).toBeNull();
  expect(select.mock.calls).toEqual([['nura'], ['nura'], ['nura']]);
});

it('makes the fallback district polygons keyboard accessible', () => {
  const { select } = setup();
  const nura = screen.getByRole('button', { name: 'Открыть аудит района Нура' });
  expect(nura.getAttribute('tabindex')).toBe('0');
  fireEvent.keyDown(nura, { key: 'Enter' });
  expect(screen.getByRole('complementary', { name: 'Аудит района Нура' })).toBeTruthy();
  expect(select).toHaveBeenLastCalledWith('nura');

  fireEvent.keyDown(document, { key: 'Escape' });
  const esil = screen.getByRole('button', { name: 'Открыть аудит района Есиль' });
  fireEvent.keyDown(esil, { key: ' ' });
  expect(screen.getByRole('complementary', { name: 'Аудит района Есиль' })).toBeTruthy();
  expect(select).toHaveBeenLastCalledWith('esil');
});

it('previews schools once, reduces the school commute, and preserves the simulation inputs', async () => {
  const { city, baseline } = setup();
  const originalCity = JSON.stringify(city);
  const originalBaseline = JSON.stringify(baseline);
  const audit = focusDistrict();
  expect(screen.getByLabelText('Бюджет эксперимента').textContent).toContain('60');
  const buildSchools = within(audit).getByRole('button', { name: schoolsName }) as HTMLButtonElement;
  fireEvent.click(buildSchools);

  expect(screen.getByRole('img', { name: schoolPinName })).toBeTruthy();
  expect(Number(screen.getByTestId('migration-schools').getAttribute('data-remaining'))).toBe(0.35);
  expect(screen.getAllByRole('status').some(status => status.textContent?.includes('Транзитный трафик через мосты снижен на 24%'))).toBe(true);
  const card = screen.getByRole('button', { name: 'Район Нура' });
  expect(await within(card).findByText('118')).toBeTruthy();
  expect(within(card).getByText('(-34 к базе)')).toBeTruthy();
  expect(screen.getByLabelText('Бюджет эксперимента').textContent).toContain('45');
  expect(buildSchools.disabled).toBe(true);

  fireEvent.click(buildSchools);
  expect(screen.getByLabelText('Бюджет эксперимента').textContent).toContain('45');
  expect(screen.getAllByRole('img', { name: schoolPinName })).toHaveLength(1);
  expect(JSON.stringify(city)).toBe(originalCity);
  expect(JSON.stringify(baseline)).toBe(originalBaseline);
});

it('keeps completed decisions across focus changes and isolates them by district', async () => {
  setup();
  const nuraAudit = focusDistrict();
  fireEvent.click(within(nuraAudit).getByRole('button', { name: schoolsName }));
  await within(screen.getByRole('button', { name: 'Район Нура' })).findByText('118');
  fireEvent.click(screen.getByRole('button', { name: 'Сбросить фокус' }));

  const esilAudit = focusDistrict('Есиль');
  expect((within(esilAudit).getByRole('button', { name: schoolsName }) as HTMLButtonElement).disabled).toBe(false);
  expect(within(screen.getByRole('button', { name: 'Район Есиль' })).getByText('140,2')).toBeTruthy();

  const reopenedNura = focusDistrict();
  expect((within(reopenedNura).getByRole('button', { name: schoolsName }) as HTMLButtonElement).disabled).toBe(true);
  expect(within(screen.getByRole('button', { name: 'Район Нура' })).getByText('118')).toBeTruthy();
  expect(screen.getByLabelText('Бюджет эксперимента').textContent).toContain('45');
});

it('charges the service hub once and restores all preview decisions on reset', async () => {
  setup();
  const audit = focusDistrict();
  const hub = within(audit).getByRole('button', { name: hubName }) as HTMLButtonElement;
  fireEvent.click(hub);
  expect(hub.disabled).toBe(true);
  expect(screen.getByLabelText('Бюджет эксперимента').textContent).toContain('55');
  fireEvent.click(hub);
  expect(screen.getByLabelText('Бюджет эксперимента').textContent).toContain('55');

  fireEvent.click(within(audit).getByRole('button', { name: schoolsName }));
  expect(screen.getByLabelText('Бюджет эксперимента').textContent).toContain('40');
  fireEvent.click(screen.getByRole('button', { name: 'Сбросить решения' }));
  expect(screen.getByLabelText('Бюджет эксперимента').textContent).toContain('60');
  expect((within(audit).getByRole('button', { name: schoolsName }) as HTMLButtonElement).disabled).toBe(false);
  expect((within(audit).getByRole('button', { name: hubName }) as HTMLButtonElement).disabled).toBe(false);
  expect(screen.queryByRole('img', { name: schoolPinName })).toBeNull();
  await waitFor(() => expect(within(screen.getByRole('button', { name: 'Район Нура' })).getByText('152')).toBeTruthy());
  expect(Number(screen.getByTestId('migration-schools').getAttribute('data-remaining'))).toBe(1);
});

it('applies school feedback with reduced motion enabled', async () => {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
  setup();
  const audit = focusDistrict();
  fireEvent.click(within(audit).getByRole('button', { name: schoolsName }));
  expect(await within(screen.getByRole('button', { name: 'Район Нура' })).findByText('118')).toBeTruthy();
  expect(screen.getByRole('img', { name: schoolPinName })).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Возобновить анимацию карты' }) as HTMLButtonElement).disabled).toBe(true);
});
