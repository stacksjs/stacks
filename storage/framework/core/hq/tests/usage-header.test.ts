import { describe, expect, test } from 'bun:test'
import { formatUsageHeader, parseUsageHeader, USAGE_HEADER } from '../src/meter'

describe('X-HQ-Usage', () => {
  test('is named X-HQ-Usage', () => {
    expect(USAGE_HEADER).toBe('X-HQ-Usage')
  })

  test('formats meter;used;limit;state;upgrade=<url>', () => {
    expect(formatUsageHeader({ meter: 'errors', used: 412, limit: 500, state: 'warn', upgradeUrl: 'https://bughq.test/pricing' }))
      .toBe('errors;412;500;warn;upgrade=https%3A%2F%2Fbughq.test%2Fpricing')
  })

  test('round-trips, including a URL holding the separators', () => {
    const cases = [
      { meter: 'errors', used: 0, limit: 500, state: 'ok' as const, upgradeUrl: 'https://bughq.test/pricing' },
      { meter: 'log_lines', used: 12_500, limit: 10_000, state: 'sampled' as const, upgradeUrl: 'https://loghq.test/upgrade?a=1;b=2,c' },
      { meter: 'emails.sent', used: 7, limit: null, state: 'ok' as const, upgradeUrl: null },
    ]
    for (const usage of cases)
      expect(parseUsageHeader(formatUsageHeader(usage))).toEqual(usage)
  })

  test('answers null for anything malformed rather than throwing', () => {
    const malformed = [null, undefined, '', 'errors', 'errors;1;2', 'errors;x;500;ok', 'errors;1;500;fine', 'errors;-1;500;ok', 'bad meter;1;2;ok', 'errors;1;500;ok;upgrade=%E0%A4%A', 'x'.repeat(3000)]
    for (const value of malformed)
      expect(parseUsageHeader(value)).toBeNull()
  })

  test('ignores an upgrade target that is not http(s), and unknown parameters', () => {
    expect(parseUsageHeader('errors;1;500;ok;upgrade=javascript%3Aalert(1);future=1'))
      .toEqual({ meter: 'errors', used: 1, limit: 500, state: 'ok', upgradeUrl: null })
  })

  test('refuses to format a meter name that would break the header', () => {
    expect(() => formatUsageHeader({ meter: 'a;b', used: 1, limit: 2, state: 'ok', upgradeUrl: null })).toThrow(TypeError)
  })
})
