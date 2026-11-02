/** Numeric Date constructors remap 0..99 to 1900..1999. Set the full year explicitly. */
export function dateFromParts(year: number, month: number, day: number, hour = 0, minute = 0, second = 0, millisecond = 0, utc = false): Date {
  const date = new Date(0)
  if (utc) {
    date.setUTCFullYear(year, month, day)
    date.setUTCHours(hour, minute, second, millisecond)
  }
  else {
    date.setFullYear(year, month, day)
    date.setHours(hour, minute, second, millisecond)
  }
  return date
}
