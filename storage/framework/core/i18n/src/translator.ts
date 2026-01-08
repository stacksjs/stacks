/**
 * Core Translator
 *
 * Handles translation lookups, interpolation, and locale management.
 */

import type {
  I18nConfig,
  I18nInstance,
  InterpolationValues,
  TranslationMessages,
  Translations,
} from './types'
import { parsePluralForms, selectPluralForm, getPluralCategory } from './pluralization'

/**
 * Default configuration
 */
const defaultConfig: I18nConfig = {
  locale: 'en',
  fallbackLocale: 'en',
  availableLocales: ['en'],
  messages: {},
  warnMissing: true,
  escapeValues: false,
  keySeparator: '.',
  pluralSeparator: '|',
}

/**
 * Global i18n state
 */
let currentLocale = 'en'
let fallbackLocale = 'en'
let translations: Translations = {}
let config: I18nConfig = { ...defaultConfig }

/**
 * I18n class for creating isolated instances
 */
export class I18n implements I18nInstance {
  private _locale: string
  private _fallbackLocale: string
  private _messages: Translations
  private _config: I18nConfig

  constructor(options: Partial<I18nConfig> = {}) {
    this._config = { ...defaultConfig, ...options }
    this._locale = this._config.locale
    this._fallbackLocale = this._config.fallbackLocale
    this._messages = this._config.messages || {}
  }

  get locale(): string {
    return this._locale
  }

  set locale(value: string) {
    this._locale = value
  }

  get fallbackLocale(): string {
    return this._fallbackLocale
  }

  get availableLocales(): string[] {
    return Object.keys(this._messages)
  }

  /**
   * Translate a key
   */
  t = (key: string, values?: InterpolationValues, locale?: string): string => {
    return this.translate(key, values, locale)
  }

  /**
   * Translate with pluralization
   */
  tc = (key: string, count: number, values?: InterpolationValues, locale?: string): string => {
    return this.translatePlural(key, count, values, locale)
  }

  /**
   * Check if translation exists
   */
  te = (key: string, locale?: string): boolean => {
    return this.hasTranslation(key, locale)
  }

  /**
   * Get translation message
   */
  tm = (key: string, locale?: string): TranslationMessages | string | undefined => {
    return this.getMessage(key, locale)
  }

  /**
   * Set the current locale
   */
  setLocale = (locale: string): void => {
    this._locale = locale
  }

  /**
   * Add translations for a locale
   */
  addTranslations = (locale: string, messages: TranslationMessages): void => {
    if (!this._messages[locale]) {
      this._messages[locale] = {}
    }
    this._messages[locale] = deepMerge(this._messages[locale], messages)
  }

  /**
   * Format a date
   */
  d = (value: Date | number, format?: string): string => {
    const date = typeof value === 'number' ? new Date(value) : value
    const options = this._config.dateTimeFormats?.[this._locale]?.[format || 'short'] || {}
    return new Intl.DateTimeFormat(this._locale, options).format(date)
  }

  /**
   * Format a number
   */
  n = (value: number, format?: string): string => {
    const options = this._config.numberFormats?.[this._locale]?.[format || 'decimal'] || {}
    return new Intl.NumberFormat(this._locale, options).format(value)
  }

  /**
   * Core translation logic
   */
  private translate(key: string, values?: InterpolationValues, locale?: string): string {
    const targetLocale = locale || this._locale
    let message = this.getMessage(key, targetLocale)

    // Try fallback locale
    if (message === undefined && targetLocale !== this._fallbackLocale) {
      message = this.getMessage(key, this._fallbackLocale)
    }

    // Handle missing translation
    if (message === undefined) {
      if (this._config.warnMissing) {
        console.warn(`[i18n] Missing translation: "${key}" for locale "${targetLocale}"`)
      }
      if (this._config.missingHandler) {
        const result = this._config.missingHandler(targetLocale, key)
        if (result !== undefined) return result
      }
      return key
    }

    // Handle object messages (return key path)
    if (typeof message !== 'string') {
      return key
    }

    // Interpolate values
    return this.interpolate(message, values)
  }

  /**
   * Translate with pluralization
   */
  private translatePlural(
    key: string,
    count: number,
    values?: InterpolationValues,
    locale?: string,
  ): string {
    const targetLocale = locale || this._locale
    let message = this.getMessage(key, targetLocale)

    // Try fallback locale
    if (message === undefined && targetLocale !== this._fallbackLocale) {
      message = this.getMessage(key, this._fallbackLocale)
    }

    if (message === undefined || typeof message !== 'string') {
      if (this._config.warnMissing) {
        console.warn(`[i18n] Missing plural translation: "${key}" for locale "${targetLocale}"`)
      }
      return key
    }

    // Parse plural forms
    const forms = parsePluralForms(message, this._config.pluralSeparator)
    const selectedForm = selectPluralForm(forms, count, targetLocale)

    // Interpolate with count and other values
    const allValues = { count, n: count, ...values }
    return this.interpolate(selectedForm, allValues)
  }

  /**
   * Check if a translation exists
   */
  private hasTranslation(key: string, locale?: string): boolean {
    const targetLocale = locale || this._locale
    return this.getMessage(key, targetLocale) !== undefined
  }

  /**
   * Get a message by key (supports nested keys)
   */
  private getMessage(key: string, locale: string): TranslationMessages | string | undefined {
    const messages = this._messages[locale]
    if (!messages) return undefined

    const parts = key.split(this._config.keySeparator || '.')
    let current: TranslationMessages | string | undefined = messages

    for (const part of parts) {
      if (current === undefined || typeof current === 'string') {
        return undefined
      }
      current = current[part]
    }

    return current
  }

