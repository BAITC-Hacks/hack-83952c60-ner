import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLanguage, getLanguage, t, translate, Language } from '../src/i18n';
import catalog from '../src/i18n/catalog.json';
import App from '../src/App';
import { CompareModal } from '../src/components/CompareModal';
import { CrisisModal } from '../src/components/CrisisModal';
import { PresentationModal, buildPresentationReport } from '../src/components/PresentationModal';
import { runSimulation } from '../src/engine/simulator';
import { validateDecisions } from '../src/engine/validator';
import { askAICityAdvisor } from '../src/ai/llmClient';
import { generateAIAnalysis } from '../src/ai/analyzer';
import { SelectedDecision } from '../src/engine/types';
import { MEASURE_LIST } from '../src/data/measures';
import { DISTRICT_LIST } from '../src/data/districts';
import { CITY_EVENTS } from '../src/data/events';

const decisions: SelectedDecision[] = [
  {measureId:'M7',districtId:'nura'}, {measureId:'M8',districtId:'nura'},
  {measureId:'M10',districtId:'nura'}, {measureId:'M12'}, {measureId:'M5',districtId:'saryarka'},
];
const render = (element: React.ReactElement) => renderToStaticMarkup(element).replaceAll('&#x27;', "'").replaceAll('&amp;', '&').replaceAll('&quot;', '"');
afterEach(() => { setLanguage('ru'); vi.unstubAllGlobals(); });

describe('localization', () => {
  it('has both translations and preserves every interpolation parameter', () => {
    const tokens = (s: string) => [...s.matchAll(/\{\d+\}/g)].map(m => m[0]).sort();
    for (const [source, translations] of Object.entries(catalog)) {
      for (const language of ['kk','en'] as const) {
        expect(translations[language].trim(), source).not.toBe('');
        expect(tokens(translations[language]), source).toEqual(tokens(source));
      }
    }
  });

  it.each(['ru','kk','en'] as Language[])('switches all main panels and dialogs in %s without changing simulation numbers', language => {
    const original = runSimulation(decisions);
    setLanguage(language);
    const simulation = runSimulation(decisions);
    expect(simulation.finalScore).toBe(original.finalScore);
    expect(simulation.decisions).toEqual(decisions);
    const main = render(<App />);
    expect(main).toContain(t('«Аким на 5 часов»'));
    for (const measure of MEASURE_LIST) expect(main).toContain(t(measure.nameRu));
    const compare = render(<CompareModal isOpen onClose={() => {}} currentSim={simulation} onLoadScenario={() => {}} />);
    expect(compare).toContain(t('Эталон ТЗ (Benchmark Team)'));
    const crisis = render(<CrisisModal isOpen onClose={() => {}} activeEvents={CITY_EVENTS} onToggleEvent={() => {}} />);
    for (const event of CITY_EVENTS) expect(crisis).toContain(t(event.titleRu));
    const presentation = render(<PresentationModal isOpen onClose={() => {}} simulation={simulation} />);
    expect(presentation).toContain(t('Стратегия развития качества жизни в Астане'));
    const report = buildPresentationReport(simulation);
    expect(report).toContain(t(MEASURE_LIST[6].nameRu));
    expect(report).toContain(t(simulation.activeSynergies[0]));
    if (language === 'en') {
      const visible = (main + compare + crisis + presentation).replace(/<[^>]*>/g, '').replaceAll('Русский','').replaceAll('Қазақша','');
      expect(visible.match(/[А-Яа-яЁё]+/g)).toBeNull();
      expect(report.match(/[А-Яа-яЁё]+/g)).toBeNull();
    }
    const errors = validateDecisions([],language).errors;
    expect(errors[0]).toBe(translate('Требуется принять ровно {0} управленческих решений (сейчас выбрано: {1}).',language,[5,0]));
  });

  it('translates dynamic analysis and advisor questions in every language', async () => {
    const sim = runSimulation(decisions);
    for (const language of ['ru','kk','en'] as const) {
      const analysis = generateAIAnalysis(sim,language);
      expect(analysis.districtHighlights.map(d => d.district)).toEqual(DISTRICT_LIST.map(d => translate(d.nameRu,language)));
      const question = translate('Как использовать остаток бюджета?', language);
      const answer = await askAICityAdvisor(sim,question,{provider:'local',language});
      expect(answer).toContain(String(sim.validation.remainingBudget));
      if (language === 'en') expect(answer).not.toMatch(/[А-Яа-я]/);
      const nura = await askAICityAdvisor(sim,translate('Как поднять показатели Нуры?',language),{provider:'local',language});
      expect(nura).toContain('M7');
      expect(nura).toContain('M8');
      const synergies = await askAICityAdvisor(sim,translate('Какие синергии можно активировать?',language),{provider:'local',language});
      expect(synergies).toContain('M1');
      expect(synergies).toContain('M6');
    }
  });

  it('persists the choice and updates document language and title', () => {
    const storage = {setItem:vi.fn()};
    const document = {documentElement:{lang:''}, title:'', querySelector: () => null};
    vi.stubGlobal('localStorage',storage);
    vi.stubGlobal('document',document);
    setLanguage('kk');
    expect(getLanguage()).toBe('kk');
    expect(storage.setItem).toHaveBeenCalledWith('astana-language','kk');
    expect(document.documentElement.lang).toBe('kk');
    expect(document.title).toBe('«5 сағатқа әкім»');
    storage.setItem.mockImplementation(() => {throw new Error('disabled');});
    expect(() => setLanguage('en')).not.toThrow();
    expect(getLanguage()).toBe('en');
  });
});
