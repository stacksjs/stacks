import generateGoogle from './generators/google'
import generateIcs from './generators/ics'
import generateOutlook from './generators/weboutlook'
import generateYahoo from './generators/yahoo'
import type { CalendarLink } from './types'

const link: CalendarLink = {
  from: new Date('2022-12-12 01:00:00'),
  to: new Date('2022-12-12 05:00:00'),
  allDay: false,
  address: 'Playa Vista, Los Angeles, CA, USA',
  title: 'test appointment',
  description: 'test description',
  timezone: 'EDT',
}

// functions that mutate state and trigger updates
function exportCalendarGoogle(): string {
  return generateGoogle(link)
}

// functions that mutate state and trigger updates
function exportCalendarIcs(): string {
  return generateIcs(link)
}

// functions that mutate state and trigger updates
function exportCalendarOutlook(): string {
  return generateOutlook(link)
}

// functions that mutate state and trigger updates
function exportCalendarYahoo(): string {
  return generateYahoo(link)
}

export { exportCalendarIcs, exportCalendarGoogle, exportCalendarOutlook, exportCalendarYahoo }
