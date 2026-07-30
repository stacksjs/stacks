import { formatDate } from '@stacksjs/orm'

const statusTimestamp = {
  notified: 'notified_at',
  purchased: 'purchased_at',
  cancelled: 'cancelled_at',
} as const

function dateValue(value: unknown): unknown {
  return typeof value === 'number' || value instanceof Date
    ? formatDate(value)
    : value
}

export function productWaitlistWriteData(
  data: Record<string, unknown>,
  existing: Record<string, unknown> = {},
): Record<string, unknown> {
  const result = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  )

  if (result.quantity === undefined && result.party_size !== undefined)
    result.quantity = result.party_size
  delete result.party_size

  for (const field of ['notified_at', 'purchased_at', 'cancelled_at']) {
    if (result[field] !== undefined)
      result[field] = dateValue(result[field])
  }

  const timestampField = statusTimestamp[result.status as keyof typeof statusTimestamp]
  if (timestampField && result[timestampField] === undefined && !existing[timestampField])
    result[timestampField] = formatDate(new Date())

  return result
}
