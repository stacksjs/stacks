import type { ConnectGrant, HqServiceAdapter, MeterReading, ReadPrincipal } from './service'
import type { UsageReport } from './types'
import { describe, expect, test } from 'bun:test'
import { isPeriod } from './period'
import { createHqService, createMemoryConnectCodeStore, hashConnectCode } from './service'

/**
 * The contract every HQ service's adapter must pass, and an in-memory adapter
 * that passes it.
 *
 * A service runs the suite against its real adapter:
 *
 *   import { hqServiceContract } from '@stacksjs/hq/testing'
 *   hqServiceContract('bughq', async () => ({ adapter: bughqAdapter, user: await aSignedInUser() }))
 *
 * This module imports `bun:test`, so it is only for test files.
 */

export interface HqContractHarness<User> {
  adapter: HqServiceAdapter<User>
  /** A signed-in user of the service, allowed to approve a connect. */
  user: User
}

const STATES = ['ok', 'warn', 'over', 'sampled']

function request(url: string, init: { method?: string, body?: unknown, headers?: Record<string, string> } = {}): Request {
  return new Request(`http://hq.test${url}`, {
    method: init.method ?? 'GET',
    headers: { ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...init.headers },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
}

export function hqServiceContract<User>(name: string, setup: () => HqContractHarness<User> | Promise<HqContractHarness<User>>): void {
  describe(`HQ service contract: ${name}`, () => {
    async function boot() {
      const harness = await setup()
      const clock = { at: Date.parse('2026-01-15T12:00:00.000Z') }
      const service = createHqService(harness.adapter, { now: () => new Date(clock.at), codeTtlMs: 60_000 })
      const start = async (app = 'contract-app'): Promise<{ code: string, approveUrl: string }> => {
        const response = await service.handle(request('/api/cli/connect', { method: 'POST', body: { app } }))
        expect(response?.status).toBe(201)
        return await response!.json() as { code: string, approveUrl: string }
      }
      const poll = async (code: string): Promise<{ status: number, body: Record<string, unknown> }> => {
        const response = await service.handle(request(`/api/cli/connect/${code}`))
        return { status: response!.status, body: await response!.json() as Record<string, unknown> }
      }
      return { ...harness, service, clock, start, poll }
    }

    test('starting a connect answers a code and an approve URL that carries it', async () => {
      const { start, service } = await boot()
      const { code, approveUrl } = await start('my-app')
      expect(code).toMatch(/^[\w-]{32,}$/)
      expect(approveUrl).toContain(code)
      expect(() => new URL(approveUrl)).not.toThrow()
      expect(await service.describeConnect(code)).toMatchObject({ app: 'my-app' })
    })

    test('two connects never share a code', async () => {
      const { start } = await boot()
      expect((await start()).code).not.toBe((await start()).code)
    })

    test('the store is given the hash of the code, never the code', async () => {
      const { start, adapter } = await boot()
      const { code } = await start()
      expect(await adapter.codes.find(code)).toBeNull()
      const record = await adapter.codes.find(await hashConnectCode(code))
      expect(record).toMatchObject({ status: 'pending', sealedGrant: null })
      expect(JSON.stringify(record)).not.toContain(code)
    })

    test('a code is pending until a signed-in user approves it', async () => {
      const { start, poll } = await boot()
      const { code } = await start()
      expect(await poll(code)).toEqual({ status: 200, body: { status: 'pending' } })
      expect(await poll(code)).toEqual({ status: 200, body: { status: 'pending' } })
    })

    test('an approved code hands over the project and its keys, once', async () => {
      const { start, poll, service, user, adapter } = await boot()
      const { code } = await start('my-app')
      const approval = await service.approveConnect(code, user)
      expect(approval.ok).toBe(true)

      // The keys wait encrypted: the stored record must not contain them.
      const stored = await adapter.codes.find(await hashConnectCode(code))
      expect(stored?.status).toBe('approved')

      const first = await poll(code)
      expect(first.status).toBe(200)
      expect(first.body.status).toBe('approved')
      const grant = first.body as unknown as ConnectGrant
      expect(typeof grant.project.id).toBe('string')
      expect(typeof grant.project.name).toBe('string')
      expect(grant.ingestKey.length).toBeGreaterThan(0)
      expect(grant.readKey.length).toBeGreaterThan(0)
      expect(grant.readKey).not.toBe(grant.ingestKey)
      expect(() => new URL(grant.dashboardUrl)).not.toThrow()
      expect(stored?.sealedGrant ?? '').not.toContain(grant.readKey)

      expect(await poll(code)).toEqual({ status: 404, body: { status: 'expired' } })
      expect(await service.approveConnect(code, user)).toEqual({ ok: false, reason: 'expired' })
    })

    test('concurrent polls of an approved code yield the keys exactly once', async () => {
      const { start, poll, service, user } = await boot()
      const { code } = await start()
      await service.approveConnect(code, user)
      const outcomes = await Promise.all([poll(code), poll(code), poll(code)])
      expect(outcomes.filter(outcome => outcome.body.status === 'approved')).toHaveLength(1)
      expect(outcomes.filter(outcome => outcome.status === 404)).toHaveLength(2)
    })

    test('a code cannot be approved twice', async () => {
      const { start, service, user } = await boot()
      const { code } = await start()
      expect((await service.approveConnect(code, user)).ok).toBe(true)
      expect(await service.approveConnect(code, user)).toEqual({ ok: false, reason: 'already_approved' })
    })

    test('a code expires, approved or not', async () => {
      const { start, poll, service, user, clock } = await boot()
      const pending = await start()
      const approved = await start()
      await service.approveConnect(approved.code, user)
      clock.at += 60_001
      expect(await poll(pending.code)).toEqual({ status: 404, body: { status: 'expired' } })
      expect(await poll(approved.code)).toEqual({ status: 404, body: { status: 'expired' } })
      expect(await service.approveConnect(pending.code, user)).toEqual({ ok: false, reason: 'expired' })
      expect(await service.describeConnect(pending.code)).toBeNull()
    })

    test('an unknown or malformed code is expired, not an error', async () => {
      const { poll } = await boot()
      expect((await poll('a'.repeat(43))).status).toBe(404)
      expect((await poll('nope')).status).toBe(404)
    })

    test('connecting the same app twice reuses its project', async () => {
      const { start, poll, service, user } = await boot()
      const grants: ConnectGrant[] = []
      for (let i = 0; i < 2; i++) {
        const { code } = await start('same-app')
        await service.approveConnect(code, user)
        grants.push((await poll(code)).body as unknown as ConnectGrant)
      }
      expect(grants[1]!.project.id).toBe(grants[0]!.project.id)
    })

    test('usage refuses a missing, malformed or wrong read key', async () => {
      const { service, start, poll, user } = await boot()
      const { code } = await start()
      await service.approveConnect(code, user)
      const grant = (await poll(code)).body as unknown as ConnectGrant

      const attempts: (Record<string, string> | undefined)[] = [
        undefined,
        { Authorization: 'Bearer' },
        { Authorization: `Basic ${grant.readKey}` },
        { Authorization: 'Bearer not-a-key' },
        // The ingest key ships in client bundles; it must never read.
        { Authorization: `Bearer ${grant.ingestKey}` },
      ]
      for (const headers of attempts) {
        const response = await service.handle(request('/api/v1/usage', { headers }))
        expect(response?.status).toBe(401)
      }
    })

    test('usage answers every meter in the documented shape', async () => {
      const { service, start, poll, user } = await boot()
      const { code } = await start()
      await service.approveConnect(code, user)
      const grant = (await poll(code)).body as unknown as ConnectGrant

      const response = await service.handle(request('/api/v1/usage', { headers: { Authorization: `Bearer ${grant.readKey}` } }))
      expect(response?.status).toBe(200)
      const reports = await response!.json() as UsageReport[]
      expect(Array.isArray(reports)).toBe(true)
      expect(reports.length).toBeGreaterThan(0)
      for (const report of reports) {
        expect(Object.keys(report).sort()).toEqual(['limit', 'meter', 'period', 'state', 'upgradeUrl', 'used'])
        expect(report.meter).toMatch(/^[\w.:-]{1,64}$/)
        expect(Number.isInteger(report.used) && report.used >= 0).toBe(true)
        expect(report.limit === null || (Number.isInteger(report.limit) && report.limit >= 0)).toBe(true)
        expect(isPeriod(report.period)).toBe(true)
        expect(STATES).toContain(report.state)
        expect(() => new URL(report.upgradeUrl)).not.toThrow()
      }
      expect(new Set(reports.map(report => report.meter)).size).toBe(reports.length)
    })

    test('requests outside the contract are left to the service', async () => {
      const { service } = await boot()
      expect(await service.handle(request('/api/v1/other'))).toBeNull()
      expect(await service.handle(request('/api/cli/connect'))).toBeNull()
      expect(await service.handle(request('/api/v1/usage', { method: 'POST', body: {} }))).toBeNull()
    })
  })
}

export interface MemoryHqAdapterOptions {
  service?: string
  origin?: string
  /** The meters `usage` reports for every owner. */
  meters?: MeterReading[]
}

export interface MemoryHqUser {
  id: string
}

/**
 * A complete adapter held in memory: a stand-in service for an app's own
 * tests, and the reference the contract suite is checked against.
 */
export function createMemoryHqAdapter(options: MemoryHqAdapterOptions = {}): HqServiceAdapter<MemoryHqUser> & { grants: () => ConnectGrant[] } {
  const service = options.service ?? 'fakehq'
  const origin = options.origin ?? `https://${service}.test`
  const meters = options.meters ?? [{ meter: 'events', used: 0, limit: 500 }]
  const projects = new Map<string, { grant: ConnectGrant, owner: string }>()

  return {
    service,
    approveUrl: code => `${origin}/cli/connect?code=${encodeURIComponent(code)}`,
    upgradeUrl: `${origin}/pricing`,
    codes: createMemoryConnectCodeStore(),
    async provision(user, { app }) {
      const key = `${user.id}/${app}`
      let project = projects.get(key)
      if (!project) {
        const id = crypto.randomUUID()
        project = {
          owner: user.id,
          grant: {
            project: { id, name: app },
            ingestKey: `${service}_ingest_${crypto.randomUUID()}`,
            readKey: `${service}_read_${crypto.randomUUID()}`,
            dashboardUrl: `${origin}/projects/${id}`,
          },
        }
        projects.set(key, project)
      }
      return project.grant
    },
    async authenticateReadKey(readKey): Promise<ReadPrincipal | null> {
      for (const { grant, owner } of projects.values()) {
        if (grant.readKey === readKey)
          return { owner, project: grant.project.id }
      }
      return null
    },
    async usage() {
      return meters.map(reading => ({ ...reading }))
    },
    grants: () => [...projects.values()].map(project => project.grant),
  }
}
