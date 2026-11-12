import type { HqClient, Issue } from '@stacksjs/hq/client'
import type { DashboardProviderUnavailable } from '../Dashboard/dashboard-provider'
import { errors } from '@stacksjs/commerce'
import type { QueryReader } from '../Dashboard/Content/content-list'
import { LIST_PAGE_SIZES, queryText } from '../Dashboard/Content/content-list'
import { dashboardHqClient, DashboardProviderUnavailableError, hqUnavailableReason, readThroughProvider, resolveDashboardDriver } from '../Dashboard/dashboard-provider'

/**
 * Where the Errors section reads from.
 *
 * Every one of these actions used to call `@stacksjs/commerce` directly, which
 * is how error tracking came to be served by the shopping package: the store
 * lives there for historical reasons and nine dashboard actions grew a
 * dependency on it. Routing the reads through one provider puts that coupling
 * in a single file, so replacing the store later is a change here rather than
 * a change in nine actions.
 *
 * Read paths only. Resolving, ignoring, unresolving and deleting an error stay
 * exactly where they were and always act on the local store. A section reading
 * from a remote provider while writing to a local one would silently disagree
 * with itself, so the write actions are deliberately left untouched until a
 * provider exists that can actually accept a write.
 */

/**
 * The shapes the Errors section renders.
 *
 * These used to be derived from the local store:
 *
 *     export type DashboardErrorRecord = NonNullable<Awaited<ReturnType<typeof errors.fetchById>>>
 *
 * which made the contract whatever `@stacksjs/commerce`'s ORM row happened to
 * be. That is fine while the only provider IS the commerce store, and wrong
 * the moment a second one exists: a remote provider has to be told what to
 * serve, and "whatever a shopping package's table looks like this week" is
 * not something anyone can be told (stacksjs/stacks#2921).
 *
 * Declared here instead, so the section's contract is a decision rather than
 * a consequence. Field names are deliberately the ones already on the wire -
 * these actions serialize straight to JSON and the dashboard reads
 * `first_seen`, `last_seen` and `last_24h` today, so renaming them to
 * camelCase would be a breaking change to a shipped response rather than the
 * decoupling this is for.
 */

/** Where a grouped error sits in the triage workflow. */
export type DashboardErrorStatus = 'unresolved' | 'resolved' | 'ignored'

export interface DashboardErrorRecord {
  /**
   * Opaque. A number from the local store's autoincrement, a string from a
   * hosted one - bughq's issue ids are varchar (stacksjs/stacks#2915).
   * Compare with `String(a.id) === String(b.id)` rather than `===`.
   */
  id: string | number
  type: string
  message: string
  stack: string | null
  /**
   * The HTTP status the error reported, and only that.
   *
   * It used to be overloaded: `resolveError` and `ignoreError` wrote 1 and 2
   * into this column to mean resolved and ignored, which destroyed the status
   * and meant a seeded error could never read as resolved. Split in
   * stacksjs/stacks#2923; triage is `resolution` below.
   */
  status: number | null
  /** Where this error sits in triage. */
  resolution: DashboardErrorStatus
  /** Free text. Nothing in the dashboard reads it; it is carried, not shown. */
  additional_info: string | null
  created_at: string
  updated_at: string | null
}

export interface DashboardGroupedError {
  /** Opaque, as on {@link DashboardErrorRecord}. */
  id: string | number
  type: string
  message: string
  stack: string | null
  /** The triage state, unlike `status` on a single record. See above. */
  status: DashboardErrorStatus
  count: number
  first_seen: string
  last_seen: string
}

/**
 * What a page of error groups asks for. A group's state is its newest
 * occurrence's, so `status` filters groups, not rows.
 */
export interface DashboardErrorGroupQuery {
  page: number
  perPage: number
  search: string
  status: DashboardErrorStatus | 'all'
  type: string
  sort: typeof ERROR_GROUP_SORTS[number]
  direction: 'asc' | 'desc'
}

export const ERROR_GROUP_SORTS = ['last_seen', 'count', 'type', 'status'] as const

/**
 * One page of error groups, most recently seen first (stacksjs/stacks#3195).
 *
 * The section used to take every group, each with the id of every one of its
 * occurrences, to show ten. Nothing read those ids, and a busy group has
 * thousands, so a page carries the groups' counts instead.
 */
