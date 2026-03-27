import { useContext, useCallback } from 'react';
import type { TranslationKey } from './types';
import { I18nContext } from '../contexts/I18nContext';

export function useTranslation() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }

  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
    let text = context.translations[key] || key;

    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        text = text.replace(new RegExp(`{${paramKey}}`, 'g'), String(value));
      });
    }

    return text;
  }, [context.translations]);

  return {
    t,
    locale: context.locale,
    setLocale: context.setLocale,
  };
}
