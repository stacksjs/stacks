import type { CalendarLink } from '../types'
import { useDateFormat } from '@stacksjs/browser'

const dateFormat = 'YYYYMMDD'
const timeFormat = 'YYYYMMDDThhmmss'

export function generateGoogle(link: CalendarLink): string {
  // 20221020T170000Z/20221020T173000Z
  let url = 'https://calendar.google.com/calendar/render?action=TEMPLATE'

  const utcStartDateTime = convertTZ(link.from, 'UTC') // set timezone to UTC
  const utcEndDateTime = convertTZ(link.to, 'UTC') // set timezone to UTC
  const dateTimeFormat = link.allDay ? dateFormat : timeFormat

  url = `${url}&dates=${useDateFormat(utcStartDateTime, dateTimeFormat).value}/${
    useDateFormat(utcEndDateTime, dateTimeFormat).value
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

function convertTZ(date: Date | string, tzString: string): Date {
  return new Date((typeof date === 'string' ? new Date(date) : date).toLocaleString('en-US', { timeZone: tzString }))
}
