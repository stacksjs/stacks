import { describe, expect, test } from 'bun:test'
import { matchBoundedRegex, RegexTimeoutError } from '../src/regex'

describe('matchBoundedRegex', () => {
  test('returns the first match and its offset', () => {
    expect(matchBoundedRegex('acme_[A-Za-z0-9]{32}', `token acme_${'a'.repeat(32)}`))
      .toEqual({ value: `acme_${'a'.repeat(32)}`, index: 6 })
    expect(matchBoundedRegex('absent', 'ordinary text')).toBeNull()
    expect(matchBoundedRegex('TOKEN', 'token', { flags: 'i' })?.value).toBe('token')
  })

  test('terminates catastrophic matching rather than waiting for the engine', () => {
    const started = performance.now()
    expect(() => matchBoundedRegex('(a+)+$', `${'a'.repeat(2000)}!`, { timeoutMs: 25 }))
      .toThrow(RegexTimeoutError)
    expect(performance.now() - started).toBeLessThan(1000)
    expect(matchBoundedRegex('healthy', 'healthy')?.value).toBe('healthy')
  })

  test('treats patterns and subjects as data, including quotes and newlines', () => {
    expect(matchBoundedRegex('a["\n]b', 'a"b')).toEqual({ value: 'a"b', index: 0 })
    expect(matchBoundedRegex('a["\n]b', 'a\nb')).toEqual({ value: 'a\nb', index: 0 })
  })

  test('rejects invalid expressions, flags, budgets and oversized inputs', () => {
    expect(() => matchBoundedRegex('([', 'subject')).toThrow(SyntaxError)
    expect(() => matchBoundedRegex('x', 'subject', { flags: 'invalid' })).toThrow(SyntaxError)
    expect(() => matchBoundedRegex('x', 'subject', { flags: 'i'.repeat(8193) })).toThrow(SyntaxError)
    for (const timeoutMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5, 1001])
      expect(() => matchBoundedRegex('x', 'subject', { timeoutMs })).toThrow(RangeError)
    expect(() => matchBoundedRegex('x'.repeat(8193), 'subject')).toThrow(RangeError)
    expect(() => matchBoundedRegex('x', 's'.repeat(65537))).toThrow(RangeError)
  })
})
