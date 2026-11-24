import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en';

/**
 * i18n setup. The storefront is English-only.
 */
void i18next
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
    },
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: ['en'],
    interpolation: { escapeValue: false },
  });

export default i18next;