export interface DashboardGroupedErrorPage {
  groups: DashboardGroupedError[]
  /** Groups matching the query, which the pager counts. */
  total: number
  /** The page the groups are, moved back to the last one when it ran past it. */
  page: number
  /** Every recorded error type, for the type filter. */
  types: string[]
}

export interface DashboardErrorStats {
  total: number
  unresolved: number
  resolved: number
  ignored: number
  last_24h: number
  trend: number
}

export interface DashboardErrorTimelinePoint {
  hour: string
  count: number
}

export interface DashboardErrorsProvider {
  grouped: (query: DashboardErrorGroupQuery) => Promise<DashboardGroupedErrorPage>
  stats: () => Promise<DashboardErrorStats>
  timeline: () => Promise<DashboardErrorTimelinePoint[]>
  byGroup: (type: string, message: string) => Promise<DashboardErrorRecord[]>
  byId: (id: string | number) => Promise<DashboardErrorRecord | undefined>
}

/** Wraps a payload with the reason its section is empty. */
export type DashboardErrorsEnvelope<T> = { data: T } & Partial<DashboardProviderUnavailable>

/**
 * This application's own error store.
 *
 * Not wrapped in a catch. These actions have never caught a store failure, and
 * adding one here would convert today's error response into a misleading empty
 * list, which is a behaviour change rather than the refactor this is meant to be.
 */
const ERROR_STATUSES: readonly DashboardErrorStatus[] = ['unresolved', 'resolved', 'ignored']

/**
 * Narrow the store's `status` onto the three states the section renders.
 *
 * `fetchGrouped` types this as `string` while deriving it from exactly those
 * three labels, so the widening is incidental. An unknown value reads as
 * unresolved, which is the store's own default for a status it cannot
 * interpret, and is the safe direction: an error wrongly shown as needing
 * attention is noticed, one wrongly shown as handled is not.
 */
function toErrorStatus(value: string): DashboardErrorStatus {
  return ERROR_STATUSES.includes(value as DashboardErrorStatus)
    ? value as DashboardErrorStatus
    : 'unresolved'
}

/**
 * The commerce row, as the section's contract.
 *
 * Written out rather than passed through. Every field here is currently an
 * identity, and saying so explicitly is the point: when the store's shape
 * next moves, this file stops compiling instead of quietly changing what a
 * remote provider is required to match.
 */
function toGroupedError(row: Awaited<ReturnType<typeof errors.fetchGroupedPage>>['groups'][number]): DashboardGroupedError {
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    stack: row.stack,
    status: toErrorStatus(row.status),
    count: row.count,
    first_seen: row.first_seen,
    last_seen: row.last_seen,
  }
}

/**
 * The local store's id for a requested one, or undefined when it cannot have it.
 *
 * Its ids are an autoincrement, so a non-integer id is not one of its rows
 * rather than a bad request, and the caller answers 404. Route params arrive
 * as strings even when the id is a number, which is why a numeric string is
 * accepted (stacksjs/stacks#2915).
 */
export function localErrorId(id: string | number): number | undefined {
  const numeric = typeof id === 'number' ? id : Number.parseInt(String(id), 10)
  return Number.isInteger(numeric) ? numeric : undefined
}

export const localErrorsProvider: DashboardErrorsProvider = {
  grouped: async (query) => {
    const page = await errors.fetchGroupedPage(query)
    return { ...page, groups: page.groups.map(toGroupedError) }
  },
  stats: () => errors.fetchStats(),
  timeline: () => errors.fetchTimeline(),
  byGroup: (type, message) => errors.fetchByGroup(type, message),
  byId: async (id) => {
    const numeric = localErrorId(id)
    return numeric === undefined ? undefined : errors.fetchById(numeric)
  },
}

/**
 * The empty answer for each read, used when a remote provider cannot be reached.
 *
 * `stats` has no natural empty value, so it reports zeros. A section showing
 * zeros next to its reason is clearer than one showing nothing at all.
 */
const EMPTY_STATS: DashboardErrorStats = {
  total: 0,
  unresolved: 0,
  resolved: 0,
  ignored: 0,
  last_24h: 0,
  trend: 0,
}

