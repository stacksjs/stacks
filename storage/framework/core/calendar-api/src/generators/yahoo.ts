import type { CalendarLink } from '../types'
import { dateStamp, utcStamp } from '../feed'

export function generateYahoo(link: CalendarLink): string {
  let url = 'https://calendar.yahoo.com/?v=60&view=d&type=20'

  if (link.allDay) {
    url = `${url}&ST=${dateStamp(link.from)}`
    url = `${url}&DUR=allday`
    url = `${url}&ET=${dateStamp(link.to)}`
  }
  else {
    url = `${url}&ST=${utcStamp(link.from)}`
    url = `${url}&ET=${utcStamp(link.to)}`
  }

  url = `${url}&TITLE=${encodeURIComponent(link.title)}`

  if (link.description)
    url = `${url}&DESC=${encodeURIComponent(link.description)}`
  if (link.address)
    url = `${url}&in_loc=${encodeURIComponent(link.address)}`

  return url
}

export default generateYahoo
