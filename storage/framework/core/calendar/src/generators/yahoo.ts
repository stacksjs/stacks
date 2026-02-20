import type { CalendarLink } from '../types'
import { format } from '@stacksjs/datetime'

export function generateYahoo(link: CalendarLink): string {
  const dateFormat = 'YYYYMMDD'
  const timeFormat = 'YYYYMMDDThhmmss'
  let url = 'https://calendar.yahoo.com/?v=60&view=d&type=20'

  const utcStartDateTime = convertTZ(link.from, 'UTC') // set timezone to UTC
  const utcEndDateTime = convertTZ(link.to, 'UTC') // set timezone to UTC
  const dateTimeFormat = link.allDay ? dateFormat : timeFormat

  if (link.allDay) {
    url = `${url}&ST=${format(link.from, dateTimeFormat)}`
    url = `${url}&DUR=allday`
    url = `${url}&ET=${format(link.to, dateTimeFormat)}`
  }
  else {
    url = `${url}&ST=${format(utcStartDateTime, dateTimeFormat)}Z`
    url = `${url}&ET=${format(utcEndDateTime, dateTimeFormat)}Z`
  }

  url = `${url}&TITLE=${encodeURIComponent(link.title)}`

  if (link.description)
    url = `${url}&DESC=${encodeURIComponent(link.description)}`
  if (link.address)
    url = `${url}&in_loc=${encodeURIComponent(link.address)}`

  return url
}

function convertTZ(date: Date | string, tzString: string): Date {
  return new Date((typeof date === 'string' ? new Date(date) : date).toLocaleString('en-US', { timeZone: tzString }))
}

export default generateYahoo
