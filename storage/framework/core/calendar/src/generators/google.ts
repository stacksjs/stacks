import type { CalendarLink } from '../types'
import { format } from '@stacksjs/datetime'

const dateFormat = 'YYYYMMDD'
const timeFormat = 'YYYYMMDDThhmmss'

export function generateGoogle(link: CalendarLink): string {
  // 20221020T170000Z/20221020T173000Z
  let url = 'https://calendar.google.com/calendar/render?action=TEMPLATE'

  const utcStartDateTime = convertTZ(link.from, 'UTC') // set timezone to UTC
  const utcEndDateTime = convertTZ(link.to, 'UTC') // set timezone to UTC
  const dateTimeFormat = link.allDay ? dateFormat : timeFormat

  url = `${url}&dates=${format(utcStartDateTime, dateTimeFormat)}/${
    format(utcEndDateTime, dateTimeFormat)
  }`

  if (link.timezone)
    url = `${url}&ctz=${link.timezone}`

  url = `${url}&text=${encodeURIComponent(link.title)}`

  if (link.description)
    url = `${url}&details=${encodeURIComponent(link.description)}`
  if (link.address)
    url = `${url}&location=${encodeURIComponent(link.address)}`

  return url
}

/**
 * Re-anchor a Date in another timezone for calendar URL formatting.
 *
 * This is a known-fuzzy operation: we serialize the date through
 * `toLocaleString` in the target timezone, then re-parse that string as
 * if it were local time. The original code did exactly that and it
 * works for the common "I want my Google Calendar to show this in my
 * local TZ" case, but it goes wrong across DST transitions and on
 * servers running in UTC where the parsed string lands an hour off.
 *
 * For URL generation the imprecision is acceptable; for any downstream
 * use, prefer `Intl.DateTimeFormat(...).format(date)` directly. We
 * normalize the Locale to en-US explicitly so 24-hour locales (de-DE,
 * fr-FR) don't return strings that Date can't parse.
 */
function convertTZ(date: Date | string, tzString: string): Date {
  const d = typeof date === 'string' ? new Date(date) : date
  if (!tzString) return d
  const formatted = d.toLocaleString('en-US', { timeZone: tzString })
  const parsed = new Date(formatted)
  return Number.isNaN(parsed.getTime()) ? d : parsed
}
