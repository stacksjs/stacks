import { describe, expect, test } from 'bun:test'
import { matchBoundedRegex, RegexTimeoutError } from '../src/regex'

// Functional assertions allow process startup under CI load. The deadline test
// below still exercises the production-sized 25 ms execution limit.
const functionalBudget = { timeoutMs: 1000 }

describe('matchBoundedRegex', () => {
  test('returns the first match and its offset', () => {
    expect(matchBoundedRegex('acme_[A-Za-z0-9]{32}', `token acme_${'a'.repeat(32)}`, functionalBudget))
      .toEqual({ value: `acme_${'a'.repeat(32)}`, index: 6 })
    expect(matchBoundedRegex('absent', 'ordinary text', functionalBudget)).toBeNull()
    expect(matchBoundedRegex('TOKEN', 'token', { ...functionalBudget, flags: 'i' })?.value).toBe('token')
  })

  test('terminates catastrophic matching rather than waiting for the engine', () => {
    const started = performance.now()
    expect(() => matchBoundedRegex('(a+)+$', `${'a'.repeat(2000)}!`, { timeoutMs: 25 }))
      .toThrow(RegexTimeoutError)
    expect(performance.now() - started).toBeLessThan(1000)
    expect(matchBoundedRegex('healthy', 'healthy', functionalBudget)?.value).toBe('healthy')
  })

  test('treats patterns and subjects as data, including quotes and newlines', () => {
    expect(matchBoundedRegex('a["\n]b', 'a"b', functionalBudget)).toEqual({ value: 'a"b', index: 0 })
    expect(matchBoundedRegex('a["\n]b', 'a\nb', functionalBudget)).toEqual({ value: 'a\nb', index: 0 })
  })

  test('rejects invalid expressions, flags, budgets and oversized inputs', () => {
    expect(() => matchBoundedRegex('([', 'subject', functionalBudget)).toThrow(SyntaxError)
    expect(() => matchBoundedRegex('x', 'subject', { ...functionalBudget, flags: 'invalid' })).toThrow(SyntaxError)
    expect(() => matchBoundedRegex('x', 'subject', { flags: 'i'.repeat(8193) })).toThrow(SyntaxError)
    for (const timeoutMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5, 1001])
      expect(() => matchBoundedRegex('x', 'subject', { timeoutMs })).toThrow(RangeError)
    expect(() => matchBoundedRegex('x'.repeat(8193), 'subject')).toThrow(RangeError)
    expect(() => matchBoundedRegex('x', 's'.repeat(65537))).toThrow(RangeError)
  })
})
