import { describe, expect, it } from 'bun:test'
import { camelCase, kebabCase, snakeCase } from '../src/case'
import { mask } from '../src/helpers'
import { ensurePrefix, truncate } from '../src/utils'

describe('truncate', () => {
  it('never gives back more characters than it was asked for', () => {
    expect(truncate('hello world', 8)).toBe('hello...')
    expect(truncate('hello world', 2)).toBe('..')
    expect(truncate('hello world', 0)).toBe('')
    expect(truncate('hello world', -3)).toBe('')
    expect(truncate('hello world', 11)).toBe('hello world')
  })

  it('counts an emoji as one character and never cuts one in half', () => {
    expect(truncate('😀😀😀😀😀', 4)).toBe('😀...')
    expect(truncate('😀😀😀😀', 4)).toBe('😀😀😀😀')
    expect(truncate('a😀bcdef', 5, '…')).toBe('a😀bc…')
  })
})

describe('mask', () => {
  it('masks characters, not halves of an emoji', () => {
    expect(mask('😀abc', '*', 1)).toBe('😀***')
    expect(mask('ab😀cd', '*', 2, 1)).toBe('ab*cd')
    expect(mask('abc', '🔒', 1)).toBe('a🔒🔒')
  })
})

describe('case conversion keeps marks, and digits from any script', () => {
  it('keeps a word whose vowels are combining marks whole', () => {
    expect(kebabCase('नमस्ते दुनिया')).toBe('नमस्ते-दुनिया')
    expect(snakeCase('สวัสดีครับ')).toBe('สวัสดีครับ')
  })

  it('keeps a decomposed accent on its letter', () => {
    expect(camelCase('cafe\u0301 au lait')).toBe('cafe\u0301AuLait')
  })

  it('keeps an Arabic-Indic digit', () => {
    expect(kebabCase('صفحة ٣')).toBe('صفحة-٣')
  })
})

describe('documented examples', () => {
  it('ensurePrefix leaves a string that already has the prefix alone', () => {
    expect(ensurePrefix('https://', 'google.com')).toBe('https://google.com')
    expect(ensurePrefix('https://', 'https://google.com')).toBe('https://google.com')
  })
})
