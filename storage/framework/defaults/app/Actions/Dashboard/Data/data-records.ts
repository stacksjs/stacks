export function textValue(value: unknown, fallback = ''): string {
  if (value === null || value === undefined)
    return fallback
  const result = String(value).trim()
  return result || fallback
}

export function numberValue(value: unknown): number {
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}

export function dateValue(value: unknown): string {
  const text = textValue(value)
  if (!text)
    return ''
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

export function createdWithinDays(value: string, days: number, now = Date.now()): boolean {
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) && timestamp >= now - days * 24 * 60 * 60 * 1000
}

export function daysAgoIso(days: number, now = Date.now()): string {
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString()
}
