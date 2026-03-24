import { afterEach, describe, expect, it } from 'bun:test'
import {
  I18n,
  addTranslations,
  createI18n,
  formatCurrency,
  formatDate,
  formatList,
  formatNumber,
  formatPercent,
  formatPlural,
  getAvailableLocales,
  getLocale,
  hasTranslation,
  loadTranslations,
  setLocale,
  t,
  tc,
  te,
  tm,
  trans,
  useI18n,
} from '../src'
import {
  addPluralRule,
  getPluralCategory,
  hasPluralRule,
  parsePluralForms,
  selectPluralForm,
} from '../src/pluralization'
import { createLoader, loadFile } from '../src/loader'

// ---------------------------------------------------------------------------
// Reset global state between tests by re-setting locale
// ---------------------------------------------------------------------------
afterEach(() => {
  setLocale('en')
})

describe('Translator', () => {
  it('should translate a key and return its value', () => {
    addTranslations('en', { greeting: 'Hello' })
    expect(t('greeting')).toBe('Hello')
  })

  it('should return the key itself when translation is missing', () => {
    expect(t('nonexistent.key')).toBe('nonexistent.key')
  })

  it('should replace interpolation parameters', () => {
    addTranslations('en', { welcome: 'Welcome, {name}!' })
    expect(t('welcome', { name: 'Alice' })).toBe('Welcome, Alice!')
  })

  it('should leave placeholder untouched when value is not provided', () => {
    addTranslations('en', { greet: 'Hi {name}' })
    expect(t('greet')).toBe('Hi {name}')
  })

  it('should support nested keys via dot notation', () => {
    addTranslations('en', { nav: { home: 'Home', about: 'About' } })
    expect(t('nav.home')).toBe('Home')
    expect(t('nav.about')).toBe('About')
  })

  it('should fall back to fallback locale', () => {
    addTranslations('en', { fallback_test: 'English fallback' })
    setLocale('fr')
    // fr has no 'fallback_test', should fall back to 'en'
    expect(t('fallback_test')).toBe('English fallback')
  })

  it('should check translation existence via te()', () => {
    addTranslations('en', { exists: 'yes' })
    expect(te('exists')).toBe(true)
    expect(te('does_not_exist')).toBe(false)
  })

  it('should return translation message object via tm()', () => {
    addTranslations('en', { section: { title: 'Title' } })
    const msg = tm('section')
    expect(msg).toBeDefined()
    expect(typeof msg).toBe('object')
  })

  it('should report available locales after adding translations', () => {
    addTranslations('de', { hello: 'Hallo' })
    const locales = getAvailableLocales()
    expect(locales).toContain('en')
    expect(locales).toContain('de')
  })

  it('should load multiple locale translations at once', () => {
    loadTranslations({
      es: { hello: 'Hola' },
      it: { hello: 'Ciao' },
    })
    setLocale('es')
    expect(t('hello')).toBe('Hola')
    setLocale('it')
    expect(t('hello')).toBe('Ciao')
  })

  it('trans should be an alias for t', () => {
    expect(trans).toBe(t)
  })
})

describe('I18n instance', () => {
  it('should create an isolated instance via createI18n()', () => {
    const i18n = createI18n({
      locale: 'en',
      messages: { en: { hello: 'Hi' } },
    })
    expect(i18n).toBeInstanceOf(I18n)
    expect(i18n.t('hello')).toBe('Hi')
  })

  it('should support useI18n() composable-style factory', () => {
    const i18n = useI18n({
      locale: 'en',
      messages: { en: { test: 'works' } },
    })
    expect(i18n.t('test')).toBe('works')
  })

  it('should allow changing locale on instance', () => {
    const i18n = createI18n({
      locale: 'en',
      messages: {
        en: { color: 'color' },
        gb: { color: 'colour' },
      },
    })
    expect(i18n.t('color')).toBe('color')
    i18n.setLocale('gb')
    expect(i18n.t('color')).toBe('colour')
  })
})

