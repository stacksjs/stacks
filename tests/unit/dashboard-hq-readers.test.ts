import type { FakeHqService } from '@stacksjs/testing/hq'
import { describe, expect, test } from 'bun:test'
import { createHqClient } from '@stacksjs/hq/client'
import { createFakeHqService } from '@stacksjs/testing/hq'
import { DashboardProviderUnavailableError, hqUnavailableReason } from '../../storage/framework/defaults/app/Actions/Dashboard/dashboard-provider'
import { hqLogsProvider } from '../../storage/framework/defaults/app/Actions/Dashboard/Infrastructure/log-provider'
import { hqErrorsProvider } from '../../storage/framework/defaults/app/Actions/Monitoring/error-provider'

/**
 * The dashboard's `hq` readers for Logs and Errors.
 *
 * They read LogHQ and BugHQ with a project read key through
 * `@stacksjs/hq/client`, here against the fake service. What has to hold: the
 * payload is the shape the section already renders, and a service that is not
 * connected or refuses the key becomes an empty section with a reason rather
 * than an error.
 */

const NOW = Date.parse('2026-01-15T12:00:00.000Z')
const now = (): number => NOW
const at = (minutesAgo: number): string => new Date(NOW - minutesAgo * 60_000).toISOString()

const LOG_QUERY = { page: 1, perPage: 25, search: '', type: '', source: '', project: '', range: '30' as const }
const GROUP_QUERY = { page: 1, perPage: 25, search: '', status: 'all' as const, type: '', sort: 'last_seen' as const, direction: 'desc' as const }

function clientFor(service: FakeHqService, overrides: { readKey?: string } = {}) {
  const grant = service.project('my-app')
  const client = createHqClient({
    services: { [service.service]: { url: service.origin, readKey: overrides.readKey ?? grant.readKey, project: grant.project.id } },
    fetch: (input, init) => service.fetch(input, init),
  })
  return { client, grant }
}

async function sendLogs(service: FakeHqService, key: string, logs: Array<{ level: string, message: string, timestamp: string }>): Promise<void> {
  const response = await service.fetch(`${service.origin}/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-LogHQ-Key': key },
    body: JSON.stringify({ logs }),
  })
  expect(response.status).toBe(201)
}

async function sendError(service: FakeHqService, key: string, type: string, message: string): Promise<void> {
  const response = await service.fetch(`${service.origin}/errors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, type, message }),
  })
  expect(response.status).toBe(201)
}

