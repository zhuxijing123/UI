import { createContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import type { Locale, Translations } from '../i18n/types';
import { zhCN } from '../i18n/translations/zh-CN';
import { enUS } from '../i18n/translations/en-US';

const TRANSLATIONS: Record<Locale, Translations> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

const DEFAULT_LOCALE: Locale = 'zh-CN';
const STORAGE_KEY = 'brm-ui-studio-locale';

type I18nContextValue = {
  locale: Locale;
  translations: Translations;
  setLocale: (locale: Locale) => void;
};

export const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === 'undefined') return DEFAULT_LOCALE;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'zh-CN' || stored === 'en-US') {
        return stored;
      }
      return DEFAULT_LOCALE;
    } catch {
      return DEFAULT_LOCALE;
    }
  });

  const translations = useMemo(() => TRANSLATIONS[locale], [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      window.localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // Ignore storage errors
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === 'zh-CN' ? 'zh-CN' : 'en';
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, translations, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}
