import type { CalendarLink } from './types'
import { generateGoogle } from './generators/google'
import { generateIcs } from './generators/ics'
import { generateOutlook } from './generators/weboutlook'
import { generateYahoo } from './generators/yahoo'

export function exportCalendarGoogle(link: CalendarLink): string {
  return generateGoogle(link)
}

export function exportCalendarIcs(link: CalendarLink): string {
  return generateIcs(link)
}

export function exportCalendarOutlook(link: CalendarLink): string {
  return generateOutlook(link)
}

export function exportCalendarYahoo(link: CalendarLink): string {
  return generateYahoo(link)
}