/**
 * BugHQ, read with the project's read key.
 *
 * BugHQ already groups occurrences into issues, so an issue is a group here.
 * Its read API is the issue list (the hundred most recently seen), which is
 * what every answer below is built from:
 *
 * - a group's `message` is the issue title and it has no stack, because the
 *   list carries none
 * - `stats` counts occurrences across those issues; `last_24h` is the number
 *   of issues seen in the last day, since the list has no per-hour counts
 * - there is no timeline to read, so that panel says so
 *
 * A read that comes back unavailable throws
 * `DashboardProviderUnavailableError`, which `readErrors` turns into the empty
 * value plus its reason.
 */
export function hqErrorsProvider(client: Pick<HqClient, 'issues'>, now: () => number = Date.now): DashboardErrorsProvider {
  const issues = async (status?: string): Promise<Issue[]> => {
    const result = await client.issues.list(status ? { status } : {})
    if (!result.ok)
      throw new DashboardProviderUnavailableError(hqUnavailableReason(result))
    return result.data
  }

  const typeOf = (issue: Issue): string => issue.errorType || 'Error'
  // BugHQ titles an issue `Type: message`.
  const messageOf = (issue: Issue): string =>
    issue.title.startsWith(`${typeOf(issue)}: `) ? issue.title.slice(typeOf(issue).length + 2) : issue.title

  const toGroup = (issue: Issue): DashboardGroupedError => ({
    id: issue.id,
    type: typeOf(issue),
    message: messageOf(issue),
    stack: null,
    status: toErrorStatus(issue.status),
    count: issue.count,
    first_seen: issue.firstSeen ?? '',
    last_seen: issue.lastSeen ?? '',
  })

  const toRecord = (issue: Issue): DashboardErrorRecord => ({
    id: issue.id,
    type: typeOf(issue),
    message: messageOf(issue),
    stack: null,
    status: null,
    resolution: toErrorStatus(issue.status),
    additional_info: issue.culprit,
    created_at: issue.firstSeen ?? '',
    updated_at: issue.lastSeen,
  })

  return {
    async grouped(query) {
      const all = await issues(query.status === 'all' ? undefined : query.status)
      const search = query.search.toLowerCase()
      const matching = all
        .filter(issue => !query.type || typeOf(issue) === query.type)
        .filter(issue => !search || `${issue.title} ${issue.culprit ?? ''}`.toLowerCase().includes(search))
        .map(toGroup)

      const direction = query.direction === 'asc' ? 1 : -1
      const key = (group: DashboardGroupedError): string | number =>
        query.sort === 'count' ? group.count : query.sort === 'type' ? group.type : query.sort === 'status' ? group.status : group.last_seen
      matching.sort((a, b) => {
        const left = key(a)
        const right = key(b)
        return (left < right ? -1 : left > right ? 1 : 0) * direction
      })

      const page = Math.min(query.page, Math.max(1, Math.ceil(matching.length / query.perPage)))
      return {
        groups: matching.slice((page - 1) * query.perPage, page * query.perPage),
        total: matching.length,
        page,
        types: [...new Set(all.map(typeOf))].sort(),
      }
    },

    async stats() {
      const all = await issues()
      const since = now() - 86400000
      const sum = (status: DashboardErrorStatus): number =>
        all.filter(issue => toErrorStatus(issue.status) === status).reduce((total, issue) => total + issue.count, 0)
      return {
        total: all.reduce((total, issue) => total + issue.count, 0),
        unresolved: sum('unresolved'),
        resolved: sum('resolved'),
        ignored: sum('ignored'),
        last_24h: all.filter(issue => issue.lastSeen && Date.parse(issue.lastSeen) >= since).length,
        trend: 0,
      }
    },

    async timeline() {
      throw new DashboardProviderUnavailableError('BugHQ has no hourly timeline to read yet. Open BugHQ for the full history.')
    },

    async byGroup(type, message) {
      return (await issues()).filter(issue => typeOf(issue) === type && messageOf(issue) === message).map(toRecord)
    },

    async byId(id) {
      const issue = (await issues()).find(candidate => candidate.id === String(id))
      return issue ? toRecord(issue) : undefined
    },
  }
}

/**
 * Runs one error read through the configured provider.
 *
 * A local read is handed straight back, failures included. A remote read is
 * guarded, so an unreachable provider yields the empty value plus a reason
 * rather than taking the section down.
 */
