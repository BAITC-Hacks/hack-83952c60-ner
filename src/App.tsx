import React, { useEffect, useState } from 'react';
import { t, useLanguage } from './i18n';
import ClassicSimulator from './ClassicSimulator';
import { SelectedDecision } from './engine/types';
import './twin/twin.css';
import DigitalTwin from './twin/DigitalTwin';
const TransportTwin = React.lazy(() => import('./transport/TransportTwin'));
export const App: React.FC = () => {
  useLanguage();
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
  const transport = hash === '#/transport';
  return <><nav className="mode-nav" aria-label={t('Режим приложения')} style={transport ? { display: 'none' } : undefined}>
    <a href="#" aria-current={!twin && !transport ? 'page' : undefined}>{t('Аким на 5 часов')}</a>
    <a href="#/digital-twin" aria-current={twin ? 'page' : undefined}>{t('Симулятор города')}</a>
    <a href="#/transport">{t('Транспорт')} · 3D</a>
  </nav><div hidden={twin || transport}><ClassicSimulator onDecisionsChange={setDecisions} /></div>
    {twinVisited && <div hidden={!twin}><DigitalTwin active={twin} decisions={decisions} /></div>}
    {transport && <React.Suspense fallback={<div role="status" style={{ padding: 40 }}>Загрузка транспортной модели…</div>}><TransportTwin /></React.Suspense>}
  </>;
};
export default App;
