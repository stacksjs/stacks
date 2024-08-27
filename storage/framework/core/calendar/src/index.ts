import { generateGoogle } from './generators/google'
import { generateIcs } from './generators/ics'
import { generateOutlook } from './generators/weboutlook'
import { generateYahoo } from './generators/yahoo'
import type { CalendarLink } from './types'

export function exportCalendarGoogle(link: CalendarLink): string {
  return generateGoogle(link)
}

// functions that mutate state and trigger updates
export function exportCalendarIcs(link: CalendarLink): string {
  return generateIcs(link)
}

// functions that mutate state and trigger updates
export function exportCalendarOutlook(link: CalendarLink): string {
  return generateOutlook(link)
}

// functions that mutate state and trigger updates
export function exportCalendarYahoo(link: CalendarLink): string {
  return generateYahoo(link)
}