async function readErrors<T>(
  empty: T,
  read: (provider: DashboardErrorsProvider) => Promise<T>,
  isValid: (payload: unknown) => boolean,
): Promise<DashboardErrorsEnvelope<T>> {
  const driver = await resolveDashboardDriver('errors')

  if (driver.name === 'local')
    return { data: await read(localErrorsProvider) }

  return readThroughProvider<DashboardErrorsEnvelope<T>>(
    'errors',
    reason => ({ data: empty, unavailable: reason }),
    async () => {
      try {
        return { data: await read(hqErrorsProvider(await dashboardHqClient('errors', driver.options))) }
      }
      catch (error) {
        if (error instanceof DashboardProviderUnavailableError)
          return { data: empty, unavailable: error.reason }
        throw error
      }
    },
    candidate => isValid((candidate as DashboardErrorsEnvelope<T>)?.data),
  )
}

const EMPTY_GROUP_PAGE: DashboardGroupedErrorPage = { groups: [], total: 0, page: 1, types: [] }

export function readGroupedErrors(query: DashboardErrorGroupQuery): Promise<DashboardErrorsEnvelope<DashboardGroupedErrorPage>> {
  return readErrors(
    EMPTY_GROUP_PAGE,
    provider => provider.grouped(query),
    payload => Boolean(payload) && Array.isArray((payload as DashboardGroupedErrorPage).groups),
  )
}

/** The page query, or the reason it is invalid. Absent values: page 1 of 25, every group. */
export function parseErrorGroupQuery(read: QueryReader): DashboardErrorGroupQuery | { error: string } {
  const pageText = queryText(read, 'page')
  const page = pageText === '' ? 1 : Number(pageText)
  if (!Number.isInteger(page) || page < 1)
    return { error: 'page must be a whole number of 1 or more.' }

  const sizeText = queryText(read, 'per_page')
  const perPage = sizeText === '' ? 25 : Number(sizeText)
  if (!(LIST_PAGE_SIZES as readonly number[]).includes(perPage))
    return { error: `per_page must be one of ${LIST_PAGE_SIZES.join(', ')}.` }

  const status = queryText(read, 'status') || 'all'
  if (status !== 'all' && !ERROR_STATUSES.includes(status as DashboardErrorStatus))
    return { error: `status must be all or one of ${ERROR_STATUSES.join(', ')}.` }

  const search = queryText(read, 'search')
  if (search.length > 200)
    return { error: 'search must be 200 characters or fewer.' }

  const type = queryText(read, 'type')
  if (type.length > 255)
    return { error: 'type must be 255 characters or fewer.' }

  const sort = queryText(read, 'sort') || 'last_seen'
  if (!(ERROR_GROUP_SORTS as readonly string[]).includes(sort))
    return { error: `sort must be one of ${ERROR_GROUP_SORTS.join(', ')}.` }

  const directionText = queryText(read, 'direction').toLowerCase()
  const direction = directionText === '' ? (sort === 'last_seen' || sort === 'count' ? 'desc' : 'asc') : directionText
  if (direction !== 'asc' && direction !== 'desc')
    return { error: 'direction must be asc or desc.' }

  return { page, perPage, search, status: status as DashboardErrorGroupQuery['status'], type, sort: sort as DashboardErrorGroupQuery['sort'], direction }
}

export function readErrorStats(): Promise<DashboardErrorsEnvelope<DashboardErrorStats>> {
  return readErrors(EMPTY_STATS, provider => provider.stats(), payload => Boolean(payload) && typeof payload === 'object')
}

export function readErrorTimeline(): Promise<DashboardErrorsEnvelope<DashboardErrorTimelinePoint[]>> {
  return readErrors([], provider => provider.timeline(), Array.isArray)
}

export function readErrorsByGroup(type: string, message: string): Promise<DashboardErrorsEnvelope<DashboardErrorRecord[]>> {
  return readErrors([], provider => provider.byGroup(type, message), Array.isArray)
}

export function readErrorById(id: string | number): Promise<DashboardErrorsEnvelope<DashboardErrorRecord | undefined>> {
  return readErrors<DashboardErrorRecord | undefined>(undefined, provider => provider.byId(id), () => true)
}
