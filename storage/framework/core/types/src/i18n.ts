/**
 * Vite plugin options for Vue I18n
 */
interface VitePluginVueI18nOptions {
  forceStringify?: boolean
  runtimeOnly?: boolean
  compositionOnly?: boolean
  fullInstall?: boolean
  include?: string | string[]
  defaultSFCLang?: 'json' | 'json5' | 'yml' | 'yaml'
  globalSFCScope?: boolean
  useVueI18nImportName?: boolean
}

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
 * **Internationalization Options**
 *
 * Configuration for the i18n system.
 */
export interface I18nOptions {
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
   * Directory containing translation files
   * @default 'lang'
   */
  langDir?: string

  /**
   * Initial translations
   */
  messages?: Translations

  /**
   * Whether to warn about missing translations in development
   * @default true
   */
  warnMissing?: boolean

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

  /**
   * Vite plugin options
   */
  vite?: VitePluginVueI18nOptions
}

export type I18nConfig = Partial<I18nOptions>

/**
 * Legacy alias
 * @deprecated Use I18nOptions instead
 */
export type i18nOptions = VitePluginVueI18nOptions
