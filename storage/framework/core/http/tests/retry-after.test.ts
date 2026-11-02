import { expect, test } from 'bun:test'
import { retryAfterMilliseconds } from '../src/index'

test('Retry-After accepts seconds and HTTP dates without coercing malformed headers', () => {
  const now = Date.parse('2026-11-01T08:00:00Z')
  expect(retryAfterMilliseconds(' 120 ', now)).toBe(120000)
  expect(retryAfterMilliseconds('0.0011', now)).toBe(2)
  expect(retryAfterMilliseconds('Sun, 01 Nov 2026 08:05:00 GMT', now)).toBe(300000)
  expect(retryAfterMilliseconds('Sun, 01 Nov 2026 07:00:00 GMT', now)).toBe(0)
  for (const value of [null, '', '-1', 'Infinity', '1e3', '2026-11', 'Sunday', '999999999999999999999'])
    expect(retryAfterMilliseconds(value, now)).toBeNull()
})