describe('Pluralization', () => {
  it('should select singular form when count is 1 (English)', () => {
    addTranslations('en', { items: '{count} item | {count} items' })
    expect(tc('items', 1)).toBe('1 item')
  })

  it('should select plural form when count > 1 (English)', () => {
    addTranslations('en', { items: '{count} item | {count} items' })
    expect(tc('items', 5)).toBe('5 items')
  })

  it('should handle zero form when three forms provided', () => {
    addTranslations('en', { apples: 'no apples | {count} apple | {count} apples' })
    // English plural rule: 0 -> 'other', so it picks the third form
    expect(tc('apples', 0)).toBe('0 apples')
  })

  it('should return correct plural category for English', () => {
    expect(getPluralCategory(1, 'en')).toBe('one')
    expect(getPluralCategory(2, 'en')).toBe('other')
    expect(getPluralCategory(0, 'en')).toBe('other')
  })

  it('should return correct plural category for French (0 is one)', () => {
    expect(getPluralCategory(0, 'fr')).toBe('one')
    expect(getPluralCategory(1, 'fr')).toBe('one')
    expect(getPluralCategory(2, 'fr')).toBe('other')
  })

  it('should parse two-form plural string', () => {
    const forms = parsePluralForms('one | many')
    expect(forms.get('one')).toBe('one')
    expect(forms.get('other')).toBe('many')
  })

  it('should parse three-form plural string', () => {
    const forms = parsePluralForms('zero | one | other')
    expect(forms.get('zero')).toBe('zero')
    expect(forms.get('one')).toBe('one')
    expect(forms.get('other')).toBe('other')
  })

  it('should select the correct form via selectPluralForm', () => {
    const forms = parsePluralForms('{count} item | {count} items')
    const selected = selectPluralForm(forms, 1, 'en')
    expect(selected).toBe('{count} item')
  })

  it('should check hasPluralRule for known locales', () => {
    expect(hasPluralRule('en')).toBe(true)
    expect(hasPluralRule('ja')).toBe(true)
    expect(hasPluralRule('xx')).toBe(false)
  })

  it('should allow adding custom plural rules', () => {
    addPluralRule('xx', (n: number) => (n === 1 ? 'one' : 'other'))
    expect(hasPluralRule('xx')).toBe(true)
    expect(getPluralCategory(1, 'xx')).toBe('one')
    expect(getPluralCategory(2, 'xx')).toBe('other')
  })
})

describe('Formatter', () => {
  it('should format a date with medium style', () => {
    setLocale('en')
    const date = new Date(2025, 0, 15) // Jan 15, 2025
    const formatted = formatDate(date, 'medium', 'en')
    expect(formatted).toContain('Jan')
    expect(formatted).toContain('15')
    expect(formatted).toContain('2025')
  })

  it('should format a number with default locale', () => {
    setLocale('en')
    const formatted = formatNumber(1234567.89, {}, 'en')
    expect(formatted).toContain('1')
    expect(formatted).toContain('234')
    expect(formatted).toContain('567')
  })

  it('should format currency (USD)', () => {
    setLocale('en')
    const formatted = formatCurrency(99.99, 'USD', {}, 'en-US')
    expect(formatted).toContain('$')
    expect(formatted).toContain('99.99')
  })

  it('should format currency (EUR) with locale override', () => {
    const formatted = formatCurrency(50, 'EUR', {}, 'de-DE')
    expect(formatted).toContain('50')
    // EUR symbol varies by locale
    expect(formatted.length).toBeGreaterThan(0)
  })

  it('should format percentage', () => {
    setLocale('en')
    const formatted = formatPercent(0.85, {}, 'en')
    expect(formatted).toContain('85')
    expect(formatted).toContain('%')
  })

  it('should format a list in conjunction mode', () => {
    setLocale('en')
    const formatted = formatList(['apples', 'bananas', 'oranges'], 'conjunction', 'long', 'en')
    expect(formatted).toContain('apples')
    expect(formatted).toContain('bananas')
    expect(formatted).toContain('oranges')
    expect(formatted).toContain('and')
  })

  it('should return plural category via formatPlural', () => {
    const category = formatPlural(1, 'en')
    expect(category).toBe('one')
    const categoryMany = formatPlural(5, 'en')
    expect(categoryMany).toBe('other')
  })
})

describe('Loader', () => {
  it('should export loadFile function', () => {
    expect(loadFile).toBeFunction()
  })

  it('should export createLoader factory', () => {
    expect(createLoader).toBeFunction()
  })

  it('should create a loader with load and loadLocale methods', () => {
    const loader = createLoader('/tmp/fake-translations')
    expect(loader.load).toBeFunction()
    expect(loader.loadLocale).toBeFunction()
  })

  it('should throw for unsupported file extension', async () => {
    // loadFile should throw for unknown extensions
    await expect(loadFile('/tmp/test.xyz')).rejects.toThrow()
  })
})
