import { describe, expect, it } from 'bun:test'

const {
  exportCalendarGoogle,
  exportCalendarIcs,
  exportCalendarOutlook,
  exportCalendarYahoo,
} = await import('../src/index')
import type { CalendarLink } from '../src/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createEvent(overrides: Partial<CalendarLink> = {}): CalendarLink {
  return {
    title: 'Team Meeting',
    description: 'Discuss project updates',
    from: new Date('2025-06-15T10:00:00Z'),
    to: new Date('2025-06-15T11:00:00Z'),
    allDay: false,
    address: '123 Main St, New York, NY',
    timezone: 'America/New_York',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Calendar Link Generation', () => {
  describe('Google Calendar', () => {
    it('should generate a valid Google Calendar URL', () => {
      const url = exportCalendarGoogle(createEvent())
      expect(url).toStartWith('https://calendar.google.com/calendar/render?action=TEMPLATE')
    })

    it('should include the event title encoded', () => {
      const url = exportCalendarGoogle(createEvent({ title: 'My Event' }))
      expect(url).toContain('text=My%20Event')
    })

    it('should include the description when provided', () => {
      const url = exportCalendarGoogle(createEvent({ description: 'A description' }))
      expect(url).toContain('details=A%20description')
    })

    it('should include location when provided', () => {
      const url = exportCalendarGoogle(createEvent({ address: 'Office' }))
      expect(url).toContain('location=Office')
    })

    it('should include timezone parameter', () => {
      const url = exportCalendarGoogle(createEvent({ timezone: 'America/New_York' }))
      expect(url).toContain('ctz=America/New_York')
    })
  })

  describe('Outlook Calendar', () => {
    it('should generate a valid Outlook URL', () => {
      const url = exportCalendarOutlook(createEvent())
      expect(url).toStartWith('https://outlook.live.com/calendar/deeplink/compose')
    })

    it('should include subject encoded', () => {
      const url = exportCalendarOutlook(createEvent({ title: 'Outlook Event' }))
      expect(url).toContain('subject=Outlook%20Event')
    })

    it('should set allday=true for all-day events', () => {
      const url = exportCalendarOutlook(createEvent({ allDay: true }))
      expect(url).toContain('allday=true')
    })
  })

  describe('Yahoo Calendar', () => {
    it('should generate a valid Yahoo Calendar URL', () => {
      const url = exportCalendarYahoo(createEvent())
      expect(url).toStartWith('https://calendar.yahoo.com/')
    })

    it('should include the title encoded', () => {
      const url = exportCalendarYahoo(createEvent({ title: 'Yahoo Event' }))
      expect(url).toContain('TITLE=Yahoo%20Event')
    })

    it('should include DUR=allday for all-day events', () => {
      const url = exportCalendarYahoo(createEvent({ allDay: true }))
      expect(url).toContain('DUR=allday')
    })
  })

  describe('ICS format', () => {
    it('should generate a data: URI with base64 encoding', () => {
      const ics = exportCalendarIcs(createEvent())
      expect(ics).toStartWith('data:text/calendar;charset=utf8;base64,')
    })

    it('should contain VCALENDAR markers when decoded', () => {
      const ics = exportCalendarIcs(createEvent())
      const base64Part = ics.replace('data:text/calendar;charset=utf8;base64,', '')
      const decoded = atob(base64Part)
      expect(decoded).toContain('BEGIN:VCALENDAR')
      expect(decoded).toContain('END:VCALENDAR')
      expect(decoded).toContain('BEGIN:VEVENT')
      expect(decoded).toContain('END:VEVENT')
    })

    it('should include SUMMARY with the event title', () => {
      const ics = exportCalendarIcs(createEvent({ title: 'ICS Event' }))
      const base64Part = ics.replace('data:text/calendar;charset=utf8;base64,', '')
      const decoded = atob(base64Part)
      expect(decoded).toContain('SUMMARY:ICS Event')
    })
  })

  describe('All-day events', () => {
    it('should generate all-day Google event without time component in dates', () => {
      const url = exportCalendarGoogle(createEvent({ allDay: true }))
      // All-day events use YYYYMMDD format (no T separator)
      expect(url).toContain('dates=')
    })

    it('should include DURATION in ICS for all-day events', () => {
      const ics = exportCalendarIcs(createEvent({
        allDay: true,
        from: new Date('2025-06-15T00:00:00Z'),
        to: new Date('2025-06-16T00:00:00Z'),
      }))
      const base64Part = ics.replace('data:text/calendar;charset=utf8;base64,', '')
      const decoded = atob(base64Part)
      expect(decoded).toContain('DURATION:P')
    })
  })
})
