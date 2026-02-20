import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import { type MaybeRefOrGetter, toValue } from './_shared'

interface UseTimeAgoOptions {
  updateInterval?: number
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30 * DAY
const YEAR = 365 * DAY

function formatTimeAgo(diff: number): string {
  const absDiff = Math.abs(diff)

  if (absDiff < 5 * SECOND) {
    return 'just now'
  }

  const isFuture = diff < 0

  let value: number
  let unit: string

  if (absDiff < MINUTE) {
    value = Math.floor(absDiff / SECOND)
    unit = 'second'
  }
  else if (absDiff < HOUR) {
    value = Math.floor(absDiff / MINUTE)
    unit = 'minute'
  }
  else if (absDiff < DAY) {
    value = Math.floor(absDiff / HOUR)
    unit = 'hour'
  }
  else if (absDiff < WEEK) {
    value = Math.floor(absDiff / DAY)
    unit = 'day'
  }
  else if (absDiff < MONTH) {
    value = Math.floor(absDiff / WEEK)
    unit = 'week'
  }
  else if (absDiff < YEAR) {
    value = Math.floor(absDiff / MONTH)
    unit = 'month'
  }
  else {
    value = Math.floor(absDiff / YEAR)
    unit = 'year'
  }

  const plural = value !== 1 ? 's' : ''

  if (isFuture) {
    return `in ${value} ${unit}${plural}`
  }
  return `${value} ${unit}${plural} ago`
}

/**
 * Reactive relative time string.
 * Converts a date into a human-readable relative time string
 * (e.g., "3 minutes ago", "in 2 hours", "just now").
 * Supports both past and future dates.
 *
 * @param date - The target date (Date, number, or string, or a ref/getter of one)
 * @param options - Configuration options
 * @returns Ref<string> with the formatted time ago string
 */
export function useTimeAgo(
  date: MaybeRefOrGetter<Date | number | string>,
  options: UseTimeAgoOptions = {},
): Ref<string> {
  const { updateInterval = 30000 } = options

  function getTimestamp(): number {
    const d = toValue(date)
    if (d instanceof Date) return d.getTime()
    if (typeof d === 'number') return d
    return new Date(d).getTime()
  }

  function update(): string {
    const now = Date.now()
    const target = getTimestamp()
    const diff = now - target
    return formatTimeAgo(diff)
  }

  const timeAgo = ref(update())

  const intervalId = setInterval(() => {
    timeAgo.value = update()
  }, updateInterval)

  try {
    onUnmounted(() => clearInterval(intervalId))
  }
  catch {
    // Not in a component context
  }

  return timeAgo
}
