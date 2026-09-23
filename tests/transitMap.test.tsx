// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AstanaTransitMap } from '../src/components/AstanaTransitMap';
import { transitMap } from '../src/data/transitMap';
import { setLanguage, t } from '../src/i18n';

beforeEach(() => { setLanguage('ru'); });
afterEach(() => { cleanup(); setLanguage('ru'); localStorage.clear(); });

const picker = () => screen.getByRole('combobox', { name: t('Выбрать остановку') }) as HTMLSelectElement;
const map = () => screen.getByRole('img', { name: t('Карта линий LRT и автобусных остановок Астаны') });
const details = (container: HTMLElement) => container.querySelector('.transit-map__detail') as HTMLElement;

describe('Astana transit map', () => {
  it('toggles layers independently and clears a selection when its layer is hidden', () => {
    const { container } = render(<AstanaTransitMap />);
    const station = transitMap.lrtStations[0];
    fireEvent.change(picker(), { target: { value: `lrt:${station.id}` } });
    expect(within(details(container)).getByText(station.names.ru)).toBeTruthy();

    const lrtToggle = screen.getByRole('button', { name: /Линия LRT/ });
    fireEvent.click(lrtToggle);
    expect(lrtToggle.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByTestId('transit-lrt-layer')).toBeNull();
    expect(screen.getByTestId('transit-bus-layer')).toBeTruthy();
    expect(picker().value).toBe('');
    expect(within(details(container)).queryByText(station.names.ru)).toBeNull();
    expect([...picker().options].some(option => option.value.startsWith('lrt:'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /Автобусные остановки/ }));
    expect(screen.queryByTestId('transit-bus-layer')).toBeNull();
    expect(screen.getByText('Включите слой, чтобы увидеть остановки')).toBeTruthy();
    fireEvent.click(lrtToggle);
    expect(screen.getByTestId('transit-lrt-layer')).toBeTruthy();
    expect(screen.queryByText('Включите слой, чтобы увидеть остановки')).toBeNull();
  });

  it('finds bus stops by another language, selects one, and handles no search results', () => {
    const { container } = render(<AstanaTransitMap />);
    const stop = transitMap.busStops[0];
    const search = screen.getByRole('searchbox', { name: 'Найти остановку' }) as HTMLInputElement;
    fireEvent.change(search, { target: { value: stop.names.en } });
    expect([...picker().options].some(option => option.value === `bus:${stop.id}`)).toBe(true);
    fireEvent.change(picker(), { target: { value: `bus:${stop.id}` } });
    expect(within(details(container)).getByText(stop.names.ru)).toBeTruthy();
    expect(within(details(container)).getByText('Автобусная остановка')).toBeTruthy();
    expect(search.value).toBe('');
    expect(picker().value).toBe(`bus:${stop.id}`);

    fireEvent.change(search, { target: { value: 'no-stop-with-this-name-938251' } });
    expect(picker().options).toHaveLength(1);
    expect(picker().options[0].text).toBe('Остановки не найдены');
    fireEvent.change(search, { target: { value: '' } });
    expect(picker().value).toBe(`bus:${stop.id}`);
    fireEvent.click(screen.getByRole('button', { name: /Автобусные остановки/ }));
    expect(within(details(container)).queryByText(stop.names.ru)).toBeNull();
  });

  it('zooms within bounds and restores the complete city extent', () => {
    render(<AstanaTransitMap />);
    const initialView = map().getAttribute('viewBox');
    const zoomIn = screen.getByRole('button', { name: 'Увеличить карту' }) as HTMLButtonElement;
    const zoomOut = screen.getByRole('button', { name: 'Уменьшить карту' }) as HTMLButtonElement;
    expect(zoomOut.disabled).toBe(true);
    fireEvent.click(zoomIn);
    expect(map().getAttribute('viewBox')).not.toBe(initialView);
    expect(zoomOut.disabled).toBe(false);
    for (let index = 0; index < 5; index++) fireEvent.click(zoomIn);
    expect(zoomIn.disabled).toBe(true);
    expect(screen.getByText('400%')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Показать всю карту' }));
    expect(map().getAttribute('viewBox')).toBe(initialView);
    expect(zoomIn.disabled).toBe(false);
    expect(zoomOut.disabled).toBe(true);
  });

  it('changes the selected station and controls instantly in all three languages', () => {
    const { container } = render(<AstanaTransitMap />);
    const station = transitMap.lrtStations.find(stop => stop.names.ru !== stop.names.en) ?? transitMap.lrtStations[0];
    fireEvent.change(picker(), { target: { value: `lrt:${station.id}` } });
    const selectedView = map().getAttribute('viewBox');

    for (const language of ['en', 'kk', 'ru'] as const) {
      act(() => setLanguage(language));
      expect(screen.getByRole('heading', { name: t('Транспортная карта Астаны') })).toBeTruthy();
      expect(within(details(container)).getByText(station.names[language])).toBeTruthy();
      expect(within(details(container)).getByText(t('Станция LRT'))).toBeTruthy();
      expect(picker().value).toBe(`lrt:${station.id}`);
      expect(map().getAttribute('viewBox')).toBe(selectedView);
      expect(screen.getByRole('button', { name: t('Увеличить карту') })).toBeTruthy();
      if (language === 'en') expect(screen.getByRole('heading', { name: 'Astana transit map' })).toBeTruthy();
      if (language === 'kk') expect(screen.getByRole('heading', { name: 'Астананың көлік картасы' })).toBeTruthy();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть информацию об остановке' }));
    expect(picker().value).toBe('');
    expect(within(details(container)).getByText('Город в движении')).toBeTruthy();
  });
});
