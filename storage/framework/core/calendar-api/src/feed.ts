/**
 * Subscribable calendar feeds: many events, one `text/calendar` body a
 * parent adds once (`webcal://.../calendar.ics`) and their calendar app
 * refreshes forever. This is the counterpart to the single-event
 * "add to calendar" links the generators produce.
 */

export interface CalendarFeedEvent {
  /** Stable per event - a changed UID reads as delete + recreate. */
  uid: string
  title: string
  start: Date
  end: Date
  allDay?: boolean
  description?: string
  location?: string
  url?: string
  /** RFC 5545 RRULE value (no `RRULE:` prefix); clients expand it themselves. */
  rrule?: string
  /** Bump on every edit so clients pick the newer copy. */
  sequence?: number
  /** Last modification, for SEQUENCE tie-breaking. */
  updatedAt?: Date
}

export interface CalendarFeedOptions {
  /** Calendar display name (X-WR-CALNAME). */
  name: string
  /** Advisory IANA timezone for the calendar as a whole. */
  timezone?: string
  /** Suggested refresh cadence. @default 'PT1H' */
  refreshInterval?: string
  prodId?: string
  events: CalendarFeedEvent[]
}

/** RFC 5545 TEXT escaping: backslash, semicolon, comma, newline. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Fold lines longer than 75 octets with CRLF + space continuations. */
export function foldIcsLine(line: string): string {
  if (Buffer.byteLength(line, 'utf8') <= 75)
    return line

  const pieces: string[] = []
  let current = ''
  for (const char of line) {
    // +1 leading space on continuation lines keeps every physical line <= 75.
    const limit = pieces.length === 0 ? 75 : 74
    if (Buffer.byteLength(current + char, 'utf8') > limit) {
      pieces.push(current)
      current = char
    }
    else {
      current += char
    }
  }
  if (current)
    pieces.push(current)

  return pieces.map((piece, index) => (index === 0 ? piece : ` ${piece}`)).join('\r\n')
}

function utcStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`
}

function dateStamp(date: Date): string {
  return date.toISOString().replace(/-/g, '').slice(0, 8)
}

/** The complete VCALENDAR body. Serve with {@link calendarFeedHeaders}. */
export function buildCalendarFeed(options: CalendarFeedOptions): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${options.prodId ?? '-//Stacks//calendar-api//EN'}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(options.name)}`,
  ]

  if (options.timezone)
    lines.push(`X-WR-TIMEZONE:${options.timezone}`)

  lines.push(`REFRESH-INTERVAL;VALUE=DURATION:${options.refreshInterval ?? 'PT1H'}`)

  for (const event of options.events) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${escapeIcsText(event.uid)}`)
    lines.push(`DTSTAMP:${utcStamp(event.updatedAt ?? event.start)}`)
    lines.push(`SUMMARY:${escapeIcsText(event.title)}`)

    if (event.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(event.start)}`)
      // DTEND on all-day events is exclusive.
      const end = new Date(event.end)
      end.setUTCDate(end.getUTCDate() + 1)
      lines.push(`DTEND;VALUE=DATE:${dateStamp(end)}`)
    }
    else {
      lines.push(`DTSTART:${utcStamp(event.start)}`)
      lines.push(`DTEND:${utcStamp(event.end)}`)
    }

    if (event.rrule)
      lines.push(`RRULE:${event.rrule.replace(/^RRULE:/i, '')}`)
    if (event.description)
      lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`)
    if (event.location)
      lines.push(`LOCATION:${escapeIcsText(event.location)}`)
    if (event.url)
      lines.push(`URL:${event.url}`)
    if (event.sequence !== undefined)
      lines.push(`SEQUENCE:${event.sequence}`)

    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.map(foldIcsLine).join('\r\n')
}

/** Response headers for serving a feed at a stable URL. */
export function calendarFeedHeaders(filename = 'calendar.ics'): Record<string, string> {
  return {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `inline; filename="${filename}"`,
    // Feeds are polled by calendar clients on their own schedule; a short
    // shared cache absorbs herd refreshes without staling edits for long.
    'Cache-Control': 'public, max-age=300',
  }
}
