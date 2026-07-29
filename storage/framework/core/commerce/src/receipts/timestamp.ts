import { formatDate } from '@stacksjs/orm'

export function receiptTimestamp(value: unknown): string {
  try {
    if (typeof value === 'number')
      return formatDate(value <= 2147483647 ? value * 1000 : value)

    if (typeof value === 'string' && /^\d{10}$/.test(value))
      return formatDate(Number(value) * 1000)

    return formatDate(value as Date | number | string)
  }
  catch {
    throw new TypeError('Receipt timestamp must be a valid date')
  }
}
