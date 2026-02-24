/**
 * Pluralization Rules
 *
 * Implements CLDR plural rules for various languages.
 * @see https://cldr.unicode.org/index/cldr-spec/plural-rules
 */

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'

export type PluralRule = (_n: number) => PluralCategory

/**
 * Get the plural category for a number in a given locale
 */
export function getPluralCategory(n: number, locale: string): PluralCategory {
  const rule = getPluralRule(locale)
  return rule(n)
}

/**
 * Get the plural rule function for a locale
 */
export function getPluralRule(locale: string): PluralRule {
  // Get base language code
  const lang = locale.split('-')[0].toLowerCase()

  const rule = pluralRules[lang]
  if (rule) return rule

  // Default to 'other' for unknown locales
  return () => 'other'
}

/**
 * Parse a plural string into its forms
 *
 * Supports formats:
 * - "one | other" (simple)
 * - "zero | one | other" (with zero)
 * - "{0} item | {0} items" (with placeholders)
 * - "no items | one item | {n} items" (with special forms)
 */
export function parsePluralForms(
  str: string,
  separator = '|',
): Map<PluralCategory, string> {
  const parts = str.split(separator).map(s => s.trim())
  const forms = new Map<PluralCategory, string>()

  if (parts.length === 1) {
    forms.set('other', parts[0])
  }
  else if (parts.length === 2) {
    forms.set('one', parts[0])
    forms.set('other', parts[1])
  }
  else if (parts.length === 3) {
    forms.set('zero', parts[0])
    forms.set('one', parts[1])
    forms.set('other', parts[2])
  }
  else if (parts.length >= 4) {
    // Extended format: zero | one | two | few | many | other
    const categories: PluralCategory[] = ['zero', 'one', 'two', 'few', 'many', 'other']
    for (let i = 0; i < parts.length && i < categories.length; i++) {
      forms.set(categories[i], parts[i])
    }
  }

  return forms
}

/**
 * Select the appropriate plural form for a count
 */
export function selectPluralForm(
  forms: Map<PluralCategory, string>,
  count: number,
  locale: string,
): string {
  const category = getPluralCategory(count, locale)

  // Try exact category first
  if (forms.has(category)) {
    return forms.get(category)!
  }

  // Fall back to 'other'
  if (forms.has('other')) {
    return forms.get('other')!
  }

  // Last resort: return first available form
  const first = forms.values().next()
  return first.done ? '' : first.value
}

/**
 * Plural rules for various languages
 * Based on CLDR plural rules
 */
