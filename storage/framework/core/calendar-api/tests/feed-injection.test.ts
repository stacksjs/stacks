import { describe, expect, it } from 'bun:test'
import { buildCalendarFeed } from '../src/feed'

/**
 * stacksjs/stacks#3096. A feed is one body that every subscriber's calendar
 * reads, so a line break in any value it writes unescaped starts lines of the
 * writer's choosing in all of them. `url` came from event data and went out
 * as it was: this one added an alarm to every subscriber.
 */
const event = {
  uid: 'game-1@campushq',
  title: 'Game',
  start: new Date('2026-11-03T22:00:00Z'),
  end: new Date('2026-11-03T23:00:00Z'),
}
const injected = '\r\nBEGIN:VALARM\r\nTRIGGER:-PT1M\r\nEND:VALARM'
const lines = (feed: string) => feed.split('\r\n')

describe('a feed value cannot start a line of its own', () => {
  it('reads a url as URL parsing does, so an injected line goes nowhere', () => {
    const feed = lines(buildCalendarFeed({ name: 'Games', events: [{ ...event, url: `https://campus.test/game${injected}` }] }))
    expect(feed.filter(line => /VALARM|TRIGGER/.test(line) && !line.startsWith('URL:'))).toEqual([])
    expect(feed).toContain('URL:https://campus.test/gameBEGIN:VALARMTRIGGER:-PT1MEND:VALARM')
    expect(feed.filter(line => line === 'BEGIN:VEVENT')).toHaveLength(1)
  })

  it('escapes the calendar-wide text values', () => {
    const feed = lines(buildCalendarFeed({ name: 'Games', timezone: `America/New_York${injected}`, prodId: `-//Campus//EN${injected}`, events: [event] }))
    expect(feed.some(line => line.startsWith('BEGIN:VALARM'))).toBe(false)
    expect(feed.find(line => line.startsWith('X-WR-TIMEZONE:'))).toBe('X-WR-TIMEZONE:America/New_York\\nBEGIN:VALARM\\nTRIGGER:-PT1M\\nEND:VALARM')
  })

  it('refuses a line break where escaping would change the meaning', () => {
    expect(() => buildCalendarFeed({ name: 'Games', events: [{ ...event, rrule: `FREQ=WEEKLY${injected}` }] }))
      .toThrow('event "game-1@campushq": rrule has a control character')
    expect(() => buildCalendarFeed({ name: 'Games', refreshInterval: `PT1H${injected}`, events: [event] }))
      .toThrow('refreshInterval has a control character')
    expect(() => buildCalendarFeed({ name: 'Games', events: [{ ...event, sequence: '2\r\nX' as unknown as number }] }))
      .toThrow('sequence must be a whole number')
  })

  it('leaves an ordinary feed exactly as it was', () => {
    const feed = lines(buildCalendarFeed({
      name: 'Games',
      timezone: 'America/Los_Angeles',
      events: [{ ...event, url: 'https://campus.test/game?id=1&tab=info', rrule: 'FREQ=WEEKLY;BYDAY=TU,TH', sequence: 3 }],
    }))
    expect(feed).toContain('PRODID:-//Stacks//calendar-api//EN')
    expect(feed).toContain('X-WR-TIMEZONE:America/Los_Angeles')
    expect(feed).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT1H')
    expect(feed).toContain('URL:https://campus.test/game?id=1&tab=info')
    expect(feed).toContain('RRULE:FREQ=WEEKLY;BYDAY=TU,TH')
    expect(feed).toContain('SEQUENCE:3')
  })
})
