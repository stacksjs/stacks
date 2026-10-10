/** Add calendar months, clamping the day to the target month's last day. Input is not mutated. */
export function addCalendarMonths(date: Date, months: number, options: { utc?: boolean } = {}): Date {
  if (!Number.isFinite(date.getTime()) || !Number.isSafeInteger(months)) throw new Error('Calendar arithmetic requires a valid date and integer month count')
  const result = new Date(date)
  if (options.utc) {
    const day = result.getUTCDate()
    result.setUTCDate(1)
    result.setUTCMonth(result.getUTCMonth() + months)
    result.setUTCDate(Math.min(day, new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()))
  }
  else {
    const day = result.getDate()
    result.setDate(1)
    result.setMonth(result.getMonth() + months)
    result.setDate(Math.min(day, new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()))
  }
  return result
}
