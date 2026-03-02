/**
 * Lightweight i18n module for Crownicles website.
 * Detects browser language and loads the corresponding JSON translation file.
 * Falls back to English if the detected language isn't supported.
 */

const SUPPORTED_LOCALES = ['en', 'fr'];
const DEFAULT_LOCALE = 'en';

let currentLocale = DEFAULT_LOCALE;
let translations = {};

/**
 * Detect user's preferred locale from browser settings.
 */
function detectLocale() {
  const params = new URLSearchParams(window.location.search);
  const paramLang = params.get('lang');
  if (paramLang && SUPPORTED_LOCALES.includes(paramLang)) {
    return paramLang;
  }

  const stored = localStorage.getItem('crownicles-lang');
  if (stored && SUPPORTED_LOCALES.includes(stored)) {
    return stored;
  }

  const browserLangs = navigator.languages || [navigator.language || navigator.userLanguage || ''];
  for (const lang of browserLangs) {
    const code = lang.split('-')[0].toLowerCase();
    if (SUPPORTED_LOCALES.includes(code)) {
      return code;
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Load translation file for the given locale.
 */
async function loadTranslations(locale) {
  try {
    const resp = await fetch(`./i18n/${locale}.json`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    translations = await resp.json();
    currentLocale = locale;
    localStorage.setItem('crownicles-lang', locale);
  } catch (err) {
    console.warn(`Failed to load ${locale} translations, falling back to ${DEFAULT_LOCALE}`, err);
    if (locale !== DEFAULT_LOCALE) {
      await loadTranslations(DEFAULT_LOCALE);
    }
  }
}

/**
 * Get a nested translation value by dot-separated key path.
 * Supports simple {{var}} template substitution.
 */
function t(keyPath, vars = {}) {
  const keys = keyPath.split('.');
  let val = translations;
  for (const k of keys) {
    if (val == null) return keyPath;
    val = val[k];
  }
  if (val == null) return keyPath;

  if (typeof val === 'string') {
    return val.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return vars[key] !== undefined ? vars[key] : `{{${key}}}`;
    });
  }

  return val;
}

/**
 * Get current locale code.
 */
function getLocale() {
  return currentLocale;
}

/**
 * Toggle between supported locales.
 */
function getNextLocale() {
  const idx = SUPPORTED_LOCALES.indexOf(currentLocale);
  return SUPPORTED_LOCALES[(idx + 1) % SUPPORTED_LOCALES.length];
}

/**
 * Initialize i18n: detect locale, load translations.
 */
async function initI18n() {
  const locale = detectLocale();
  await loadTranslations(locale);
  return currentLocale;
}

export { initI18n, t, getLocale, getNextLocale, loadTranslations, SUPPORTED_LOCALES };
