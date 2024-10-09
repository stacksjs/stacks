import type { CalendarLink } from '../types'
import { useDateFormat } from '@stacksjs/browser'

export function generateOutlook(link: CalendarLink): string {
  const dateFormat = 'YYYY-MM-DD'
  const timeFormat = 'YYYY-MM-DDThh:mm:ss'
  const BASE_URL = 'https://outlook.live.com/calendar/deeplink/compose?path=/calendar/action/compose&rru=addevent'

  // 20221020T170000Z/20221020T173000Z
  let url = BASE_URL

  const utcStartDateTime = convertTZ(link.from, 'UTC') // set timezone to UTC
  const utcEndDateTime = convertTZ(link.to, 'UTC') // set timezone to UTC
  const dateTimeFormat = link.allDay ? dateFormat : timeFormat

  url = link.allDay
    ? `${url}&startdt=${useDateFormat(utcStartDateTime, dateTimeFormat).value}`
    : `${url}&startdt=${useDateFormat(utcStartDateTime, dateTimeFormat).value}Z`
  url = link.allDay
    ? `${url}&enddt=${useDateFormat(utcEndDateTime, dateTimeFormat).value}`
    : `${url}&enddt=${useDateFormat(utcEndDateTime, dateTimeFormat).value}Z`

  if (link.allDay)
    url = `${url}&allday=true`

  url = `${url}&subject=${encodeURIComponent(link.title)}`

  if (link.description)
    url = `${url}&body=${encodeURIComponent(link.description)}`
  if (link.address)
    url = `${url}&location=${encodeURIComponent(link.address)}`

  return url
}

function convertTZ(date: Date | string, tzString: string): Date {
  return new Date((typeof date === 'string' ? new Date(date) : date).toLocaleString('en-US', { timeZone: tzString }))
}