describe('dashboard hq logs reader', () => {
  test('a page of LogHQ entries is the payload the Logs section renders', async () => {
    const loghq = createFakeHqService({ service: 'loghq' })
    const { client, grant } = clientFor(loghq)
    await sendLogs(loghq, grant.ingestKey, [
      { level: 'critical', message: 'database is down', timestamp: at(1) },
      { level: 'warning', message: 'slow query', timestamp: at(2) },
      { level: 'notice', message: 'deploy finished', timestamp: at(3) },
    ])

    const payload = await hqLogsProvider(client, now).logs(LOG_QUERY)

    expect(payload.unavailable).toBeUndefined()
    expect(payload.logs.map(log => [log.id, log.type, log.message])).toEqual([
      [1, 'error', 'database is down'],
      [2, 'warning', 'slow query'],
      [3, 'info', 'deploy finished'],
    ])
    expect(payload.logs[0]!.timestamp).toBe(at(1))
    expect(payload.summary).toEqual({ total: 3, error: 1, warning: 1, info: 1, success: 0 })
    expect(payload.pagination).toEqual({ page: 1, perPage: 25, total: 3, totalPages: 1 })
    expect(payload.options.types).toEqual(['error', 'warning', 'info', 'success'])
  })

  test('the type and search filters are answered by LogHQ', async () => {
    const loghq = createFakeHqService({ service: 'loghq' })
    const { client, grant } = clientFor(loghq)
    await sendLogs(loghq, grant.ingestKey, [
      { level: 'error', message: 'payment failed', timestamp: at(1) },
      { level: 'critical', message: 'payment gateway down', timestamp: at(2) },
      { level: 'info', message: 'payment received', timestamp: at(3) },
    ])
    const provider = hqLogsProvider(client, now)

    expect((await provider.logs({ ...LOG_QUERY, type: 'error' })).logs.map(log => log.message)).toEqual(['payment failed', 'payment gateway down'])
    expect((await provider.logs({ ...LOG_QUERY, search: 'gateway' })).logs.map(log => log.message)).toEqual(['payment gateway down'])
    // LogHQ has no success level, so that filter is an empty page and not an outage.
    const success = await provider.logs({ ...LOG_QUERY, type: 'success' })
    expect(success.logs).toEqual([])
    expect(success.unavailable).toBeUndefined()
  })

  test('a numbered page walks LogHQ\'s cursor, and the pager is offered the next page only when there is one', async () => {
    const loghq = createFakeHqService({ service: 'loghq' })
    const { client, grant } = clientFor(loghq)
    await sendLogs(loghq, grant.ingestKey, Array.from({ length: 5 }, (_, index) => ({ level: 'info', message: `entry ${index + 1}`, timestamp: at(index + 1) })))
    const provider = hqLogsProvider(client, now)

    const first = await provider.logs({ ...LOG_QUERY, perPage: 2 })
    expect(first.logs.map(log => log.message)).toEqual(['entry 1', 'entry 2'])
    expect(first.pagination).toEqual({ page: 1, perPage: 2, total: 3, totalPages: 2 })

    const third = await provider.logs({ ...LOG_QUERY, perPage: 2, page: 3 })
    expect(third.logs.map(log => [log.id, log.message])).toEqual([[5, 'entry 5']])
    expect(third.pagination).toEqual({ page: 3, perPage: 2, total: 5, totalPages: 3 })

    // A page past the end is moved back to the last one that exists.
    const beyond = await provider.logs({ ...LOG_QUERY, perPage: 2, page: 9 })
    expect(beyond.pagination.page).toBe(3)
    expect(beyond.logs.map(log => log.message)).toEqual(['entry 5'])
  })

  test('entries older than the range are left out', async () => {
    const loghq = createFakeHqService({ service: 'loghq' })
    const { client, grant } = clientFor(loghq)
    await sendLogs(loghq, grant.ingestKey, [
      { level: 'info', message: 'today', timestamp: at(60) },
      { level: 'info', message: 'last week', timestamp: at(60 * 24 * 6) },
    ])

    const payload = await hqLogsProvider(client, now).logs({ ...LOG_QUERY, range: '1' })
    expect(payload.logs.map(log => log.message)).toEqual(['today'])
    expect(payload.pagination.total).toBe(1)
  })

  test('a service that is not connected, or refuses the key, is an empty section with a reason', async () => {
    const loghq = createFakeHqService({ service: 'loghq' })

    const unconfigured = await hqLogsProvider(createHqClient({ services: {} }), now).logs(LOG_QUERY)
    expect(unconfigured.logs).toEqual([])
    expect(unconfigured.unavailable).toBe('LogHQ is not connected. Run `buddy hq:connect loghq` to connect it.')
    expect(unconfigured.options.ranges).toEqual(['1', '7', '30', '90', 'all'])

    // The ingest key grants no read access. The service answers 404 for it.
    const { grant } = clientFor(loghq)
    const wrongKey = await hqLogsProvider(clientFor(loghq, { readKey: grant.ingestKey }).client, now).logs(LOG_QUERY)
    expect(wrongKey.logs).toEqual([])
    expect(wrongKey.unavailable).toContain('LogHQ has no project that this read key opens')
    expect(wrongKey.unavailable).not.toContain(grant.ingestKey)
  })
})

