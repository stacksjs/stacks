import type { CalendarLink } from '../types'

/** `2026-10-12T17:00:00Z`, or `2026-10-12` for an all-day event: the instant in UTC. */
function outlookTime(date: Date, allDay: boolean): string {
  return allDay ? date.toISOString().slice(0, 10) : `${date.toISOString().slice(0, 19)}Z`
}

export function generateOutlook(link: CalendarLink): string {
  const BASE_URL = 'https://outlook.live.com/calendar/deeplink/compose?path=/calendar/action/compose&rru=addevent'

  let url = `${BASE_URL}&startdt=${outlookTime(link.from, link.allDay)}&enddt=${outlookTime(link.to, link.allDay)}`

  if (link.allDay)
    url = `${url}&allday=true`

  url = `${url}&subject=${encodeURIComponent(link.title)}`

  if (link.description)
    url = `${url}&body=${encodeURIComponent(link.description)}`
  if (link.address)
    url = `${url}&location=${encodeURIComponent(link.address)}`

  return url
}
