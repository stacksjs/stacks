import { describe, expect, it } from 'bun:test'
import { expandRecurrence, parseRRule } from '../src/recurrence'

/**
 * stacksjs/stacks#3096. Each expansion below came out wrong before, and the
 * expected dates are what RFC 5545 (and so every calendar client expanding
 * the same feed RRULE) gives, checked against the calendar by hand.
 */
function expand(rule: string, dtstart: string, from: string, to: string): string[] {
  const parsed = parseRRule(rule)
  expect(parsed).not.toBeNull()
  return expandRecurrence(parsed!, new Date(dtstart), new Date(from), new Date(to)).map(date => date.toISOString().slice(0, 10))
}

describe('expandRecurrence follows RFC 5545', () => {
  it('keeps a monthly ordinal weekday going past December', () => {
    // The month index was compared unnormalised, so it matched only until December.
    expect(expand('FREQ=MONTHLY;BYDAY=2TU', '2026-10-13T09:00:00Z', '2026-10-01T00:00:00Z', '2027-04-30T00:00:00Z'))
      .toEqual(['2026-10-13', '2026-11-10', '2026-12-08', '2027-01-12', '2027-02-09', '2027-03-09', '2027-04-13'])
    expect(expand('FREQ=MONTHLY;BYDAY=-1FR', '2026-11-27T09:00:00Z', '2026-11-01T00:00:00Z', '2027-03-31T00:00:00Z'))
      .toEqual(['2026-11-27', '2026-12-25', '2027-01-29', '2027-02-26', '2027-03-26'])
  })

  it('reads a monthly day code with no ordinal as every such day of the month', () => {
    expect(expand('FREQ=MONTHLY;BYDAY=MO', '2026-11-02T09:00:00Z', '2026-11-01T00:00:00Z', '2026-12-31T00:00:00Z'))
      .toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28'])
  })

  it('counts a negative month day from the end of the month', () => {
    expect(expand('FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=4', '2026-10-31T09:00:00Z', '2026-10-01T00:00:00Z', '2027-12-31T00:00:00Z'))
      .toEqual(['2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31'])
  })

  it('intersects BYDAY with BYMONTHDAY within a month (Friday the 13th)', () => {
    expect(expand('FREQ=MONTHLY;BYDAY=FR;BYMONTHDAY=13;COUNT=3', '2026-02-13T20:00:00Z', '2026-01-01T00:00:00Z', '2028-12-31T00:00:00Z'))
      .toEqual(['2026-02-13', '2026-03-13', '2026-11-13'])
  })

  it('lets BYDAY narrow a daily rule to weekdays', () => {
    expect(expand('FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR;COUNT=7', '2026-11-06T09:00:00Z', '2026-11-01T00:00:00Z', '2026-11-30T00:00:00Z'))
      .toEqual(['2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16'])
  })

  it('starts weeks on Monday unless WKST says otherwise', () => {
    expect(expand('FREQ=WEEKLY;INTERVAL=2;BYDAY=SU,MO;COUNT=4', '2026-01-05T09:00:00Z', '2026-01-01T00:00:00Z', '2026-03-01T00:00:00Z'))
      .toEqual(['2026-01-05', '2026-01-11', '2026-01-19', '2026-01-25'])
    expect(expand('FREQ=WEEKLY;INTERVAL=2;BYDAY=SU,MO;COUNT=4;WKST=SU', '2026-01-05T09:00:00Z', '2026-01-01T00:00:00Z', '2026-03-01T00:00:00Z'))
      .toEqual(['2026-01-05', '2026-01-18', '2026-01-19', '2026-02-01'])
  })

  it('skips Feb 29 in a year that does not have one, instead of moving it to March 1', () => {
    expect(expand('FREQ=YEARLY;COUNT=3', '2028-02-29T09:00:00Z', '2028-01-01T00:00:00Z', '2040-12-31T00:00:00Z'))
      .toEqual(['2028-02-29', '2032-02-29', '2036-02-29'])
  })

  it('refuses invalid dates instead of walking forever', () => {
    const rule = parseRRule('FREQ=DAILY')!
    expect(() => expandRecurrence(rule, new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'), new Date('not a date')))
      .toThrow(RangeError)
  })
})

describe('parseRRule refuses what it would misread', () => {
  it('returns null for parts this expander does not implement', () => {
    for (const rule of [
      'FREQ=YEARLY;BYMONTH=11;BYDAY=4TH',
      'FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1',
      'FREQ=YEARLY;BYWEEKNO=20',
      'FREQ=YEARLY;BYYEARDAY=100',
      'FREQ=DAILY;BYHOUR=9,17',
      'FREQ=WEEKLY;X-CUSTOM=1',
    ])
      expect(parseRRule(rule)).toBeNull()
  })

  it('returns null for combinations RFC 5545 rules out or this subset does not cover', () => {
    for (const rule of [
      'FREQ=WEEKLY;BYMONTHDAY=1', // RFC 5545: not with WEEKLY
      'FREQ=WEEKLY;BYDAY=2TU', // an ordinal outside a month
      'FREQ=DAILY;BYDAY=-1FR',
      'FREQ=YEARLY;BYDAY=20MO', // yearly ordinals
      'FREQ=YEARLY;BYMONTHDAY=1',
      'FREQ=DAILY;COUNT=3;UNTIL=20261231', // RFC 5545: never both
    ])
      expect(parseRRule(rule)).toBeNull()
  })

  it('returns null for values it cannot read, instead of guessing', () => {
    for (const rule of [
      'FREQ=DAILY;INTERVAL=0',
      'FREQ=DAILY;INTERVAL=abc',
      'FREQ=DAILY;COUNT=0',
      'FREQ=DAILY;UNTIL=tomorrow',
      'FREQ=MONTHLY;BYMONTHDAY=0',
      'FREQ=MONTHLY;BYMONTHDAY=32',
      'FREQ=MONTHLY;BYDAY=6MO',
      'FREQ=WEEKLY;BYDAY=XX',
      'FREQ=WEEKLY;WKST=XX',
      'FREQ=DAILY;FREQ=WEEKLY',
      'FREQ=DAILY;COUNT',
    ])
      expect(parseRRule(rule)).toBeNull()
  })

  it('still reads the subset, with WKST and negative month days', () => {
    expect(parseRRule('FREQ=WEEKLY;BYDAY=TU,TH;WKST=SU')).toEqual({ freq: 'WEEKLY', interval: 1, byDay: ['TU', 'TH'], weekStart: 'SU' })
    expect(parseRRule('FREQ=MONTHLY;BYDAY=+2TU,-1FR')).toEqual({ freq: 'MONTHLY', interval: 1, byDay: ['2TU', '-1FR'] })
    expect(parseRRule('FREQ=MONTHLY;BYMONTHDAY=1,-1')).toEqual({ freq: 'MONTHLY', interval: 1, byMonthDay: [1, -1] })
    expect(parseRRule('FREQ=DAILY;INTERVAL=2;')).toEqual({ freq: 'DAILY', interval: 2 })
  })
})
