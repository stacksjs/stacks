import { formatDate } from '@stacksjs/orm'

const statusTimestamp = {
  seated: 'seated_at',
  no_show: 'no_show_at',
  cancelled: 'cancelled_at',
} as const

function timestamp(value: unknown): unknown {
  if (typeof value === 'number')
    return formatDate(value <= 2147483647 ? value * 1000 : value)
  if (value instanceof Date)
    return formatDate(value)
  return value
}

export function restaurantWaitlistWriteData(
  data: Record<string, unknown>,
  existing: Record<string, unknown> = {},
): Record<string, unknown> {
  const result = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  )

  for (const field of ['check_in_time', 'seated_at', 'no_show_at', 'cancelled_at']) {
    if (result[field] !== undefined)
      result[field] = timestamp(result[field])
  }

  const timestampField = statusTimestamp[result.status as keyof typeof statusTimestamp]
  if (timestampField && result[timestampField] === undefined && !existing[timestampField])
    result[timestampField] = formatDate(new Date())

  return result
}
