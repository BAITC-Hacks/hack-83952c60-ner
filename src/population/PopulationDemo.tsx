/** Development entry only; production uses the /#/population application route. */
import { createRoot } from 'react-dom/client';
import PopulationScreen from './PopulationScreen';

createRoot(document.getElementById('root')!).render(<PopulationScreen />);