  /**
   * Interpolate values into a message
   */
  private interpolate(message: string, values?: InterpolationValues): string {
    if (!values) return message

    return message.replace(/\{(\w+)\}/g, (match, key) => {
      const value = values[key]
      if (value === undefined || value === null) return match

      const str = String(value)
      return this._config.escapeValues ? escapeHtml(str) : str
    })
  }
}

// =============================================================================
// Global API
// =============================================================================

/**
 * Set the current locale
 */
export function setLocale(locale: string): void {
  currentLocale = locale
}

/**
 * Get the current locale
 */
export function getLocale(): string {
  return currentLocale
}

/**
 * Set the fallback locale
 */
export function setFallbackLocale(locale: string): void {
  fallbackLocale = locale
}

/**
 * Get available locales
 */
export function getAvailableLocales(): string[] {
  return Object.keys(translations)
}

/**
 * Add translations for a locale
 */
export function addTranslations(locale: string, messages: TranslationMessages): void {
  if (!translations[locale]) {
    translations[locale] = {}
  }
  translations[locale] = deepMerge(translations[locale], messages)
}

/**
 * Load translations (alias for addTranslations for multiple locales)
 */
export function loadTranslations(messages: Translations): void {
  for (const [locale, localeMessages] of Object.entries(messages)) {
    addTranslations(locale, localeMessages)
  }
}

/**
 * Check if a translation exists
 */
export function hasTranslation(key: string, locale?: string): boolean {
  const targetLocale = locale || currentLocale
  return getMessage(key, targetLocale) !== undefined
}

/**
 * Get a message by key
 */
function getMessage(key: string, locale: string): TranslationMessages | string | undefined {
  const messages = translations[locale]
  if (!messages) return undefined

  const parts = key.split(config.keySeparator || '.')
  let current: TranslationMessages | string | undefined = messages

  for (const part of parts) {
    if (current === undefined || typeof current === 'string') {
      return undefined
    }
    current = current[part]
  }

  return current
}

/**
 * Interpolate values into a message
 */
function interpolate(message: string, values?: InterpolationValues): string {
  if (!values) return message

  return message.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key]
    if (value === undefined || value === null) return match
    return String(value)
  })
}

/**
 * Translate a key
 */
export function t(key: string, values?: InterpolationValues, locale?: string): string {
  const targetLocale = locale || currentLocale
  let message = getMessage(key, targetLocale)

  // Try fallback locale
  if (message === undefined && targetLocale !== fallbackLocale) {
    message = getMessage(key, fallbackLocale)
  }

  // Handle missing translation
  if (message === undefined) {
    if (config.warnMissing) {
      console.warn(`[i18n] Missing translation: "${key}" for locale "${targetLocale}"`)
    }
    return key
  }

  if (typeof message !== 'string') {
    return key
  }

  return interpolate(message, values)
}

/**
 * Alias for t()
 */
export const trans = t

/**
 * Translate with pluralization
 */
export function tc(
  key: string,
  count: number,
  values?: InterpolationValues,
  locale?: string,
): string {
  const targetLocale = locale || currentLocale
  let message = getMessage(key, targetLocale)

  if (message === undefined && targetLocale !== fallbackLocale) {
    message = getMessage(key, fallbackLocale)
  }

  if (message === undefined || typeof message !== 'string') {
    return key
  }

  const forms = parsePluralForms(message, config.pluralSeparator)
  const selectedForm = selectPluralForm(forms, count, targetLocale)
  const allValues = { count, n: count, ...values }

  return interpolate(selectedForm, allValues)
}

/**
 * Check if translation exists
 */
export function te(key: string, locale?: string): boolean {
  return hasTranslation(key, locale)
}

/**
 * Get translation message object
 */
export function tm(key: string, locale?: string): TranslationMessages | string | undefined {
  return getMessage(key, locale || currentLocale)
}

/**
 * Create a new i18n instance
 */
export function createI18n(options: Partial<I18nConfig> = {}): I18n {
  return new I18n(options)
}

/**
 * Use i18n composable (for Vue-like usage)
 */
export function useI18n(options: Partial<I18nConfig> = {}): I18nInstance {
  return createI18n(options)
}

/**
 * Configure the global i18n instance
 */
export function configure(options: Partial<I18nConfig>): void {
  config = { ...config, ...options }

  if (options.locale) currentLocale = options.locale
  if (options.fallbackLocale) fallbackLocale = options.fallbackLocale
  if (options.messages) loadTranslations(options.messages)
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Deep merge two objects
 */
function deepMerge(target: TranslationMessages, source: TranslationMessages): TranslationMessages {
  const result = { ...target }

  for (const key of Object.keys(source)) {
    const sourceValue = source[key]
    const targetValue = result[key]

    if (
      typeof sourceValue === 'object'
      && sourceValue !== null
      && typeof targetValue === 'object'
      && targetValue !== null
    ) {
      result[key] = deepMerge(
        targetValue as TranslationMessages,
        sourceValue as TranslationMessages,
      )
    }
    else {
      result[key] = sourceValue
    }
  }

  return result
}

/**
 * Escape HTML characters
 */
function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#39;',
  }

  return str.replace(/[&<>"']/g, char => htmlEscapes[char] || char)
}
