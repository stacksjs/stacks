/**
 * Stacks i18n - Internationalization System
 *
 * A comprehensive internationalization system with support for:
 * - Translation loading from JSON/YAML files
 * - Plural forms
 * - Variable interpolation
 * - Nested translations
 * - Date/time formatting
 * - Number formatting
 * - Currency formatting
 * - Relative time formatting
 *
 * @example
 * ```ts
 * import { t, setLocale, addTranslations } from '@stacksjs/i18n'
 *
 * // Add translations
 * addTranslations('en', {
 *   greeting: 'Hello, {name}!',
 *   items: '{count} item | {count} items',
 * })
 *
 * // Use translations
 * t('greeting', { name: 'World' }) // "Hello, World!"
 * t('items', { count: 1 }) // "1 item"
 * t('items', { count: 5 }) // "5 items"
 *
 * // Format dates and numbers
 * formatDate(new Date(), 'long') // "January 8, 2026"
 * formatNumber(1234567.89) // "1,234,567.89"
 * formatCurrency(99.99, 'USD') // "$99.99"
 * ```
 */

export * from './translator'
export * from './formatter'
export * from './pluralization'
export * from './loader'
export * from './types'

// Re-export main functions for convenience
export {
  t,
  trans,
  tc,
  te,
  tm,
  setLocale,
  getLocale,
  addTranslations,
  loadTranslations,
  getAvailableLocales,
  hasTranslation,
  I18n,
  createI18n,
  useI18n,
} from './translator'

export {
  formatDate,
  formatTime,
  formatDateTime,
  formatNumber,
  formatCurrency,
  formatPercent,
  formatRelativeTime,
  formatList,
  formatPlural,
} from './formatter'
