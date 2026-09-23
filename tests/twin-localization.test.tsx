import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it } from 'vitest';
import DigitalTwin from '../src/twin/DigitalTwin';
import { Language, setLanguage, t } from '../src/i18n';
import { DIRECTIONS, PROJECTS } from '../src/twin/model';
import { MEASURES } from '../src/data/measures';
import { SelectedDecision } from '../src/engine/types';

const decisions: SelectedDecision[] = [
  { measureId: 'M7', districtId: 'nura' }, { measureId: 'M8', districtId: 'nura' },
  { measureId: 'M10', districtId: 'nura' }, { measureId: 'M12' }, { measureId: 'M5', districtId: 'saryarka' },
];
afterEach(() => setLanguage('ru'));

it.each(['ru', 'kk', 'en'] as Language[])('renders all twin categories and selected decisions in %s', language => {
  setLanguage(language);
  const html = renderToStaticMarkup(<DigitalTwin decisions={decisions} />)
    .replaceAll('&amp;', '&').replaceAll('&#x27;', "'").replaceAll('&quot;', '"');
  const text = html.replace(/<[^>]*>/g, '');
  for (const section of ['city', 'budget', 'scenarios']) expect(html).toContain(`id="twin-workspace-panel-${section}"`);
  for (const direction of DIRECTIONS) expect(text).toContain(t(PROJECTS[direction].name));
  for (const decision of decisions) expect(text).toContain(t(MEASURES[decision.measureId].nameRu));
  expect(text).toContain(t('Финансирование городских систем'));
  expect(text).toContain(t('Мои сценарии'));
  expect(text).toContain(t('Как устроена модель'));
  expect(text).toContain(t('Расход при принятии: {0} у.е. Доступно: {1} у.е.', [950, (2400).toLocaleString(language)]));
  if (language === 'en') {
    expect(text.match(/[А-Яа-яЁё]+/g)).toBeNull();
    const accessibleLabels = [...html.matchAll(/(?:aria-label|placeholder)="([^"]*)"/g)].map(match => match[1]).join(' ');
    expect(accessibleLabels.match(/[А-Яа-яЁё]+/g)).toBeNull();
  }
});