describe('dashboard hq errors reader', () => {
  async function seeded() {
    const bughq = createFakeHqService({ service: 'bughq', now: () => new Date(NOW) })
    const { client, grant } = clientFor(bughq)
    await sendError(bughq, grant.ingestKey, 'TypeError', 'x is not a function')
    await sendError(bughq, grant.ingestKey, 'TypeError', 'x is not a function')
    await sendError(bughq, grant.ingestKey, 'RangeError', 'out of bounds')
    return { bughq, provider: hqErrorsProvider(client, now) }
  }

  test('BugHQ issues are the groups the Errors section renders', async () => {
    const { bughq, provider } = await seeded()

    const page = await provider.grouped({ ...GROUP_QUERY, sort: 'count' })

    expect(page.total).toBe(2)
    expect(page.page).toBe(1)
    expect(page.types).toEqual(['RangeError', 'TypeError'])
    expect(page.groups.map(group => [group.type, group.message, group.count, group.status])).toEqual([
      ['TypeError', 'x is not a function', 2, 'unresolved'],
      ['RangeError', 'out of bounds', 1, 'unresolved'],
    ])
    // Ids are BugHQ's own strings, which the section treats as opaque.
    expect(page.groups[0]!.id).toBe(bughq.issues()[0]!.id)
    expect(page.groups[0]!.first_seen).toBe(new Date(NOW).toISOString())
  })

  test('search, type and status filter the groups, and a page past the end moves back', async () => {
    const { provider } = await seeded()

    expect((await provider.grouped({ ...GROUP_QUERY, type: 'RangeError' })).groups.map(group => group.message)).toEqual(['out of bounds'])
    expect((await provider.grouped({ ...GROUP_QUERY, search: 'FUNCTION' })).groups.map(group => group.type)).toEqual(['TypeError'])
    expect((await provider.grouped({ ...GROUP_QUERY, status: 'resolved' })).groups).toEqual([])
    expect((await provider.grouped({ ...GROUP_QUERY, perPage: 10, page: 4 })).page).toBe(1)
  })

  test('stats, a single error and its group are built from the same issue list', async () => {
    const { bughq, provider } = await seeded()

    expect(await provider.stats()).toEqual({ total: 3, unresolved: 3, resolved: 0, ignored: 0, last_24h: 2, trend: 0 })

    const id = bughq.issues()[1]!.id
    expect(await provider.byId(id)).toMatchObject({ id, type: 'RangeError', message: 'out of bounds', resolution: 'unresolved', status: null })
    expect(await provider.byId('no-such-issue')).toBeUndefined()
    expect((await provider.byGroup('TypeError', 'x is not a function')).map(record => record.type)).toEqual(['TypeError'])
  })

  test('there is no timeline to read, and the panel is told so', async () => {
    const { provider } = await seeded()
    await expect(provider.timeline()).rejects.toBeInstanceOf(DashboardProviderUnavailableError)
  })

  test('a service that is not connected raises the reason the section shows', async () => {
    const provider = hqErrorsProvider(createHqClient({ services: {} }), now)
    const error = await provider.grouped(GROUP_QUERY).catch(caught => caught)
    expect(error).toBeInstanceOf(DashboardProviderUnavailableError)
    expect(error.reason).toBe('BugHQ is not connected. Run `buddy hq:connect bughq` to connect it.')
  })
})

describe('hq unavailable reasons', () => {
  test('each one is a sentence for the person looking at the dashboard', () => {
    const base = { ok: false as const, unavailable: true as const, service: 'bughq' as const, message: '' }
    expect(hqUnavailableReason({ ...base, reason: 'unauthorized' })).toBe('BugHQ refused the read key. Run `buddy hq:connect bughq` to get a new one.')
    expect(hqUnavailableReason({ ...base, reason: 'timeout' })).toContain('BugHQ could not be reached')
    expect(hqUnavailableReason({ ...base, reason: 'http', status: 503 })).toBe('BugHQ could not be read (it answered 503).')
    expect(hqUnavailableReason({ ...base, reason: 'bad_response' })).toContain('cannot show')
  })
})
