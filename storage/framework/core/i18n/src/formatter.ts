/**
 * Internationalized Formatting
 *
 * Provides locale-aware formatting for dates, numbers, currencies, and more.
 */

import { getLocale } from './translator'

// =============================================================================
// Date Formatting
// =============================================================================

export type DateStyle = 'full' | 'long' | 'medium' | 'short'
export type TimeStyle = 'full' | 'long' | 'medium' | 'short'

export interface DateFormatOptions extends Intl.DateTimeFormatOptions {
  dateStyle?: DateStyle
  timeStyle?: TimeStyle
}

/**
 * Format a date
 */
export function formatDate(
  date: Date | number | string,
  style: DateStyle | DateFormatOptions = 'medium',
  locale?: string,
): string {
  const targetLocale = locale || getLocale()
  const dateObj = toDate(date)

  const options: Intl.DateTimeFormatOptions = typeof style === 'string'
    ? { dateStyle: style }
    : style

  return new Intl.DateTimeFormat(targetLocale, options).format(dateObj)
}

/**
 * Format a time
 */
export function formatTime(
  date: Date | number | string,
  style: TimeStyle | DateFormatOptions = 'short',
  locale?: string,
): string {
  const targetLocale = locale || getLocale()
  const dateObj = toDate(date)

  const options: Intl.DateTimeFormatOptions = typeof style === 'string'
    ? { timeStyle: style }
    : style

  return new Intl.DateTimeFormat(targetLocale, options).format(dateObj)
}

/**
 * Format a date and time
 */
export function formatDateTime(
  date: Date | number | string,
  dateStyle: DateStyle = 'medium',
  timeStyle: TimeStyle = 'short',
  locale?: string,
): string {
  const targetLocale = locale || getLocale()
  const dateObj = toDate(date)

  return new Intl.DateTimeFormat(targetLocale, {
    dateStyle,
    timeStyle,
  }).format(dateObj)
}

/**
 * Format relative time (e.g., "2 days ago", "in 3 hours")
 */
export function formatRelativeTime(
  date: Date | number | string,
  baseDate: Date | number | string = new Date(),
  style: 'long' | 'short' | 'narrow' = 'long',
  locale?: string,
): string {
  const targetLocale = locale || getLocale()
  const dateObj = toDate(date)
  const baseDateObj = toDate(baseDate)

  const diffMs = dateObj.getTime() - baseDateObj.getTime()
  const diffSeconds = Math.round(diffMs / 1000)
  const diffMinutes = Math.round(diffSeconds / 60)
  const diffHours = Math.round(diffMinutes / 60)
  const diffDays = Math.round(diffHours / 24)
  const diffWeeks = Math.round(diffDays / 7)
  const diffMonths = Math.round(diffDays / 30)
  const diffYears = Math.round(diffDays / 365)

  const rtf = new Intl.RelativeTimeFormat(targetLocale, { style })

  // Choose appropriate unit
  if (Math.abs(diffSeconds) < 60) {
    return rtf.format(diffSeconds, 'second')
  }
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute')
  }
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour')
  }
  if (Math.abs(diffDays) < 7) {
    return rtf.format(diffDays, 'day')
  }
  if (Math.abs(diffWeeks) < 4) {
    return rtf.format(diffWeeks, 'week')
  }
  if (Math.abs(diffMonths) < 12) {
    return rtf.format(diffMonths, 'month')
  }
  return rtf.format(diffYears, 'year')
}

// =============================================================================
// Number Formatting
// =============================================================================

export interface NumberFormatOptions extends Intl.NumberFormatOptions {
  compact?: boolean
  precision?: number
}

/**
 * Format a number
 */
export function formatNumber(
  value: number,
  options: NumberFormatOptions = {},
  locale?: string,
): string {
  const targetLocale = locale || getLocale()

  const formatOptions: Intl.NumberFormatOptions = { ...options }

  if (options.compact) {
    formatOptions.notation = 'compact'
    formatOptions.compactDisplay = 'short'
  }

  if (options.precision !== undefined) {
    formatOptions.minimumFractionDigits = options.precision
    formatOptions.maximumFractionDigits = options.precision
  }

  return new Intl.NumberFormat(targetLocale, formatOptions).format(value)
}

/**
 * Format a currency value
 */
export function formatCurrency(
  value: number,
  currency = 'USD',
  options: Omit<NumberFormatOptions, 'style' | 'currency'> = {},
  locale?: string,
): string {
  const targetLocale = locale || getLocale()

  return new Intl.NumberFormat(targetLocale, {
    style: 'currency',
    currency,
    ...options,
  }).format(value)
}

/**
 * Format a percentage
 */
export function formatPercent(
  value: number,
  options: Omit<NumberFormatOptions, 'style'> = {},
  locale?: string,
): string {
  const targetLocale = locale || getLocale()

  return new Intl.NumberFormat(targetLocale, {
    style: 'percent',
    ...options,
  }).format(value)
}

