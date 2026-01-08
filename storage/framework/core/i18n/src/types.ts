/**
 * i18n Type Definitions
 */

/**
 * Translation messages - can be nested objects or strings
 */
export type TranslationMessages = {
  [key: string]: string | TranslationMessages
}

/**
 * All translations keyed by locale
 */
export type Translations = {
  [locale: string]: TranslationMessages
}

/**
 * Interpolation values for translations
 */
export type InterpolationValues = Record<string, string | number | boolean | null | undefined>

/**
 * Plural forms for a translation
 */
export interface PluralForms {
  zero?: string
  one: string
  two?: string
  few?: string
  many?: string
  other: string
}

/**
 * i18n configuration options
 */
export interface I18nConfig {
  /**
   * Default locale
   * @default 'en'
   */
  locale: string

  /**
   * Fallback locale when translation is not found
   * @default 'en'
   */
  fallbackLocale: string

  /**
   * Available locales
   */
  availableLocales?: string[]

  /**
   * Initial translations
   */
  messages?: Translations

  /**
   * Missing translation handler
   */
  missingHandler?: (locale: string, key: string) => string | undefined

  /**
   * Whether to warn about missing translations
   * @default true
   */
  warnMissing?: boolean

  /**
   * Escape interpolation values
   * @default false
   */
  escapeValues?: boolean

  /**
   * Separator for nested keys
   * @default '.'
   */
  keySeparator?: string

  /**
   * Plural separator
   * @default '|'
   */
  pluralSeparator?: string

  /**
   * Date/time formatting options
   */
  dateTimeFormats?: DateTimeFormats

  /**
   * Number formatting options
   */
  numberFormats?: NumberFormats
}

/**
 * Date/time format configurations per locale
 */
export type DateTimeFormats = {
  [locale: string]: {
    [formatName: string]: Intl.DateTimeFormatOptions
  }
}

/**
 * Number format configurations per locale
 */
export type NumberFormats = {
  [locale: string]: {
    [formatName: string]: Intl.NumberFormatOptions
  }
}

/**
 * Translation function
 */
export type TranslateFunction = (
  key: string,
  values?: InterpolationValues,
  locale?: string,
) => string

/**
 * Plural translation function
 */
export type TranslatePluralFunction = (
  key: string,
  count: number,
  values?: InterpolationValues,
  locale?: string,
) => string

/**
 * i18n instance interface
 */
export interface I18nInstance {
  /**
   * Current locale
   */
  locale: string

  /**
   * Fallback locale
   */
  fallbackLocale: string

  /**
   * Available locales
   */
  availableLocales: string[]

  /**
   * Translate a key
   */
  t: TranslateFunction

  /**
   * Translate with pluralization
   */
  tc: TranslatePluralFunction

  /**
   * Check if translation exists
   */
  te: (key: string, locale?: string) => boolean

  /**
   * Get translation message object
   */
  tm: (key: string, locale?: string) => TranslationMessages | string | undefined

  /**
   * Set locale
   */
  setLocale: (locale: string) => void

  /**
   * Add translations for a locale
   */
  addTranslations: (locale: string, messages: TranslationMessages) => void

  /**
   * Format a date
   */
  d: (value: Date | number, format?: string) => string

  /**
   * Format a number
   */
  n: (value: number, format?: string) => string
}

/**
 * Locale metadata
 */
export interface LocaleInfo {
  code: string
  name: string
  nativeName: string
  direction: 'ltr' | 'rtl'
  region?: string
  script?: string
}

/**
 * Common locales with metadata
 */
export const LOCALE_INFO: Record<string, LocaleInfo> = {
  en: { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr' },
  'en-US': { code: 'en-US', name: 'English (US)', nativeName: 'English (US)', direction: 'ltr', region: 'US' },
  'en-GB': { code: 'en-GB', name: 'English (UK)', nativeName: 'English (UK)', direction: 'ltr', region: 'GB' },
  es: { code: 'es', name: 'Spanish', nativeName: 'Espa\u00f1ol', direction: 'ltr' },
  fr: { code: 'fr', name: 'French', nativeName: 'Fran\u00e7ais', direction: 'ltr' },
  de: { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr' },
  it: { code: 'it', name: 'Italian', nativeName: 'Italiano', direction: 'ltr' },
  pt: { code: 'pt', name: 'Portuguese', nativeName: 'Portugu\u00eas', direction: 'ltr' },
  'pt-BR': { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Portugu\u00eas (Brasil)', direction: 'ltr', region: 'BR' },
  zh: { code: 'zh', name: 'Chinese', nativeName: '\u4e2d\u6587', direction: 'ltr' },
  'zh-CN': { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '\u7b80\u4f53\u4e2d\u6587', direction: 'ltr', region: 'CN' },
  'zh-TW': { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '\u7e41\u9ad4\u4e2d\u6587', direction: 'ltr', region: 'TW' },
  ja: { code: 'ja', name: 'Japanese', nativeName: '\u65e5\u672c\u8a9e', direction: 'ltr' },
  ko: { code: 'ko', name: 'Korean', nativeName: '\ud55c\uad6d\uc5b4', direction: 'ltr' },
  ar: { code: 'ar', name: 'Arabic', nativeName: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', direction: 'rtl' },
  he: { code: 'he', name: 'Hebrew', nativeName: '\u05e2\u05d1\u05e8\u05d9\u05ea', direction: 'rtl' },
  ru: { code: 'ru', name: 'Russian', nativeName: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439', direction: 'ltr' },
  nl: { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', direction: 'ltr' },
  pl: { code: 'pl', name: 'Polish', nativeName: 'Polski', direction: 'ltr' },
  tr: { code: 'tr', name: 'Turkish', nativeName: 'T\u00fcrk\u00e7e', direction: 'ltr' },
  vi: { code: 'vi', name: 'Vietnamese', nativeName: 'Ti\u1ebfng Vi\u1ec7t', direction: 'ltr' },
  th: { code: 'th', name: 'Thai', nativeName: '\u0e44\u0e17\u0e22', direction: 'ltr' },
  hi: { code: 'hi', name: 'Hindi', nativeName: '\u0939\u093f\u0928\u094d\u0926\u0940', direction: 'ltr' },
}
