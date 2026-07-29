import type { AnalyticsRange } from './request-analytics'

export interface AnalyticsEventRow {
  id: string
  name: string
  category: string
  path: string
  value: number
  currency: string
  createdAt: string
}

const RANGE_DAYS: Record<AnalyticsRange, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
}

function timestamp(value: string): number {
  if (!value)
    return Number.NaN
  const normalized = /^\d{4}-\d{2}-\d{2} \d/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value
  return new Date(normalized).getTime()
}

function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase() || 'USD'
}

function titleCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

function percentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0
}

function dateKey(time: number, range: AnalyticsRange): string {
  const date = new Date(time)
  if (range === 'day')
    return `${String(date.getUTCHours()).padStart(2, '0')}:00`
  if (range === 'year')
    return date.toISOString().slice(0, 7)
  return date.toISOString().slice(0, 10)
}

export function buildEventAnalytics(
  allEvents: AnalyticsEventRow[],
  range: AnalyticsRange,
  now = new Date(),
) {
  const start = new Date(now.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000)
  const events = allEvents
    .filter(event => timestamp(event.createdAt) >= start.getTime() && timestamp(event.createdAt) <= now.getTime())
    .map(event => ({
      ...event,
      category: event.category || 'custom',
      currency: normalizeCurrency(event.currency),
    }))
    .sort((left, right) => timestamp(right.createdAt) - timestamp(left.createdAt))

  const eventMap = new Map<string, { name: string, category: string, currency: string, count: number, value: number, lastSeen: string }>()
  for (const event of events) {
    const key = `${event.name}:${event.category}:${event.currency}`
    const total = eventMap.get(key) || {
      name: event.name,
      category: event.category,
      currency: event.currency,
      count: 0,
      value: 0,
      lastSeen: event.createdAt,
    }
    total.count++
    total.value += event.value
    if (timestamp(event.createdAt) > timestamp(total.lastSeen))
      total.lastSeen = event.createdAt
    eventMap.set(key, total)
  }

  const categoryMap = new Map<string, number>()
  for (const event of events)
    categoryMap.set(event.category, (categoryMap.get(event.category) || 0) + 1)

  const valueMap = new Map<string, { currency: string, value: number, events: number }>()
  for (const event of events) {
    if (event.value <= 0)
      continue
    const total = valueMap.get(event.currency) || { currency: event.currency, value: 0, events: 0 }
    total.value += event.value
    total.events++
    valueMap.set(event.currency, total)
  }

  const timelineMap = new Map<string, number>()
  for (const event of events) {
    const key = dateKey(timestamp(event.createdAt), range)
    timelineMap.set(key, (timelineMap.get(key) || 0) + 1)
  }

  return {
    source: 'analytics-events' as const,
    range,
    dateRange: {
      start: start.toISOString(),
      end: now.toISOString(),
    },
    overview: {
      occurrences: events.length,
      eventNames: new Set(events.map(event => event.name)).size,
      categories: categoryMap.size,
      valuedEvents: events.filter(event => event.value > 0).length,
    },
    events: [...eventMap.values()]
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
      .slice(0, 100),
    categories: [...categoryMap.entries()]
      .map(([name, count]) => ({
        name,
        label: titleCase(name),
        count,
        percentage: percentage(count, events.length),
      }))
      .sort((left, right) => right.count - left.count),
    valueByCurrency: [...valueMap.values()].sort((left, right) => right.value - left.value),
    timeline: [...timelineMap.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, count]) => ({ date, count })),
    recent: events.slice(0, 20),
  }
}
