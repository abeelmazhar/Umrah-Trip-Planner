import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ar from './locales/ar.json';

export const LANG_KEY = 'umrah_lang';
export const LANGUAGES = ['en', 'ar'];
const RTL = new Set(['ar']);

function initialLanguage() {
  const saved = localStorage.getItem(LANG_KEY);
  if (LANGUAGES.includes(saved)) return saved;
  return navigator.language?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

/** Mirror the whole document for right-to-left languages. */
function applyDocumentDirection(lng) {
  const html = document.documentElement;
  html.setAttribute('lang', lng);
  html.setAttribute('dir', RTL.has(lng) ? 'rtl' : 'ltr');
}

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(LANG_KEY, lng);
  applyDocumentDirection(lng);
});

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ar: { translation: ar } },
  lng: initialLanguage(),
  fallbackLng: 'en',
  supportedLngs: LANGUAGES,
  interpolation: { escapeValue: false },
});

applyDocumentDirection(i18n.language);

export default i18n;
