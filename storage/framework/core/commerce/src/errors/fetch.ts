import { db } from '@stacksjs/database'

export interface ErrorRecord {
  id: number
  type: string
  message: string
  stack: string | null
  status: number | null
  additional_info: string | null
  created_at: string
  updated_at: string | null
}

export interface GroupedError {
  id: number
  type: string
  message: string
  stack: string | null
  status: string
  count: number
  first_seen: string
  last_seen: string
  error_ids: number[]
}

export interface ErrorStats {
  total: number
  unresolved: number
  resolved: number
  ignored: number
  last_24h: number
  trend: number
}

/**
 * Fetch a single error by ID
 */
export async function fetchById(id: number): Promise<ErrorRecord | undefined> {
  return await db
    .selectFrom('errors')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst() as ErrorRecord | undefined
}

/**
 * Fetch all errors (raw, ungrouped)
 */
export async function fetchAll(): Promise<ErrorRecord[]> {
  return await db
    .selectFrom('errors')
    .selectAll()
    .orderBy('created_at', 'desc')
    .execute() as ErrorRecord[]
}

/**
 * Fetch errors grouped by type and message (Sentry-like behavior)
 * Same errors are aggregated instead of creating duplicate entries
 */
export async function fetchGrouped(): Promise<GroupedError[]> {
  const errors = await db
    .selectFrom('errors')
    .selectAll()
    .orderBy('created_at', 'desc')
    .execute() as ErrorRecord[]

  // Group errors by type + message combination
  const groupMap = new Map<string, {
    errors: ErrorRecord[]
    firstSeen: Date
    lastSeen: Date
  }>()

  for (const error of errors) {
    const key = `${error.type}:${error.message}`

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        errors: [],
        firstSeen: new Date(error.created_at),
        lastSeen: new Date(error.created_at),
      })
    }

    const group = groupMap.get(key)!
    group.errors.push(error)

    const errorDate = new Date(error.created_at)
    if (errorDate < group.firstSeen)
      group.firstSeen = errorDate
    if (errorDate > group.lastSeen)
      group.lastSeen = errorDate
  }

  // Convert to grouped error format
  const groupedErrors: GroupedError[] = []

  for (const [_, group] of groupMap) {
    const representative = group.errors[0]
    // Determine status - use latest non-null status or default to 'unresolved'
    const latestStatus = group.errors.find(e => e.status !== null)?.status
    let statusLabel = 'unresolved'
    if (latestStatus === 1)
      statusLabel = 'resolved'
    else if (latestStatus === 2)
      statusLabel = 'ignored'

    groupedErrors.push({
      id: representative.id,
      type: representative.type,
      message: representative.message,
      stack: representative.stack,
      status: statusLabel,
      count: group.errors.length,
      first_seen: group.firstSeen.toISOString(),
      last_seen: group.lastSeen.toISOString(),
      error_ids: group.errors.map(e => e.id),
    })
  }

  // Sort by last_seen descending
  groupedErrors.sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime())

  return groupedErrors
}

/**
 * Fetch errors for a specific group (by type and message)
 */
export async function fetchByGroup(type: string, message: string): Promise<ErrorRecord[]> {
  return await db
    .selectFrom('errors')
    .where('type', '=', type)
    .where('message', '=', message)
    .selectAll()
    .orderBy('created_at', 'desc')
    .execute() as ErrorRecord[]
}

/**
 * Fetch error statistics
 */
export async function fetchStats(): Promise<ErrorStats> {
  const errors = await fetchAll()
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)

  const last24h = errors.filter(e => new Date(e.created_at) >= yesterday).length
  const previous24h = errors.filter(e => {
    const date = new Date(e.created_at)
    return date >= twoDaysAgo && date < yesterday
  }).length

  // Calculate trend (percentage change)
  const trend = previous24h === 0
    ? (last24h > 0 ? 100 : 0)
    : Math.round(((last24h - previous24h) / previous24h) * 100)

  return {
    total: errors.length,
    unresolved: errors.filter(e => e.status === null || e.status === 0).length,
    resolved: errors.filter(e => e.status === 1).length,
    ignored: errors.filter(e => e.status === 2).length,
    last_24h: last24h,
    trend,
  }
}

/**
 * Fetch error timeline (hourly counts for the last 24 hours)
 */
export async function fetchTimeline(): Promise<{ hour: string, count: number }[]> {
  const errors = await fetchAll()
  const now = new Date()
  const timeline: { hour: string, count: number }[] = []

  // Create hourly buckets for last 24 hours
  for (let i = 23; i >= 0; i--) {
    const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000)
    hourStart.setMinutes(0, 0, 0)
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)

    const count = errors.filter(e => {
      const date = new Date(e.created_at)
      return date >= hourStart && date < hourEnd
    }).length

    timeline.push({
      hour: hourStart.toISOString(),
      count,
    })
  }

  return timeline
}
