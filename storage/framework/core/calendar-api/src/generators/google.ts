import type { CalendarLink } from '../types'
import { dateStamp, utcStamp } from '../feed'

/**
 * Times go in UTC with a `Z`, so Google reads them as the instants they are.
 * `ctz` only picks the zone the compose screen displays them in. They used
 * to be written on a 12-hour clock with no `Z`, which Google read as local
 * time in `ctz`: an event at 17:00 UTC was offered at 5 AM New York.
 */
export function generateGoogle(link: CalendarLink): string {
  let url = 'https://calendar.google.com/calendar/render?action=TEMPLATE'

  url = link.allDay
    ? `${url}&dates=${dateStamp(link.from)}/${dateStamp(link.to)}`
    : `${url}&dates=${utcStamp(link.from)}/${utcStamp(link.to)}`

  if (link.timezone)
    url = `${url}&ctz=${link.timezone}`

  url = `${url}&text=${encodeURIComponent(link.title)}`

  if (link.description)
    url = `${url}&details=${encodeURIComponent(link.description)}`
  if (link.address)
    url = `${url}&location=${encodeURIComponent(link.address)}`

  return url
}
