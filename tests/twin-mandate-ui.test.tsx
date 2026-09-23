// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import App from '../src/App';

afterEach(() => { cleanup(); localStorage.clear(); window.location.hash = ''; });
it('transfers the selected decisions, accepts once and restores them after reload', async () => {
  const view = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Эталон ТЗ' }));
  act(() => { window.location.hash = '#/digital-twin'; window.dispatchEvent(new HashChangeEvent('hashchange')); });
  const panel = await screen.findByRole('region', { name: 'Решения акима в городе' });
  expect(within(panel).getAllByRole('listitem')).toHaveLength(5);
  fireEvent.click(within(panel).getByRole('button', { name: 'Принять пять решений в городе' }));
  expect(within(panel).getByRole('status').textContent).toContain('Решения приняты в месяце 0');
  expect(within(panel).queryByRole('button', { name: 'Принять пять решений в городе' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Следующий месяц' }));
  view.unmount();
  render(<App />);
  expect(screen.getByTestId('twin-month').textContent).toContain('1 / 60');
  expect(within(screen.getByRole('region', { name: 'Решения акима в городе' })).getByRole('status').textContent).toContain('Решения приняты в месяце 0');
});
