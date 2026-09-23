// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import CityDistrictMap from '../src/twin/CityDistrictMap';
import { initializeSession } from '../src/twin/model';
import { MAP_COLORS, mapColor, trafficProfile } from '../src/twin/mapData';

afterEach(cleanup);
it('preserves the exact requested slice and only changes to model data explicitly', () => {
  const { city, baseline } = initializeSession();
  const before = JSON.stringify(city);
  const select = vi.fn();
  render(<CityDistrictMap city={city} baseline={baseline} selected="nura" onSelect={select} active />);
  const expected = [['Сарыарка','79,6','-49'],['Байконур','128,6','0'],['Алматы','132,9','0'],['Сарайшык','132,9','0'],['Есиль','140,2','0'],['Нура','152','0']];
  expected.forEach(([name,value,delta]) => {
    const card = screen.getByRole('button', { name: `Район ${name}` });
    expect(within(card).getByText(value)).toBeTruthy();
    expect(within(card).getByText(`(${delta} к базе)`)).toBeTruthy();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Район Есиль' }));
  expect(select).toHaveBeenCalledWith('esil');
  fireEvent.click(screen.getByRole('button', { name: 'Текущий сценарий' }));
  expect(within(screen.getByRole('button', { name: 'Район Сарыарка' })).queryByText('79,6')).toBeNull();
  expect(JSON.stringify(city)).toBe(before);
  fireEvent.click(screen.getByRole('button', { name: 'Срез из задания' }));
  expect(within(screen.getByRole('button', { name: 'Район Сарыарка' })).getByText('79,6')).toBeTruthy();
});
it('uses the correct traffic boundaries and twice as many slower agents in Nura', () => {
  expect(mapColor(99.9,'transport')).toBe(MAP_COLORS.green);
  expect(mapColor(100,'transport')).toBe(MAP_COLORS.amber);
  expect(mapColor(140,'transport')).toBe(MAP_COLORS.amber);
  expect(mapColor(140.2,'transport')).toBe(MAP_COLORS.red);
  expect(trafficProfile(152).count).toBe(trafficProfile(79.6).count * 2);
  expect(trafficProfile(152).speed).toBeLessThan(trafficProfile(79.6).speed / 2);
});
it('supports layer menus, visualization settings and the WebGL fallback', () => {
  const { city, baseline } = initializeSession();
  render(<CityDistrictMap city={city} baseline={baseline} selected="nura" onSelect={() => {}} active />);
  expect(screen.getByText('Упрощённый вид · WebGL недоступен')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Нагрузка транспорта' }));
  fireEvent.click(screen.getByRole('button', { name: 'Экология' }));
  expect(screen.getByLabelText('Схематическая карта: Экология')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Настройки визуализации' }));
  const agents = screen.getByRole('checkbox', { name: 'Транспортные агенты' }) as HTMLInputElement;
  expect(agents.checked).toBe(true);
  fireEvent.click(agents); expect(agents.checked).toBe(false);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('checkbox', { name: 'Транспортные агенты' })).toBeNull();
});
