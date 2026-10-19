import type { DashboardProviderUnavailable } from '../Dashboard/dashboard-provider'
import { errors } from '@stacksjs/commerce'
import { HQ_READ_UNAVAILABLE, readThroughProvider, resolveDashboardDriver } from '../Dashboard/dashboard-provider'

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
  error_ids: number[]
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
  grouped: () => Promise<DashboardGroupedError[]>
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
function toGroupedError(row: Awaited<ReturnType<typeof errors.fetchGrouped>>[number]): DashboardGroupedError {
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    stack: row.stack,
    status: toErrorStatus(row.status),
    count: row.count,
    first_seen: row.first_seen,
    last_seen: row.last_seen,
    error_ids: row.error_ids,
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
  grouped: async () => (await errors.fetchGrouped()).map(toGroupedError),
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

async function resolveErrorsProvider(): Promise<{ provider: DashboardErrorsProvider, remote: boolean }> {
  const driver = await resolveDashboardDriver('errors')
  return { provider: localErrorsProvider, remote: driver.name !== 'local' }
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
  const { provider, remote } = await resolveErrorsProvider()

  if (!remote)
    return { data: await read(provider) }

  const payload = await readThroughProvider<DashboardErrorsEnvelope<T>>(
    'errors',
    reason => ({ data: empty, unavailable: reason }),
    async () => ({ data: empty, unavailable: HQ_READ_UNAVAILABLE }),
    candidate => isValid((candidate as DashboardErrorsEnvelope<T>)?.data),
  )

  return payload
}

export function readGroupedErrors(): Promise<DashboardErrorsEnvelope<DashboardGroupedError[]>> {
  return readErrors([], provider => provider.grouped(), Array.isArray)
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
