// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import TransportTwin from '../src/transport/TransportTwin';
import { Language, setLanguage, t } from '../src/i18n';

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
  for (const label of ['Текущая ситуация', 'Новая развязка', 'Средняя задержка', 'Собираем цифровой город…']) {
    expect(html).toContain(t(label));
  }
  if (language === 'en') {
    expect(html.replace(/<[^>]*>/g, '').match(/[А-Яа-яЁё]+/g)).toBeNull();
    const labels = [...html.matchAll(/(?:aria-label|title)="([^"]*)"/g)].map(match => match[1]).join(' ');
    expect(labels.match(/[А-Яа-яЁё]+/g)).toBeNull();
  }
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
