import { getConfigFile, writeConfigFile } from './Utils';
import { globalAssetsDir } from './Constants';

const CONFIG_FILE = 'config.json';
const CONFIG_SECTION = 'General';
const CONFIG_SETTING = 'Language';
const DEFAULT_LOCALE = 'en_us';
const AVAILABLE_LOCALES = ['en_us', 'es_es', 'de_de', 'zh_cn', 'hi_in', 'ru_ru', 'pt_br', 'ar_sa', 'tr_tr'];
const listeners = new Set();
const localeCache = new Map();
const translationKeyCache = new Map();
let englishKeysByValue = new Map();

let languageOverride = null;
let activeLocale = DEFAULT_LOCALE;
let activeTranslations = {};
let englishTranslations = {};

const readLocale = (locale) => {
    if (localeCache.has(locale)) return localeCache.get(locale);

    let translations = {};
    try {
        const path = `assets/lang/${locale}.json`;
        const bundled = FileLib.read('V5', path);
        translations = JSON.parse(bundled || '{}');
    } catch (e) {
        try {
            const path = new java.io.File(globalAssetsDir, `lang/${locale}.json`).getPath();
            translations = JSON.parse(FileLib.read(path) || '{}');
        } catch (fallbackError) {
            console.warn(`V5 could not load locale ${locale}:`, fallbackError);
        }
    }

    localeCache.set(locale, translations && typeof translations === 'object' ? translations : {});
    return localeCache.get(locale);
};

const getConfiguredOverride = () => {
    try {
        const config = getConfigFile(CONFIG_FILE) || {};
        const value = config[CONFIG_SECTION]?.[CONFIG_SETTING];
        return Array.isArray(value) ? AVAILABLE_LOCALES.find((locale) => value.some((option) => option.name === locale && option.enabled)) || null : null;
    } catch (e) {
        return null;
    }
};

const resolveLocale = () => {
    const requested = languageOverride || getConfiguredOverride() || DEFAULT_LOCALE;
    return AVAILABLE_LOCALES.includes(requested) ? requested : DEFAULT_LOCALE;
};

export const reloadTranslations = () => {
    activeLocale = resolveLocale();
    activeTranslations = readLocale(activeLocale);
    englishTranslations = readLocale(DEFAULT_LOCALE);
    englishKeysByValue = new Map();
    Object.keys(englishTranslations).forEach((key) => {
        const value = String(englishTranslations[key]);
        const keys = englishKeysByValue.get(value) || [];
        keys.push(key);
        englishKeysByValue.set(value, keys);
    });
    translationKeyCache.clear();
    listeners.forEach((listener) => listener(activeLocale));
    return activeLocale;
};

export const t = (key, params = {}, fallback) => {
    const value = activeTranslations[key] ?? englishTranslations[key] ?? fallback;

    if (value === undefined) {
        if (isDeveloperModeEnabled()) console.warn(`V5 missing translation key: ${key}`);
        return key;
    }

    return String(value).replace(/\{([A-Za-z0-9_.-]+)\}/g, (placeholder, name) => {
        return Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : placeholder;
    });
};

export const resolveEnglishTranslation = (value, fallback = value) => {
    if (typeof value !== 'string') return fallback;
    return Object.prototype.hasOwnProperty.call(englishTranslations, value) ? String(englishTranslations[value]) : fallback;
};

export const normalizeTranslationKey = (namespace, value, suffix = null) => {
    if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(englishTranslations, value)) return value;
    return translationKey(namespace, value, suffix);
};

export const translateText = (value, params = {}, fallback = value) => {
    if (value && typeof value === 'object' && value.key) return t(value.key, value.params || params, value.fallback);
    if (typeof value !== 'string') return value;
    if (Object.prototype.hasOwnProperty.call(englishTranslations, value)) return t(value, params, fallback);
    const key = englishKeysByValue.get(value)?.[0];
    return key ? t(key, params, fallback) : value;
};

export const translationKey = (namespace, value, suffix = null) => {
    const text = String(value);
    const cacheKey = `${namespace}\0${text}\0${suffix || ''}`;
    if (translationKeyCache.has(cacheKey)) return translationKeyCache.get(cacheKey);

    const prefix = `${namespace}.`;
    const ending = suffix ? `.${suffix}` : '';
    const existing = (englishKeysByValue.get(text) || []).find((key) => key.startsWith(prefix) && (!ending || key.endsWith(ending)));
    const key =
        existing ||
        `${namespace}.${text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '')}${ending}`;
    translationKeyCache.set(cacheKey, key);
    return key;
};

export const getLanguageOverride = () => languageOverride || getConfiguredOverride() || DEFAULT_LOCALE;
export const getAvailableLocales = () => [...AVAILABLE_LOCALES];

export const setLanguageOverride = (locale) => {
    languageOverride = AVAILABLE_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
    const config = getConfigFile(CONFIG_FILE) || {};
    if (!config[CONFIG_SECTION]) config[CONFIG_SECTION] = {};
    config[CONFIG_SECTION][CONFIG_SETTING] = AVAILABLE_LOCALES.map((name) => ({ name, enabled: name === languageOverride }));
    writeConfigFile(CONFIG_FILE, config);
    return reloadTranslations();
};

export const onLocaleChange = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

reloadTranslations();
