import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import deTranslation from './locales/de.json';
import esTranslation from './locales/es.json';
import trTranslation from './locales/tr.json';
import ptTranslation from './locales/pt.json';
import taTranslation from './locales/ta.json';

const resources = {
    de: deTranslation,
    es: esTranslation,
    tr: trTranslation,
    pt: ptTranslation,
    ta: taTranslation
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: 'de', // default language
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false // react already safes from xss
        }
    });

export default i18n;
