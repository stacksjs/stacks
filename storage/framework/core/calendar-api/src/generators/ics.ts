import type { CalendarLink } from '../types'
import { createHash } from 'node:crypto'
import { dateStamp, escapeIcsText, foldIcsLine, utcStamp } from '../feed'

/**
 * The calendar file itself, as text.
 *
 * `generateIcs` wraps this in a `data:` URL, which is what an
 * "add to calendar" anchor wants. A route that serves `text/calendar` needs the
 * body instead - and so does anything that attaches the invitation to an email,
 * where a base64 data URL is not a file.
 */
export function generateIcsBody(link: CalendarLink): string {
  return icsLines(link).join('\r\n')
}

export function generateIcs(link: CalendarLink): string {
  return buildLink(generateIcsBody(link))
}

/**
 * Times are UTC (`...Z`), which every client reads without a VTIMEZONE. They
 * used to carry `TZID=<link.timezone>` with no VTIMEZONE, on a 12-hour clock,
 * and with the zone name inside the format string, whose letters the
 * formatter read as tokens: `TZID=PM0ericpm/New_York:20261012T050000` for an
 * event at 17:00 UTC. Text goes through the feed's escaping and folding.
 */
function icsLines(link: CalendarLink): string[] {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0', // @see https://datatracker.ietf.org/doc/html/rfc5545#section-3.7.4
    'PRODID:-//Stacks//calendar-api//EN', // @see https://datatracker.ietf.org/doc/html/rfc5545#section-3.7.3
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${generateEventUid(link)}`,
    // When this copy was made, which RFC 5545 requires in UTC.
    `DTSTAMP:${utcStamp(new Date())}`,
    `SUMMARY:${escapeIcsText(link.title)}`,
  ]

  if (link.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${dateStamp(link.from)}`)
    lines.push(`DURATION:P${Math.max(1, dateDiffInDays(link.from, link.to))}D`)
  }
  else {
    lines.push(`DTSTART:${utcStamp(link.from)}`)
    lines.push(`DTEND:${utcStamp(link.to)}`)
  }

  // Plain text, so DESCRIPTION. It was X-ALT-DESC;FMTTYPE=text/html, which
  // claimed HTML and which most clients do not show.
  if (link.description)
    lines.push(`DESCRIPTION:${escapeIcsText(link.description)}`)
  if (link.address)
    lines.push(`LOCATION:${escapeIcsText(link.address)}`)

  lines.push('END:VEVENT')
  lines.push('END:VCALENDAR')

  return lines.map(foldIcsLine)
}

/**
 * Base64 of the UTF-8 bytes. `btoa` takes Latin-1 only, so a title with an en
 * dash, CJK text or an emoji threw "The string contains invalid characters".
 */
function buildLink(body: string): string {
  let binary = ''
  for (const byte of new TextEncoder().encode(body))
    binary += String.fromCharCode(byte)
  return `data:text/calendar;charset=utf8;base64,${btoa(binary)}`
}

/** Whole UTC days from `from` to `to`. */
function dateDiffInDays(from: Date, to: Date): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24
  const utc1 = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const utc2 = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())

  return Math.floor((utc2 - utc1) / MS_PER_DAY)
}

/**
 * From the instants and the title, so it is the same wherever it is made. It
 * was built from a 12-hour, host-local rendering of the times, so a 10:00 and
 * a 22:00 event with the same title shared a UID and a client took the second
 * for an update of the first.
 */
function generateEventUid(link: CalendarLink): string {
  return createHash('md5').update(`${link.from.toISOString()}${link.to.toISOString()}${link.title}`).digest('hex')
}
