import assert from 'node:assert/strict'
import { format } from '../../src/format'

const Original = Intl.DateTimeFormat
const constructions: Intl.DateTimeFormatOptions[] = []
const Counting = function (this: unknown, locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
  constructions.push(options ?? {})
  return new Original(locales, options)
} as unknown as typeof Intl.DateTimeFormat
Counting.supportedLocalesOf = Original.supportedLocalesOf
Intl.DateTimeFormat = Counting

try {
  for (let i = 0; i < 3; i++)
    assert.equal(format(new Date('2026-10-25T00:30:00Z'), 'YYYY-MM-DD HH:mm:ss', { tz: 'Asia/Kathmandu' }), '2026-10-25 06:15:00')
  assert.equal(constructions.length, 1, 'numeric formats construct one clock formatter and reuse it')
  assert.equal(constructions[0].month, '2-digit')
  assert.equal(constructions[0].weekday, undefined, 'numeric formats never request weekday names')
}
finally {
  Intl.DateTimeFormat = Original
}