const pluralRules: Record<string, PluralRule> = {
  // === One/Other languages ===

  // English, German, Dutch, etc.
  en: n => (n === 1 ? 'one' : 'other'),
  de: n => (n === 1 ? 'one' : 'other'),
  nl: n => (n === 1 ? 'one' : 'other'),
  es: n => (n === 1 ? 'one' : 'other'),
  it: n => (n === 1 ? 'one' : 'other'),
  pt: n => (n === 1 ? 'one' : 'other'),
  sv: n => (n === 1 ? 'one' : 'other'),
  da: n => (n === 1 ? 'one' : 'other'),
  no: n => (n === 1 ? 'one' : 'other'),
  fi: n => (n === 1 ? 'one' : 'other'),
  el: n => (n === 1 ? 'one' : 'other'),
  he: n => (n === 1 ? 'one' : 'other'),
  hu: n => (n === 1 ? 'one' : 'other'),
  tr: n => (n === 1 ? 'one' : 'other'),

  // === No plural (always other) ===

  // Chinese, Japanese, Korean, Vietnamese, Thai
  zh: () => 'other',
  ja: () => 'other',
  ko: () => 'other',
  vi: () => 'other',
  th: () => 'other',
  id: () => 'other',
  ms: () => 'other',

  // === French (0-1 is one) ===

  fr: n => (n === 0 || n === 1 ? 'one' : 'other'),

  // === Russian, Ukrainian (complex) ===

  ru: (n) => {
    const mod10 = n % 10
    const mod100 = n % 100

    if (mod10 === 1 && mod100 !== 11) return 'one'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few'
    if (mod10 === 0 || (mod10 >= 5 && mod10 <= 9) || (mod100 >= 11 && mod100 <= 14)) return 'many'
    return 'other'
  },

  uk: (n) => {
    const mod10 = n % 10
    const mod100 = n % 100

    if (mod10 === 1 && mod100 !== 11) return 'one'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few'
    if (mod10 === 0 || (mod10 >= 5 && mod10 <= 9) || (mod100 >= 11 && mod100 <= 14)) return 'many'
    return 'other'
  },

  // === Polish (complex) ===

  pl: (n) => {
    const mod10 = n % 10
    const mod100 = n % 100

    if (n === 1) return 'one'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few'
    if (mod10 === 0 || mod10 === 1 || (mod10 >= 5 && mod10 <= 9) || (mod100 >= 12 && mod100 <= 14)) return 'many'
    return 'other'
  },

  // === Czech, Slovak ===

  cs: (n) => {
    if (n === 1) return 'one'
    if (n >= 2 && n <= 4) return 'few'
    return 'other'
  },

  sk: (n) => {
    if (n === 1) return 'one'
    if (n >= 2 && n <= 4) return 'few'
    return 'other'
  },

  // === Arabic (complex with dual) ===

  ar: (n) => {
    if (n === 0) return 'zero'
    if (n === 1) return 'one'
    if (n === 2) return 'two'

    const mod100 = n % 100
    if (mod100 >= 3 && mod100 <= 10) return 'few'
    if (mod100 >= 11 && mod100 <= 99) return 'many'
    return 'other'
  },

  // === Welsh (with zero, one, two, few, many) ===

  cy: (n) => {
    if (n === 0) return 'zero'
    if (n === 1) return 'one'
    if (n === 2) return 'two'
    if (n === 3) return 'few'
    if (n === 6) return 'many'
    return 'other'
  },

  // === Slovenian (with dual) ===

  sl: (n) => {
    const mod100 = n % 100

    if (mod100 === 1) return 'one'
    if (mod100 === 2) return 'two'
    if (mod100 === 3 || mod100 === 4) return 'few'
    return 'other'
  },

  // === Irish ===

  ga: (n) => {
    if (n === 1) return 'one'
    if (n === 2) return 'two'
    if (n >= 3 && n <= 6) return 'few'
    if (n >= 7 && n <= 10) return 'many'
    return 'other'
  },

  // === Lithuanian ===

  lt: (n) => {
    const mod10 = n % 10
    const mod100 = n % 100

    if (mod10 === 1 && (mod100 < 11 || mod100 > 19)) return 'one'
    if (mod10 >= 2 && mod10 <= 9 && (mod100 < 11 || mod100 > 19)) return 'few'
    return 'other'
  },

  // === Latvian ===

  lv: (n) => {
    const mod10 = n % 10
    const mod100 = n % 100

    if (n === 0) return 'zero'
    if (mod10 === 1 && mod100 !== 11) return 'one'
    return 'other'
  },

  // === Romanian ===

  ro: (n) => {
    if (n === 1) return 'one'

    const mod100 = n % 100
    if (n === 0 || (mod100 >= 1 && mod100 <= 19)) return 'few'
    return 'other'
  },

  // === Hindi ===

  hi: n => (n === 0 || n === 1 ? 'one' : 'other'),
}

/**
 * Get all supported locales for pluralization
 */
export function getSupportedPluralLocales(): string[] {
  return Object.keys(pluralRules)
}

/**
 * Check if a locale has custom plural rules
 */
export function hasPluralRule(locale: string): boolean {
  const lang = locale.split('-')[0].toLowerCase()
  return lang in pluralRules
}

/**
 * Add a custom plural rule for a locale
 */
export function addPluralRule(locale: string, rule: PluralRule): void {
  const lang = locale.split('-')[0].toLowerCase()
  pluralRules[lang] = rule
}