/**
 * Format a number with units (e.g., "5 kilograms", "10 miles")
 */
export function formatUnit(
  value: number,
  unit: string,
  unitDisplay: 'long' | 'short' | 'narrow' = 'short',
  locale?: string,
): string {
  const targetLocale = locale || getLocale()

  return new Intl.NumberFormat(targetLocale, {
    style: 'unit',
    unit,
    unitDisplay,
  }).format(value)
}

/**
 * Format bytes to human-readable format
 */
export function formatBytes(
  bytes: number,
  decimals = 2,
  locale?: string,
): string {
  const targetLocale = locale || getLocale()

  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  const value = bytes / Math.pow(k, i)
  const formatted = new Intl.NumberFormat(targetLocale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value)

  return `${formatted} ${sizes[i]}`
}

// =============================================================================
// List Formatting
// =============================================================================

export type ListType = 'conjunction' | 'disjunction' | 'unit'
export type ListStyle = 'long' | 'short' | 'narrow'

/**
 * Format a list of items
 */
export function formatList(
  items: string[],
  type: ListType = 'conjunction',
  style: ListStyle = 'long',
  locale?: string,
): string {
  const targetLocale = locale || getLocale()

  return new Intl.ListFormat(targetLocale, { type, style }).format(items)
}

// =============================================================================
// Plural Formatting
// =============================================================================

/**
 * Get the plural category for a number
 */
export function formatPlural(
  value: number,
  locale?: string,
): Intl.LDMLPluralRule {
  const targetLocale = locale || getLocale()
  const pr = new Intl.PluralRules(targetLocale)
  return pr.select(value)
}

/**
 * Select from plural options based on a number
 */
export function selectPlural<T>(
  value: number,
  options: Partial<Record<Intl.LDMLPluralRule, T>> & { other: T },
  locale?: string,
): T {
  const category = formatPlural(value, locale)
  return options[category] ?? options.other
}

// =============================================================================
// Display Names
// =============================================================================

export type DisplayNameType = 'language' | 'region' | 'script' | 'currency' | 'calendar' | 'dateTimeField'

/**
 * Get display name for a code
 */
export function getDisplayName(
  code: string,
  type: DisplayNameType = 'language',
  style: 'long' | 'short' | 'narrow' = 'long',
  locale?: string,
): string | undefined {
  const targetLocale = locale || getLocale()

  try {
    const dn = new Intl.DisplayNames(targetLocale, { type, style })
    return dn.of(code)
  }
  catch {
    return undefined
  }
}

/**
 * Get language name
 */
export function getLanguageName(
  languageCode: string,
  locale?: string,
): string | undefined {
  return getDisplayName(languageCode, 'language', 'long', locale)
}

/**
 * Get region/country name
 */
export function getRegionName(
  regionCode: string,
  locale?: string,
): string | undefined {
  return getDisplayName(regionCode, 'region', 'long', locale)
}

/**
 * Get currency name
 */
export function getCurrencyName(
  currencyCode: string,
  locale?: string,
): string | undefined {
  return getDisplayName(currencyCode, 'currency', 'long', locale)
}

// =============================================================================
// Collation
// =============================================================================

/**
 * Compare strings in a locale-aware manner
 */
export function compareStrings(
  a: string,
  b: string,
  options: Intl.CollatorOptions = {},
  locale?: string,
): number {
  const targetLocale = locale || getLocale()
  const collator = new Intl.Collator(targetLocale, options)
  return collator.compare(a, b)
}

/**
 * Sort an array of strings in locale-aware order
 */
export function sortStrings(
  strings: string[],
  options: Intl.CollatorOptions = {},
  locale?: string,
): string[] {
  const targetLocale = locale || getLocale()
  const collator = new Intl.Collator(targetLocale, options)
  return [...strings].sort((a, b) => collator.compare(a, b))
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Convert various date formats to Date object
 */
function toDate(date: Date | number | string): Date {
  if (date instanceof Date) return date
  if (typeof date === 'number') return new Date(date)
  return new Date(date)
}

/**
 * Get the text direction for a locale
 */
export function getTextDirection(locale?: string): 'ltr' | 'rtl' {
  const targetLocale = locale || getLocale()
  const lang = targetLocale.split('-')[0].toLowerCase()

  // RTL languages
  const rtlLanguages = ['ar', 'he', 'fa', 'ur', 'yi', 'ps', 'sd', 'ug', 'ku', 'ckb']

  return rtlLanguages.includes(lang) ? 'rtl' : 'ltr'
}

/**
 * Check if a locale uses RTL text direction
 */
export function isRTL(locale?: string): boolean {
  return getTextDirection(locale) === 'rtl'
}
