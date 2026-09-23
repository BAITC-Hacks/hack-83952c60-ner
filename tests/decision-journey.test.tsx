// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from '../src/App';

afterEach(() => { cleanup(); localStorage.clear(); });

it('connects a district problem to applicable measures and preserves the target district', () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('Район для работы'), { target: { value: 'saryarka' } });
  const journey = screen.getByRole('region', { name: 'Путь решения' });
  fireEvent.click(within(journey).getByRole('button', { name: /Качество воздуха/ }));
  expect(screen.getByTestId('measure-M5')).toBeTruthy();
  expect(screen.queryByTestId('measure-M7')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Выбрать M5' }));
  expect((screen.getByLabelText('Район для M5') as HTMLSelectElement).value).toBe('saryarka');
  expect(within(journey).getByText(/Выбрано 1 из 5/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Показать все меры' }));
  expect(screen.getByTestId('measure-M7')).toBeTruthy();
});

it('reveals calculated consequences and the save/compare action only for a complete plan', () => {
  render(<App />);
  expect(screen.queryByRole('button', { name: 'Сохранить и сравнить варианты' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Эталон ТЗ' }));
  const journey = screen.getByRole('region', { name: 'Путь решения' });
  expect(within(journey).getByText(/Школы и детсады:.*→.*улучшение/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить и сравнить варианты' }));
  expect(screen.getByRole('dialog', { name: 'Сценарии' })).toBeTruthy();
});
