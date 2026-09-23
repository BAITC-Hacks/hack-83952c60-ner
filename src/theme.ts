import { useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';
export const THEME_STORAGE_KEY = 'astana-theme';

function readTheme(): Theme {
  try { return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}

let theme: Theme = readTheme();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const getTheme = () => theme;
export const useTheme = () => useSyncExternalStore(subscribe, getTheme, getTheme);

function updateDocument() {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f4f7fb' : '#0a0f1d');
}

export function setTheme(next: Theme) {
  if (next !== 'dark' && next !== 'light') return;
  theme = next;
  try { localStorage.setItem(THEME_STORAGE_KEY, next); }
  catch { /* Keep the preference usable when browser storage is disabled. */ }
  updateDocument();
  listeners.forEach(listener => listener());
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    theme = readTheme();
    updateDocument();
    listeners.forEach(listener => listener());
  });
}
updateDocument();
