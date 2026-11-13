import { db, sqlHelpers } from '@stacksjs/database/runtime'
import { env } from '@stacksjs/env'
import { formatDate } from '@stacksjs/orm'

export type ErrorResolution = 'unresolved' | 'resolved' | 'ignored'

export interface ErrorRecord {
  id: number
  type: string
  message: string
  stack: string | null
  /** The HTTP status the error reported, and only that (stacksjs/stacks#2923). */
  status: number | null
  /** Where this error sits in triage. Was encoded into `status` until #2923. */
  resolution: ErrorResolution
  additional_info: string | null
  created_at: string
  updated_at: string | null
}

export interface GroupedError {
  id: number
  type: string
  message: string
  stack: string | null
  /** The group's triage state, read from `resolution` rather than decoded. */
  status: ErrorResolution
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
    .executeTakeFirst() as unknown as ErrorRecord | undefined
}

/**
 * Fetch all errors (raw, ungrouped)
 */
export async function fetchAll(): Promise<ErrorRecord[]> {
  return await db
    .selectFrom('errors')
    .selectAll()
    .orderBy('created_at', 'desc')
    .execute() as unknown as ErrorRecord[]
}

/**
 * Fetch errors grouped by type and message (Sentry-like behavior)
 * Same errors are aggregated instead of creating duplicate entries
 */
