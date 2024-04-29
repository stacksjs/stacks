import { ExclusiveParametersError } from './errors'
import type { Ranges } from './types/cron'

export function getRecordKeys<K extends Ranges[keyof Ranges]>(
  record: Partial<Record<K, boolean>>,
) {
  return Object.keys(record) as unknown as (keyof typeof record)[]
}

export function getTimeZoneAndOffset(
  timeZone?: string | null,
  utcOffset?: number | null,
) {
  if (timeZone != null && utcOffset != null)
    throw new ExclusiveParametersError('timeZone', 'utcOffset')

  if (timeZone != null) return { timeZone, utcOffset: null }

  if (utcOffset != null) return { timeZone: null, utcOffset }

  return { timeZone: null, utcOffset: null }
}
