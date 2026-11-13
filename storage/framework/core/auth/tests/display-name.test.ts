/**
 * What a display name may be, and what of it a mail may print.
 *
 * The cases are the ones found on production services on 2026-11-13 (a
 * gambling advert with a shortened link, registered as a name) and the real
 * names the rule must not refuse while refusing those.
 */

import { describe, expect, test } from 'bun:test'
import { DISPLAY_NAME_MAX_LENGTH, displayNameMessage, displayNameProblem, greetingName, normalizeDisplayName } from '../src/display-name'

describe('displayNameProblem', () => {
  const real = [
    'Ada Lovelace',
    'Ava',
    'J.R.R. Tolkien',
    'Dr. Ngozi Okafor',
    'Martin Luther King Jr.',
    'Seán O\'Brien',
    'D’Angelo Russell',
    'Jean-Luc Picard',
    'Katherine (Kate) Johnson',
    'Smith, John',
    'Nguyễn Thị Minh Khai',
    '王小明',
    'محمد بن سلمان',
    'می‌خواهم',
    'Zoë 2nd',
  ]

  for (const name of real) {
    test(`accepts ${name}`, () => {
      expect(displayNameProblem(name)).toBeNull()
    })
  }

  const links = [
    'KAZAN 70.000 TL bonus bit.ly/3xQ',
    'Visit example.com today',
    'https://example.com',
    'www.example.com',
    'WWW.EXAMPLE.COM',
    'win at casino.xyz',
    'ｂｉｔ．ｌｙ／ｘ', // full-width letters, dot and slash fold to bit.ly/x
    'someone@example.com',
    't.me\\promo',
  ]

  for (const name of links) {
    test(`refuses the link in ${name}`, () => {
      expect(displayNameProblem(name)).toBe('link')
    })
  }

  test('refuses markup', () => {
    expect(displayNameProblem('<a href=x>Ada</a>')).toBe('markup')
    expect(displayNameProblem('Ada <b>')).toBe('markup')
  })

  test('refuses control and invisible characters', () => {
    expect(displayNameProblem('Ada\nBcc: victim')).toBe('control')
    expect(displayNameProblem('Ada\u0000')).toBe('control')
    expect(displayNameProblem('Ada‮evoL')).toBe('control')
    expect(displayNameProblem('Ada​Lovelace')).toBe('control')
  })

  test('refuses symbols a name does not use', () => {
    expect(displayNameProblem('Ada $$$ Lovelace')).toBe('characters')
    expect(displayNameProblem('Win 🎰 now')).toBe('characters')
    expect(displayNameProblem('Ada: 50% off!')).toBe('characters')
  })

  test('bounds the length', () => {
    expect(displayNameProblem('A')).toBe('too_short')
    expect(displayNameProblem('a'.repeat(DISPLAY_NAME_MAX_LENGTH))).toBeNull()
    expect(displayNameProblem('a'.repeat(DISPLAY_NAME_MAX_LENGTH + 1))).toBe('too_long')
    expect(displayNameProblem('   ')).toBe('empty')
    expect(displayNameProblem(undefined)).toBe('empty')
    expect(displayNameProblem(42)).toBe('empty')
  })

  test('every problem has a sentence without an em-dash', () => {
    for (const problem of ['empty', 'too_short', 'too_long', 'control', 'markup', 'link', 'characters'] as const) {
      expect(displayNameMessage(problem).length).toBeGreaterThan(10)
      expect(displayNameMessage(problem)).not.toMatch(/[–—]/)
    }
  })
})

describe('normalizeDisplayName', () => {
  test('collapses whitespace and trims', () => {
    expect(normalizeDisplayName('  Ada \t  Lovelace ')).toBe('Ada Lovelace')
  })

  test('is empty for anything that is not a string', () => {
    expect(normalizeDisplayName(null)).toBe('')
  })
})

describe('greetingName', () => {
  test('is the first name', () => {
    expect(greetingName('Ada Lovelace')).toBe('Ada')
    expect(greetingName('  Jean-Luc   Picard')).toBe('Jean-Luc')
    expect(greetingName('Smith, John')).toBe('Smith')
    expect(greetingName('Ava')).toBe('Ava')
  })

  test('is nothing for a name that would not pass registration', () => {
    // Rows written before the rule existed are still in the table.
    expect(greetingName('KAZAN 70.000 TL bonus bit.ly/3xQ')).toBeUndefined()
    expect(greetingName('<b>Ada</b>')).toBeUndefined()
    expect(greetingName('a'.repeat(200))).toBeUndefined()
    expect(greetingName(undefined)).toBeUndefined()
    expect(greetingName('')).toBeUndefined()
  })

  test('is nothing when the first word is not a name', () => {
    expect(greetingName('70000 TL BONUS')).toBeUndefined()
    expect(greetingName(`${'a'.repeat(40)} b`)).toBeUndefined()
  })
})
