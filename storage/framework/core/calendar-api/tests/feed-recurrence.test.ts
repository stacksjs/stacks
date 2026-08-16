import { describe, expect, it } from 'bun:test'
import { buildCalendarFeed, escapeIcsText, foldIcsLine } from '../src/feed'
import { expandRecurrence, parseRRule } from '../src/recurrence'

describe('parseRRule', () => {
  it('parses the school subset', () => {
    expect(parseRRule('FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10')).toEqual({
      freq: 'WEEKLY',
      interval: 1,
      count: 10,
      byDay: ['MO', 'WE'],
    })
    expect(parseRRule('RRULE:FREQ=MONTHLY;INTERVAL=2;BYDAY=2TU')).toEqual({
      freq: 'MONTHLY',
      interval: 2,
      byDay: ['2TU'],
    })
    expect(parseRRule('FREQ=SECONDLY')).toBeNull()
  })

  it('parses UNTIL in both shapes', () => {
    expect(parseRRule('FREQ=DAILY;UNTIL=20260901')?.until?.toISOString()).toBe('2026-09-01T23:59:59.000Z')
    expect(parseRRule('FREQ=DAILY;UNTIL=20260901T120000Z')?.until?.toISOString()).toBe('2026-09-01T12:00:00.000Z')
  })
})

describe('expandRecurrence', () => {
  const window = (from: string, to: string) => [new Date(from), new Date(to)] as const

  it('daily with interval and count', () => {
    const rule = parseRRule('FREQ=DAILY;INTERVAL=2;COUNT=4')!
    const [start, end] = window('2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z')
    const dates = expandRecurrence(rule, new Date('2026-09-01T15:00:00Z'), start, end)
    expect(dates.map(date => date.toISOString().slice(0, 10))).toEqual(['2026-09-01', '2026-09-03', '2026-09-05', '2026-09-07'])
  })

  it('weekly BYDAY keeps the anchor clock time', () => {
    const rule = parseRRule('FREQ=WEEKLY;BYDAY=MO,FR')!
    const [start, end] = window('2026-09-07T00:00:00Z', '2026-09-18T23:59:59Z')
    // Anchor: Friday Sep 4, 3:30pm UTC.
    const dates = expandRecurrence(rule, new Date('2026-09-04T15:30:00Z'), start, end)
    expect(dates.map(date => date.toISOString())).toEqual([
      '2026-09-07T15:30:00.000Z',
      '2026-09-11T15:30:00.000Z',
      '2026-09-14T15:30:00.000Z',
      '2026-09-18T15:30:00.000Z',
    ])
  })

  it('monthly ordinal weekday (second Tuesday)', () => {
    const rule = parseRRule('FREQ=MONTHLY;BYDAY=2TU')!
    const [start, end] = window('2026-09-01T00:00:00Z', '2026-11-30T00:00:00Z')
    const dates = expandRecurrence(rule, new Date('2026-09-08T19:00:00Z'), start, end)
    expect(dates.map(date => date.toISOString().slice(0, 10))).toEqual(['2026-09-08', '2026-10-13', '2026-11-10'])
  })

  it('monthly by month-day skips short months', () => {
    const rule = parseRRule('FREQ=MONTHLY;BYMONTHDAY=31')!
    const [start, end] = window('2027-01-01T00:00:00Z', '2027-04-30T00:00:00Z')
    const dates = expandRecurrence(rule, new Date('2027-01-31T00:00:00Z'), start, end)
    expect(dates.map(date => date.toISOString().slice(0, 10))).toEqual(['2027-01-31', '2027-03-31'])
  })

  it('honors UNTIL from the anchor even mid-window', () => {
    const rule = parseRRule('FREQ=DAILY;UNTIL=20260903')!
    const [start, end] = window('2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z')
    const dates = expandRecurrence(rule, new Date('2026-09-01T09:00:00Z'), start, end)
    expect(dates).toHaveLength(3)
  })
})

describe('buildCalendarFeed', () => {
  it('emits a multi-event VCALENDAR with escaping and RRULE passthrough', () => {
    const feed = buildCalendarFeed({
      name: 'Lakeside; Athletics',
      timezone: 'America/Los_Angeles',
      events: [
        {
          uid: 'game-1@campushq',
          title: 'Soccer vs. St. Mary\'s, Away',
          start: new Date('2026-09-12T22:00:00Z'),
          end: new Date('2026-09-12T23:30:00Z'),
          location: 'Field 2; North Campus',
          sequence: 2,
        },
        {
          uid: 'practice@campushq',
          title: 'Practice',
          start: new Date('2026-09-01T22:00:00Z'),
          end: new Date('2026-09-01T23:00:00Z'),
          rrule: 'FREQ=WEEKLY;BYDAY=TU,TH',
        },
      ],
    })

    expect(feed).toContain('X-WR-CALNAME:Lakeside\\; Athletics')
    expect(feed).toContain('SUMMARY:Soccer vs. St. Mary\'s\\, Away')
    expect(feed).toContain('LOCATION:Field 2\\; North Campus')
    expect(feed).toContain('RRULE:FREQ=WEEKLY;BYDAY=TU,TH')
    expect(feed).toContain('SEQUENCE:2')
    expect(feed.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(feed.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(feed.trim().endsWith('END:VCALENDAR')).toBe(true)
  })

  it('all-day events use exclusive DATE DTEND', () => {
    const feed = buildCalendarFeed({
      name: 'Holidays',
      events: [{
        uid: 'break@campushq',
        title: 'Fall break',
        start: new Date('2026-10-12T00:00:00Z'),
        end: new Date('2026-10-13T00:00:00Z'),
        allDay: true,
      }],
    })
    expect(feed).toContain('DTSTART;VALUE=DATE:20261012')
    expect(feed).toContain('DTEND;VALUE=DATE:20261014')
  })

  it('folds long lines to 75 octets', () => {
    const folded = foldIcsLine(`DESCRIPTION:${'a'.repeat(200)}`)
    for (const line of folded.split('\r\n'))
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75)
    expect(folded.split('\r\n').length).toBeGreaterThan(1)
  })

  it('escapes newlines in text', () => {
    expect(escapeIcsText('line one\nline two')).toBe('line one\\nline two')
  })
})
