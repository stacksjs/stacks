import type { CalendarLink } from '../types'
import { useDateFormat, useMax } from '@stacksjs/browser'
import md5 from 'crypto-js/md5'

export function generateIcs(link: CalendarLink): string {
  const dateFormat = 'YYYYMMDD'
  const timeFormat = 'YYYYMMDDThhmmss'

  const uid = `UID:${generateEventUid(link)}`
  const summary = `SUMMARY:${link.title}`

  const url = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0', // @see https://datatracker.ietf.org/doc/html/rfc5545#section-3.7.4
    'PRODID:Spatie calendar-links', // @see https://datatracker.ietf.org/doc/html/rfc5545#section-3.7.3
    'BEGIN:VEVENT',
    uid,
    summary,
  ]

  const timezone = link.timezone || 'PST'
  const formatTime = `${timezone}:${timeFormat}`
  const dateTimeFormat = link.allDay ? dateFormat : formatTime

  if (link.allDay) {
    url.push(`DTSTAMP;TZID=${useDateFormat(link.from, dateTimeFormat).value}`)
    url.push(`DTSTART:${useDateFormat(link.from, dateTimeFormat).value}`)
    url.push(`DURATION:P${useMax(1, dateDiffInDays(link.from, link.to)).value}D`)
  }
  else {
    url.push(`DTSTAMP;TZID=${useDateFormat(link.from, dateTimeFormat).value}`)
    url.push(`DTSTART;TZID=${useDateFormat(link.from, dateTimeFormat).value}`)
    url.push(`DTEND;TZID=${useDateFormat(link.to, dateTimeFormat).value}`)
  }

  if (link.description)
    url.push(`X-ALT-DESC;FMTTYPE=text/html:${link.description}`)
  if (link.address)
    url.push(`LOCATION:${link.address}`)

  url.push('END:VEVENT')
  url.push('END:VCALENDAR')

  return buildLink(url)
}

function buildLink(propertiesAndComponents: any): string {
  return `data:text/calendar;charset=utf8;base64,${btoa(propertiesAndComponents.join('\r\n'))}`
}

// a and b are javascript Date objects
function dateDiffInDays(from: Date, to: Date): number {
  const _MS_PER_DAY = 1000 * 60 * 60 * 24

  // Discard the time and time-zone information.
  const utc1 = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const utc2 = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())

  return Math.floor((utc2 - utc1) / _MS_PER_DAY)
}

function generateEventUid(link: any): string {
  const atomicFormat = 'YYYY-MM-DDThh:mm:ss+00:00'
  const from = useDateFormat(link.from, atomicFormat).value
  const to = useDateFormat(link.to, atomicFormat).value

  return md5(`${from}${to}${link.title}`).toString()
}

// function escapeString(field: string): string {
//   return addcslashes(field, '\r\n,;')
// }
