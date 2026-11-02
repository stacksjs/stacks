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

/** Rules given with {@link addPluralRule}, by base language. They win over the runtime's. */
const customRules: Record<string, PluralRule> = {}

/** `Intl.PluralRules` per locale, or null where the runtime has no plural data for it. */
const runtimeRules = new Map<string, Intl.PluralRules | null>()

function baseLanguage(locale: string): string {
  return locale.split('-')[0]?.toLowerCase() ?? locale.toLowerCase()
}

/**
 * The runtime's CLDR rules for `locale`. Only for a locale it has plural data
 * for: any other falls back to CLDR's root rules, which say `other` for
 * everything, and that would hide an unknown language behind a working one.
 */
function runtimeRule(locale: string): Intl.PluralRules | null {
  if (!runtimeRules.has(locale)) {
    let rules: Intl.PluralRules | null = null
    try {
      if (Intl.PluralRules.supportedLocalesOf([locale]).length)
        rules = new Intl.PluralRules(locale)
    }
    catch {
      // Not a well-formed locale tag.
    }
    runtimeRules.set(locale, rules)
  }
  return runtimeRules.get(locale) ?? null
}

/**
 * Get the plural rule function for a locale: one added with
 * {@link addPluralRule}, else the runtime's CLDR rules (`Intl.PluralRules`)
 * for the full locale (`pt` and `pt-PT` differ), else `other` for everything.
 *
 * The rules used to be a hand-written table of 33 languages. 19 others were
 * missing from it and said `other` even for 1 (Catalan, Croatian, Serbian,
 * Bulgarian, `nb` for Norwegian...), and several it had disagreed with CLDR
 * (Hebrew's `two`, Latvian's `zero`, Portuguese 0, most fractions).
 */
export function getPluralRule(locale: string): PluralRule {
  const custom = customRules[baseLanguage(locale)]
  if (custom)
    return custom

  const rules = runtimeRule(locale) ?? runtimeRule(baseLanguage(locale))
  if (rules)
    return n => rules.select(n) as PluralCategory

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
    forms.set('other', parts[0] ?? '')
  }
  else if (parts.length === 2) {
    forms.set('one', parts[0] ?? '')
    forms.set('other', parts[1] ?? '')
  }
  else if (parts.length === 3) {
    forms.set('zero', parts[0] ?? '')
    forms.set('one', parts[1] ?? '')
    forms.set('other', parts[2] ?? '')
  }
  else if (parts.length >= 4) {
    // Extended format: zero | one | two | few | many | other
    const categories: PluralCategory[] = ['zero', 'one', 'two', 'few', 'many', 'other']
    for (let i = 0; i < parts.length && i < categories.length; i++) {
      const category = categories[i]
      const part = parts[i]
      if (category !== undefined && part !== undefined)
        forms.set(category, part)
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
 * Languages given their own rule with {@link addPluralRule}. Every language
 * the runtime has CLDR plural data for is supported as well; ask
 * {@link hasPluralRule} about one.
 */
export function getSupportedPluralLocales(): string[] {
  return Object.keys(customRules)
}

/**
 * Whether `locale` has plural rules: its own from {@link addPluralRule}, or
 * the runtime's CLDR data for its language.
 */
export function hasPluralRule(locale: string): boolean {
  const lang = baseLanguage(locale)
  return lang in customRules || runtimeRule(lang) !== null
}

/**
 * Add a custom plural rule for a locale's language. It wins over the
 * runtime's CLDR rules for every locale of that language.
 */
export function addPluralRule(locale: string, rule: PluralRule): void {
  customRules[baseLanguage(locale)] = rule
}
