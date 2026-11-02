import { afterEach, describe, expect, it } from 'bun:test'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing'
import { isTimeZone, todayIn } from '../src/calendar'
import { format } from '../src/format'
import { localDateTime } from '../src/local'
import { parse } from '../src/parse'
import { zoneOffsetMinutes } from '../src/zone'

// Building an Intl.DateTimeFormat costs ~0.1 ms; formatting with one costs
// microseconds. A server formats the same few zones thousands of times.
const Original = Intl.DateTimeFormat
let built = 0

function countConstructions(): void {
  built = 0
  const Counting = function (this: unknown, ...args: ConstructorParameters<typeof Intl.DateTimeFormat>) {
    built++
    return new Original(...args)
  } as unknown as typeof Intl.DateTimeFormat
  Counting.supportedLocalesOf = Original.supportedLocalesOf
  Intl.DateTimeFormat = Counting
}

afterEach(() => {
  Intl.DateTimeFormat = Original
})

const instant = new Date('2026-10-25T00:30:00Z')

describe('zoned formatters are built once per zone', () => {
  it('format with a tz reuses its formatters', () => {
    format(instant, 'YYYY-MM-DD HH:mm', { tz: 'Europe/Berlin' })
    countConstructions()
    for (let i = 0; i < 50; i++)
      expect(format(instant, 'YYYY-MM-DD HH:mm', { tz: 'Europe/Berlin' })).toBe('2026-10-25 02:30')
    expect(built).toBe(0)
  })

  it('localDateTime, todayIn, isTimeZone and zoneOffsetMinutes reuse theirs', () => {
    localDateTime(instant, 'America/New_York')
    todayIn('America/New_York', instant)
    zoneOffsetMinutes(instant, 'America/New_York')
    countConstructions()
    for (let i = 0; i < 20; i++) {
      expect(localDateTime(instant, 'America/New_York')).toEqual({ date: '2026-10-24', time: '20:30', timeZone: 'America/New_York' })
      expect(todayIn('America/New_York', instant)).toBe('2026-10-24')
      expect(isTimeZone('America/New_York')).toBe(true)
      expect(zoneOffsetMinutes(instant, 'America/New_York')).toBe(-240)
    }
    expect(built).toBe(0)
  })

  it('a numeric format needs no month or weekday names', async () => {
    // Other files may already have warmed every zone in the shared cache.
    // A fresh process proves both cold construction and subsequent reuse.
    assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/numeric-formatters.ts`, { preload: [], envFile: false }))
  })

  it('month names parse with a shared formatter', () => {
    parse('15 March 2026', 'D MMMM YYYY')
    countConstructions()
    expect(parse('15 March 2026', 'D MMMM YYYY').getMonth()).toBe(2)
    expect(built).toBe(0)
  })
})

describe('shared formatters keep each zone and locale apart', () => {
  it('interleaved zones and locales format correctly', () => {
    for (let i = 0; i < 3; i++) {
      expect(format(instant, 'YYYY-MM-DD HH:mm Z', { tz: 'Europe/Berlin' })).toBe('2026-10-25 02:30 +0200')
      expect(format(instant, 'YYYY-MM-DD HH:mm Z', { tz: 'Pacific/Auckland' })).toBe('2026-10-25 13:30 +1300')
      expect(format(instant, 'dddd D MMMM', { tz: 'Europe/Berlin', locale: 'de' })).toBe('Sonntag 25 Oktober')
      expect(format(instant, 'dddd D MMMM', { tz: 'Europe/Berlin', locale: 'en' })).toBe('Sunday 25 October')
      expect(format(instant, 'ddd d MMM', { tz: 'America/New_York' })).toBe('Sat S Oct')
    }
  })

  it('an unknown zone keeps throwing and is never stored', () => {
    for (let i = 0; i < 2; i++) {
      expect(() => format(instant, 'YYYY', { tz: 'Mars/Olympus' })).toThrow(RangeError)
      expect(isTimeZone('Mars/Olympus')).toBe(false)
      expect(() => todayIn('Mars/Olympus', instant)).toThrow(RangeError)
    }
    expect(localDateTime(instant, 'Mars/Olympus', 'Europe/Berlin').timeZone).toBe('Europe/Berlin')
  })
})
