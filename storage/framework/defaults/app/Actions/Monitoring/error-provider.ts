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
 * The record shapes the error store deals in.
 *
 * Derived from the store's own functions rather than imported, because
 * `@stacksjs/commerce` exposes its errors module as a value and keeps these
 * interfaces inside it. Deriving them means the provider contract follows the
 * store automatically, and it keeps this refactor out of the commerce package.
 */
export type DashboardErrorRecord = NonNullable<Awaited<ReturnType<typeof errors.fetchById>>>
export type DashboardGroupedError = Awaited<ReturnType<typeof errors.fetchGrouped>>[number]
export type DashboardErrorStats = Awaited<ReturnType<typeof errors.fetchStats>>

export interface DashboardErrorTimelinePoint {
  hour: string
  count: number
}

export interface DashboardErrorsProvider {
  grouped: () => Promise<DashboardGroupedError[]>
  stats: () => Promise<DashboardErrorStats>
  timeline: () => Promise<DashboardErrorTimelinePoint[]>
  byGroup: (type: string, message: string) => Promise<DashboardErrorRecord[]>
  byId: (id: number) => Promise<DashboardErrorRecord | undefined>
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
export const localErrorsProvider: DashboardErrorsProvider = {
  grouped: () => errors.fetchGrouped(),
  stats: () => errors.fetchStats(),
  timeline: () => errors.fetchTimeline(),
  byGroup: (type, message) => errors.fetchByGroup(type, message),
  byId: id => errors.fetchById(id),
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

export function readErrorById(id: number): Promise<DashboardErrorsEnvelope<DashboardErrorRecord | undefined>> {
  return readErrors<DashboardErrorRecord | undefined>(undefined, provider => provider.byId(id), () => true)
}
