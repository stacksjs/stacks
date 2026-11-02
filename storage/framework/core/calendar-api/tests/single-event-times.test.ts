import { afterEach, describe, expect, it } from 'bun:test'
import { exportCalendarGoogle, exportCalendarIcs, exportCalendarIcsBody, exportCalendarOutlook, exportCalendarYahoo } from '../src/index'

/**
 * stacksjs/stacks#3096. Every single-event export wrote its times on a 12-hour
 * clock, through a re-anchoring that followed the host's timezone, so an event
 * at 17:00 UTC was offered at 05:00. The tests above never pinned a time, and
 * their event is at 10:00, where the two clocks agree. This one is at 17:00,
 * and runs again on a host that is not on UTC.
 */
const event = {
  title: 'Team meeting, weekly',
  description: 'Weekly standup',
  address: 'Room 2; North Campus',
  from: new Date('2026-10-12T17:00:00Z'),
  to: new Date('2026-10-12T18:00:00Z'),
  timezone: 'America/New_York',
  allDay: false,
}
const hostZone = process.env.TZ

// Set back, not deleted: `bun test` starts with TZ unset and runs in UTC, and
// deleting TZ leaves the process in the last zone set, for every file after
// this one in the same run.
afterEach(() => {
  process.env.TZ = hostZone ?? 'UTC'
})

function decode(dataUrl: string): string {
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]!), char => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

describe('an afternoon event', () => {
  for (const zone of ['UTC', 'America/New_York', 'Asia/Manila']) {
    it(`is exported at 17:00 UTC everywhere, on a host in ${zone}`, () => {
      process.env.TZ = zone
      // The control: the host's zone really is the one named.
      expect(new Date('2026-10-12T17:00:00Z').getHours()).toBe({ 'UTC': 17, 'America/New_York': 13, 'Asia/Manila': 1 }[zone])

      expect(exportCalendarGoogle(event)).toContain('dates=20261012T170000Z/20261012T180000Z&ctz=America/New_York')
      expect(exportCalendarOutlook(event)).toContain('startdt=2026-10-12T17:00:00Z&enddt=2026-10-12T18:00:00Z')
      expect(exportCalendarYahoo(event)).toContain('ST=20261012T170000Z&ET=20261012T180000Z')

      const body = exportCalendarIcsBody(event).split('\r\n')
      expect(body).toContain('DTSTART:20261012T170000Z')
      expect(body).toContain('DTEND:20261012T180000Z')
      // No TZID without a VTIMEZONE, and a UTC DTSTAMP as RFC 5545 requires.
      expect(body.some(line => line.includes('TZID'))).toBe(false)
      expect(body.find(line => line.startsWith('DTSTAMP'))).toMatch(/^DTSTAMP:\d{8}T\d{6}Z$/)
    })
  }

  it('gives a 10:00 and a 22:00 event of the same name different UIDs', () => {
    // In UTC, where a 12-hour rendering of the two is identical.
    process.env.TZ = 'UTC'
    const uid = (from: string, to: string) => exportCalendarIcsBody({ ...event, from: new Date(from), to: new Date(to) })
      .split('\r\n').find(line => line.startsWith('UID:'))
    expect(uid('2026-10-12T10:00:00Z', '2026-10-12T11:00:00Z')).not.toBe(uid('2026-10-12T22:00:00Z', '2026-10-12T23:00:00Z'))
  })
})

describe('the ICS file', () => {
  it('escapes its text and says the description as DESCRIPTION', () => {
    const body = exportCalendarIcsBody({ ...event, description: 'Line one\nLine two' }).split('\r\n')
    expect(body).toContain('SUMMARY:Team meeting\\, weekly')
    expect(body).toContain('LOCATION:Room 2\\; North Campus')
    expect(body).toContain('DESCRIPTION:Line one\\nLine two')
    expect(body.some(line => line.startsWith('X-ALT-DESC'))).toBe(false)
  })

  it('marks an all-day start as a DATE', () => {
    const body = exportCalendarIcsBody({ ...event, allDay: true, from: new Date('2026-10-12T00:00:00Z'), to: new Date('2026-10-14T00:00:00Z') }).split('\r\n')
    expect(body).toContain('DTSTART;VALUE=DATE:20261012')
    expect(body).toContain('DURATION:P2D')
  })

  it('takes any title, not only Latin-1, and round-trips it', () => {
    for (const title of ['Parent–teacher night', '运动会', 'Field day 🏃'])
      expect(decode(exportCalendarIcs({ ...event, title }))).toContain(`SUMMARY:${title}`)
  })
})
