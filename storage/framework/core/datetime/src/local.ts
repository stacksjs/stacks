import { format } from './format'

/** Resolve a site's clock, its organization's fallback, then UTC, from the same instant. */
export function localDateTime(instant: Date, ...timeZones: unknown[]): { date: string, time: string, timeZone: string } {
  if (!Number.isFinite(instant.getTime())) throw new RangeError('Invalid clock instant')
  for (const zone of [...timeZones, 'UTC']) {
    if (typeof zone !== 'string' || !zone.trim()) continue
    try {
      const timeZone = zone.trim()
      const clock = format(instant, 'YYYY-MM-DD HH:mm', { tz: timeZone })
      return { date: clock.slice(0, 10), time: clock.slice(11), timeZone }
    }
    catch (error) {
      if (!(error instanceof RangeError)) throw error
    }
  }
  throw new RangeError('Cannot resolve a local clock')
}
