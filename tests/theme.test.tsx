// @vitest-environment jsdom
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from '../src/components/ThemeToggle';
import { getTheme, setTheme, THEME_STORAGE_KEY } from '../src/theme';
import { setLanguage, t } from '../src/i18n';

beforeEach(() => {
  localStorage.clear();
  document.head.innerHTML = '<meta name="theme-color" content="#0a0f1d">';
  setTheme('dark');
  setLanguage('ru');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setTheme('dark');
  setLanguage('ru');
  localStorage.clear();
});

describe('appearance preference', () => {
  it('switches the whole document immediately and persists both choices', () => {
    render(<ThemeToggle />);
    const toggle = screen.getByRole('switch', { name: t('Светлая тема') });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(getTheme()).toBe('light');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#f4f7fb');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    fireEvent.click(toggle);
    expect(getTheme()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('keeps switches synchronized and localizes their accessible name instantly', () => {
    render(<><ThemeToggle /><ThemeToggle /></>);
    fireEvent.click(screen.getAllByRole('switch')[0]);
    act(() => setLanguage('kk'));
    expect(screen.getAllByRole('switch', { name: t('Светлая тема') })).toHaveLength(2);
    for (const toggle of screen.getAllByRole('switch')) {
      expect(toggle.getAttribute('aria-checked')).toBe('true');
      expect(toggle.textContent).toContain(t('Светлая'));
    }
  });

  it('still switches when browser storage rejects writes', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage disabled'); });
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('switch'));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  it('applies saved preferences before the app paints, including unavailable storage', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    expect(inlineScript).toBeTruthy();
    const boot = new Function(inlineScript!);
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    boot();
    expect(document.documentElement.dataset.theme).toBe('light');
    localStorage.setItem(THEME_STORAGE_KEY, 'invalid-preference');
    boot();
    expect(document.documentElement.dataset.theme).toBe('dark');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage disabled'); });
    expect(boot).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('restores the saved preference when the app module reloads', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    vi.resetModules();
    const reloaded = await import('../src/theme');
    expect(reloaded.getTheme()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
