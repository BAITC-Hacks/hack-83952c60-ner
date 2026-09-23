import React, { useEffect, useState } from 'react';
import { t, useLanguage, languages, setLanguage, Language } from './i18n';
import { Languages } from 'lucide-react';
import { ThemeToggle } from './components/ThemeToggle';
import ClassicSimulator from './ClassicSimulator';
import { SelectedDecision } from './engine/types';
import './twin/twin.css';
import DigitalTwin from './twin/DigitalTwin';
import './workspace.css';
export const App: React.FC = () => {
  const language = useLanguage();
  const [decisions, setDecisions] = useState<SelectedDecision[]>([]);
  const [hash, setHash] = useState(() => typeof window === 'undefined' ? '' : window.location.hash);
  const [twinVisited, setTwinVisited] = useState(hash === '#/digital-twin');
  useEffect(() => {
    const update = () => {
      setHash(window.location.hash);
      if (window.location.hash === '#/digital-twin') setTwinVisited(true);
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const twin = hash === '#/digital-twin';
  return <><header className="app-toolbar"><div className="app-toolbar-inner"><nav className="mode-nav" aria-label={t('Режим приложения')}>
    <a href="#" aria-current={!twin ? 'page' : undefined}>{t('Аким на 5 часов')}</a>
    <a href="#/digital-twin" aria-current={twin ? 'page' : undefined}>{t('Симулятор города')}</a>
  </nav><div className="app-preferences" role="group" aria-label={t('Настройки интерфейса')}>
    <label className="app-language"><Languages size={16} aria-hidden="true" />
      <select aria-label={t('Язык интерфейса')} value={language} onChange={event => setLanguage(event.target.value as Language)}>
        {languages.map(item => <option key={item.code} value={item.code} lang={item.code}>{item.label}</option>)}
      </select>
    </label><ThemeToggle />
  </div></div></header><div hidden={twin}><ClassicSimulator onDecisionsChange={setDecisions} /></div>
    {twinVisited && <div hidden={!twin}><DigitalTwin active={twin} decisions={decisions} /></div>}
  </>;
};
export default App;
