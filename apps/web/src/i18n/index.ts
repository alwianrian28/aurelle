import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { id } from './locales/id';
import { en } from './locales/en';

/**
 * Inisialisasi i18n — PRD §13.1.
 * Default mengikuti bahasa browser; jika bukan ID maka EN (FR-03-03 [U]).
 */
void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      id: { translation: id },
      en: { translation: en },
    },
    fallbackLng: 'en',
    supportedLngs: ['id', 'en'],
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'aurelle_locale',
    },
    interpolation: { escapeValue: false },
  });

export default i18next;
