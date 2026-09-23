import { useSyncExternalStore } from 'react';
import messages from './catalog.json';

export type Language = 'ru' | 'kk' | 'en';
export const languages: { code: Language; label: string }[] = [
  { code: 'ru', label: 'Русский' },
  { code: 'kk', label: 'Қазақша' },
  { code: 'en', label: 'English' },
];
const catalog: Record<string, { en: string; kk: string }> = messages;
const russianLabels: Record<string, string> = {
  'Score': 'Балл',
  'Astana Quality of Life Score': 'Индекс качества жизни Астаны',
  'Astana QoL Score': 'Индекс качества жизни Астаны',
};
const storageKey = 'astana-language';
let language: Language = 'ru';
try {
  const saved = localStorage.getItem(storageKey);
  if (saved === 'ru' || saved === 'kk' || saved === 'en') language = saved;
} catch { /* Storage may be unavailable in private browsing. */ }
const listeners = new Set<() => void>();
export const getLanguage = () => language;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const useLanguage = () => useSyncExternalStore(subscribe, getLanguage, getLanguage);

export function translate(source: string, locale: Language, params: readonly unknown[] = []): string {
  const text = locale === 'ru'
    ? (Object.hasOwn(russianLabels, source) ? russianLabels[source] : source)
    : (Object.hasOwn(catalog, source) ? catalog[source][locale] : source);
  return text.replace(/\{(\d+)\}/g, (match, index) => {
    if (Number(index) >= params.length) return match;
    const value = params[Number(index)];
    return typeof value === 'string' ? translate(value, locale) : String(value ?? '');
  });
}
export const t = (source: string, params: readonly unknown[] = []) => translate(source, language, params);

function updateDocument() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language;
  document.title = t('«Аким на 5 часов»');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('Интеллектуальная система распределения бюджета и расчета Astana Quality of Life Score'));
}
export function setLanguage(next: Language) {
  if (!languages.some(item => item.code === next)) return;
  language = next;
  try { localStorage.setItem(storageKey, next); } catch { /* Keep in-memory switching working. */ }
  updateDocument();
  listeners.forEach(listener => listener());
}
updateDocument();
