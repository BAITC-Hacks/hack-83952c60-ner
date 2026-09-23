import { Moon, Sun } from 'lucide-react';
import { t, useLanguage } from '../i18n';
import { setTheme, useTheme } from '../theme';

export function ThemeToggle() {
  useLanguage();
  const theme = useTheme();
  const isLight = theme === 'light';
  return (
    <button type="button" className="theme-toggle" role="switch" aria-checked={isLight}
      aria-label={t('Светлая тема')} title={t(isLight ? 'Включить тёмную тему' : 'Включить светлую тему')}
      onClick={() => setTheme(isLight ? 'dark' : 'light')}>
      {isLight ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      <span>{t(isLight ? 'Светлая' : 'Тёмная')}</span>
      <span className="theme-toggle__track" aria-hidden="true"><span /></span>
    </button>
  );
}
