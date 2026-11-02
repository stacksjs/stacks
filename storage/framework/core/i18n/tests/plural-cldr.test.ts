import { describe, expect, it } from 'bun:test'
import { addTranslations, getPluralCategory, hasPluralRule, tc } from '../src/index'

/**
 * The plural rules were a hand-written table of 33 languages. Against
 * Intl.PluralRules, the runtime's CLDR data, 196 of 1815 cases disagreed: 19
 * common languages were missing and said `other` even for 1, and several
 * present ones were wrong (Hebrew's dual, Latvian's zero, Portuguese 0).
 */
describe('plural categories follow CLDR', () => {
  it('knows the languages the table left out, which said "other" for 1', () => {
    for (const locale of ['ca', 'hr', 'sr', 'bg', 'is', 'et', 'nb', 'fa', 'bn', 'ta'])
      expect(getPluralCategory(1, locale)).toBe('one')
    expect(['hr', 'sr', 'bs'].map(l => [getPluralCategory(21, l), getPluralCategory(22, l), getPluralCategory(25, l)]))
      .toEqual([['one', 'few', 'other'], ['one', 'few', 'other'], ['one', 'few', 'other']])
  })

  it('gets right what the table had wrong', () => {
    expect(getPluralCategory(2, 'he')).toBe('two')
    expect(getPluralCategory(10, 'lv')).toBe('zero')
    // Brazilian Portuguese counts 0 as one; European Portuguese does not.
    expect(getPluralCategory(0, 'pt')).toBe('one')
    expect(getPluralCategory(0, 'pt-PT')).toBe('other')
  })

  it('agrees with Intl.PluralRules across languages and numbers', () => {
    for (const locale of ['en', 'fr', 'ru', 'pl', 'ar', 'cy', 'ga', 'ca', 'hr', 'he', 'lv', 'pt', 'ja']) {
      const cldr = new Intl.PluralRules(locale)
      for (const n of [0, 1, 2, 3, 5, 11, 21, 22, 101, 1000000, 0.5, 1.5])
        expect(`${locale} ${n}: ${getPluralCategory(n, locale)}`).toBe(`${locale} ${n}: ${cldr.select(n)}`)
    }
  })

  it('still says "other" for a language the runtime has no rules for', () => {
    expect(getPluralCategory(1, 'qq')).toBe('other')
    expect(hasPluralRule('qq')).toBe(false)
    expect(hasPluralRule('ca')).toBe(true)
  })

  it('picks the singular for 1 in a translation, in a language the table did not have', () => {
    addTranslations('ca', { files: '{count} fitxer | {count} fitxers' })
    expect(tc('files', 1, {}, 'ca')).toBe('1 fitxer')
    expect(tc('files', 3, {}, 'ca')).toBe('3 fitxers')
  })
})