export async function fetchGrouped(): Promise<GroupedError[]> {
  // Grouping reads the light columns only. Every row's stack and
  // additional_info are what made this read heavy, and a group shows one
  // stack, its representative's, which is fetched by id below.
  const errors = await db
    .selectFrom('errors')
    .select(['id', 'type', 'message', 'resolution', 'created_at'])
    .orderBy('created_at', 'desc')
    .execute() as unknown as GroupingRow[]

  // Group errors by type + message combination
  const groupMap = new Map<string, {
    errors: GroupingRow[]
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

  const stacks = await fetchStacks([...groupMap.values()].flatMap(group => group.errors[0] ? [group.errors[0].id] : []))

  // Convert to grouped error format
  const groupedErrors: GroupedError[] = []

  for (const [_, group] of groupMap) {
    const representative = group.errors[0]
    if (!representative)
      continue
    // The group's state is the representative's. Every error in a group is
    // triaged together by resolveGroup/ignoreGroup, so they cannot disagree;
    // reading the representative rather than scanning keeps it that way.
    const statusLabel: ErrorResolution = representative.resolution ?? 'unresolved'

    groupedErrors.push({
      id: representative.id,
      type: representative.type,
      message: representative.message,
      stack: stacks.get(Number(representative.id)) ?? null,
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

/** A page of groups asks for these. */
export interface ErrorGroupQuery {
  page: number
  perPage: number
  /** Matched against the type and the message, case-insensitive. */
  search: string
  /** A group's state is its newest occurrence's, as in `fetchGrouped`. */
  status: ErrorResolution | 'all'
  /** An exact type, or empty for every type. */
  type: string
  /** Most recently seen first unless asked otherwise. */
  sort?: 'last_seen' | 'count' | 'type' | 'status'
  direction?: 'asc' | 'desc'
}

/**
 * The order of a page of groups, the same on every dialect: types without
 * case, states in the order they are declared, and the most recently seen
 * first among equals, then the newest id, so a page boundary is stable.
 */
function groupOrder(query: ErrorGroupQuery): string {
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC'
  const by = {
    last_seen: `created_at ${direction}`,
    count: `occurrences ${direction}`,
    type: `LOWER(type) ${direction}`,
    status: `CASE WHEN resolution = 'resolved' THEN 1 WHEN resolution = 'ignored' THEN 2 ELSE 0 END ${direction}`,
  }[query.sort ?? 'last_seen']
  return `${by}, created_at DESC, id DESC`
}

/** One group on a page: `GroupedError` without every occurrence's id. */
export type GroupedErrorSummary = Omit<GroupedError, 'error_ids'>

export interface GroupedErrorPage {
  groups: GroupedErrorSummary[]
  /** Groups matching the query, which the pager counts. */
  total: number
  /** The page the groups are, moved back to the last one when it ran past it. */
  page: number
  /** Every error type recorded, for the type filter. */
  types: string[]
}

interface RankedGroupRow {
  id: number | string
  type: string
  message: string
  resolution: ErrorResolution | null
  occurrences: number | string
  first_seen: unknown
  last_seen: unknown
}

/**
 * One page of error groups, most recently seen first, read by the database.
 *
 * `fetchGrouped` reads every error to group them, and the Errors page used to
 * take that whole list to show ten (stacksjs/stacks#3195). This ranks each
 * group's occurrences newest first in SQL, so the group's state, count and
 * first and last seen come back with only the page's groups, and fetches just
 * those groups' stacks. Window functions are in every database Stacks runs
 * on: SQLite 3.25, MySQL 8 and PostgreSQL.
 */
export async function fetchGroupedPage(query: ErrorGroupQuery): Promise<GroupedErrorPage> {
  const helpers = sqlHelpers(env.DB_CONNECTION || 'sqlite')
  const values: unknown[] = []
  const bind = (value: unknown): string => {
    values.push(value)
    return helpers.param(values.length)
  }

  // The type and the message are the same for every row of a group, so these
  // filter rows without splitting one.
  const rowFilters: string[] = []
  if (query.search) {
    const term = `%${query.search}%`
    rowFilters.push(`(LOWER(type) LIKE LOWER(${bind(term)}) OR LOWER(message) LIKE LOWER(${bind(term)}))`)
  }
  if (query.type)
    rowFilters.push(`type = ${bind(query.type)}`)

  // The state is not: a resolved error that recurs has an unresolved newest
  // row, and reads as unresolved. So it filters the ranked groups.
  const groupFilters = ['group_rank = 1']
  if (query.status === 'unresolved')
    groupFilters.push(`(resolution = ${bind('unresolved')} OR resolution IS NULL)`)
  else if (query.status !== 'all')
    groupFilters.push(`resolution = ${bind(query.status)}`)

  // A derived table rather than a WITH clause: the SQLite driver decides a
  // statement returns rows by its first word, and answers a query that opens
  // with WITH as though it were a write, with no rows.
  const ranked = `(
    SELECT id, type, message, resolution, created_at,
      ROW_NUMBER() OVER (PARTITION BY type, message ORDER BY created_at DESC, id DESC) AS group_rank,
      COUNT(id) OVER (PARTITION BY type, message) AS occurrences,
      MIN(created_at) OVER (PARTITION BY type, message) AS first_seen
    FROM errors
    ${rowFilters.length > 0 ? `WHERE ${rowFilters.join(' AND ')}` : ''}
  ) ranked`
  const where = `WHERE ${groupFilters.join(' AND ')}`

  const [counted] = await db.unsafe(`SELECT COUNT(id) AS count FROM ${ranked} ${where}`, values).execute() as Array<{ count: unknown }>
  const total = Number(counted?.count ?? 0) || 0
  const page = Math.min(query.page, Math.max(1, Math.ceil(total / query.perPage)))

  const [rows, types] = await Promise.all([
    total === 0
      ? Promise.resolve([] as RankedGroupRow[])
      : db.unsafe(
        `SELECT id, type, message, resolution, occurrences, first_seen, created_at AS last_seen FROM ${ranked} ${where}
         ORDER BY ${groupOrder(query)} LIMIT ${Math.trunc(query.perPage)} OFFSET ${Math.trunc((page - 1) * query.perPage)}`,
        values,
      ).execute() as unknown as Promise<RankedGroupRow[]>,
    db.unsafe('SELECT DISTINCT type FROM errors ORDER BY type').execute() as Promise<Array<{ type: string }>>,
  ])

  const stacks = await fetchStacks(rows.map(row => Number(row.id)))

  return {
    groups: rows.map(row => ({
      id: Number(row.id),
      type: row.type,
      message: row.message,
      stack: stacks.get(Number(row.id)) ?? null,
      status: row.resolution ?? 'unresolved',
      count: Number(row.occurrences) || 0,
      first_seen: new Date(row.first_seen as string).toISOString(),
      last_seen: new Date(row.last_seen as string).toISOString(),
    })),
    total,
    page,
    types: types.map(row => String(row.type)),
  }
}

type GroupingRow = Pick<ErrorRecord, 'id' | 'type' | 'message' | 'resolution' | 'created_at'>

/** How many ids one `IN` list carries, well under every driver's bound-parameter limit. */
const STACK_BATCH = 500

/** The stack of each of these errors, by id. */
async function fetchStacks(ids: number[]): Promise<Map<number, string | null>> {
  const stacks = new Map<number, string | null>()
  for (let start = 0; start < ids.length; start += STACK_BATCH) {
    const rows = await db
      .selectFrom('errors')
      .select(['id', 'stack'])
      .where('id', 'in', ids.slice(start, start + STACK_BATCH))
      .execute() as unknown as Pick<ErrorRecord, 'id' | 'stack'>[]
    for (const row of rows)
      stacks.set(Number(row.id), row.stack ?? null)
  }
  return stacks
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
    .execute() as unknown as ErrorRecord[]
}

/** How many errors were recorded at or after this moment. */
async function countSince(since: Date): Promise<number> {
  const row = await db
    .selectFrom('errors')
    .where('created_at', '>=', formatDate(since))
    .select(db.fn.count('id').as('count'))
    .executeTakeFirst() as { count: number | string } | undefined
  return Number(row?.count ?? 0)
}

/**
 * Fetch error statistics
 *
 * Counted by the database rather than by loading every error: the Errors page
 * asks for these on every visit and again after each resolve, ignore or delete
 * (stacksjs/stacks#3181).
 */
export async function fetchStats(): Promise<ErrorStats> {
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)

  const byResolution = await db
    .selectFrom('errors')
    .select(['resolution', db.fn.count('id').as('count')])
    .groupBy('resolution')
    .execute() as { resolution: ErrorResolution | null, count: number | string }[]

  let total = 0
  let resolved = 0
  let ignored = 0
  for (const row of byResolution) {
    const count = Number(row.count)
    total += count
    if (row.resolution === 'resolved')
      resolved += count
    else if (row.resolution === 'ignored')
      ignored += count
  }

  const last24h = await countSince(yesterday)
  const previous24h = await countSince(twoDaysAgo) - last24h

  // Calculate trend (percentage change)
  const trend = previous24h === 0
    ? (last24h > 0 ? 100 : 0)
    : Math.round(((last24h - previous24h) / previous24h) * 100)

  return {
    total,
    // A missing resolution reads as unresolved, as it always has.
    unresolved: total - resolved - ignored,
    resolved,
    ignored,
    last_24h: last24h,
    trend,
  }
}

/**
 * Fetch error timeline (hourly counts for the last 24 hours)
 *
 * Reads only the last 24 hours, and only their timestamps.
 */
export async function fetchTimeline(): Promise<{ hour: string, count: number }[]> {
  const now = new Date()
  const firstHour = new Date(now.getTime() - 23 * 60 * 60 * 1000)
  firstHour.setMinutes(0, 0, 0)
  const errors = await db
    .selectFrom('errors')
    .select(['created_at'])
    .where('created_at', '>=', formatDate(firstHour))
    .execute() as unknown as Pick<ErrorRecord, 'created_at'>[]
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
