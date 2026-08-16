import type { CalendarLink } from './types'
import { generateGoogle } from './generators/google'
import { generateIcs, generateIcsBody } from './generators/ics'
import { generateOutlook } from './generators/weboutlook'
import { generateYahoo } from './generators/yahoo'

export function exportCalendarGoogle(link: CalendarLink): string {
  return generateGoogle(link)
}

export function exportCalendarIcs(link: CalendarLink): string {
  return generateIcs(link)
}

/**
 * The raw `text/calendar` body, for a route that serves an `.ics` file or an
 * email that attaches one. `exportCalendarIcs` returns the same content as a
 * `data:` URL, which suits an anchor but is not a file.
 */
export function exportCalendarIcsBody(link: CalendarLink): string {
  return generateIcsBody(link)
}

export function exportCalendarOutlook(link: CalendarLink): string {
  return generateOutlook(link)
}

export function exportCalendarYahoo(link: CalendarLink): string {
  return generateYahoo(link)
}

// Subscribable multi-event feeds + server-side recurrence expansion.
export { buildCalendarFeed, calendarFeedHeaders, escapeIcsText, foldIcsLine } from './feed'
export type { CalendarFeedEvent, CalendarFeedOptions } from './feed'
export { expandRecurrence, parseRRule } from './recurrence'
export type { RecurrenceRule } from './recurrence'
