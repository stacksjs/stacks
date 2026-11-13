import type { SqlClient } from '../src/meter'
import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { connectCodesMigrationSql, createHqService, createMemoryConnectCodeStore, ensureConnectCodesTable, isLicenseGrant, sqlConnectCodeStore } from '../src/service'
import { createMemoryHqAdapter, hqServiceContract } from '../src/testing'

function sqlite(): SqlClient {
  const db = new Database(':memory:')
  return {
    unsafe: async (sql, params = []) => {
      const statement = db.query(sql)
      return /^\s*SELECT/i.test(sql) ? statement.all(...params as never[]) : (statement.run(...params as never[]), [])
    },
  }
}

// The reference adapter, over both code stores the package ships.
hqServiceContract('memory adapter', () => ({ adapter: createMemoryHqAdapter(), user: { id: 'user_1' } }))

hqServiceContract('memory adapter over the SQL code store', async () => {
  const client = sqlite()
  await ensureConnectCodesTable(client)
  return { adapter: { ...createMemoryHqAdapter(), codes: sqlConnectCodeStore(client) }, user: { id: 'user_1' } }
})

// The same contract, for a service that hands over a licence and meters nothing.
hqServiceContract('licence-only adapter', () => {
  const licences = new Map<string, string>()
  return {
    user: { id: 'user_1' },
    adapter: {
      service: 'licensed',
      approveUrl: (code: string) => `https://licensed.test/cli/connect?code=${encodeURIComponent(code)}`,
      upgradeUrl: 'https://licensed.test/pricing',
      codes: createMemoryConnectCodeStore(),
      async provision(user: { id: string }, { app }: { app: string }) {
        const id = `${user.id}/${app}`
        if (!licences.has(id))
          licences.set(id, `lic_${crypto.randomUUID()}`)
        return { project: { id, name: app }, licenseKey: licences.get(id)!, dashboardUrl: 'https://licensed.test/account' }
      },
    },
  }
})

describe('usage endpoint', () => {
  test('derives each meter\'s state from its own policy', async () => {
    const adapter = createMemoryHqAdapter({
      service: 'commshq',
      meters: [
        { meter: 'emails', used: 130, limit: 100, policy: 'hard-send' },
        { meter: 'events', used: 130, limit: 100 },
        { meter: 'contacts', used: 80, limit: 100, policy: 'hard-send', period: '2026-01' },
        { meter: 'sms', used: 5, limit: null },
      ],
    })
    const service = createHqService(adapter, { now: () => new Date('2026-06-02T00:00:00.000Z') })
    const { code } = await (await service.startConnect(new Request('http://x/api/cli/connect', { method: 'POST' }))).json() as { code: string }
    await service.approveConnect(code, { id: 'u' })
    const grant = await (await service.pollConnect(new Request(`http://x/api/cli/connect/${code}`))).json() as { readKey: string }

    const response = await service.usage(new Request('http://x/api/v1/usage', { headers: { authorization: `Bearer ${grant.readKey}` } }))
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual([
      { meter: 'emails', used: 130, limit: 100, period: '2026-06', state: 'over', upgradeUrl: 'https://commshq.test/pricing' },
      { meter: 'events', used: 130, limit: 100, period: '2026-06', state: 'sampled', upgradeUrl: 'https://commshq.test/pricing' },
      { meter: 'contacts', used: 80, limit: 100, period: '2026-01', state: 'warn', upgradeUrl: 'https://commshq.test/pricing' },
      { meter: 'sms', used: 5, limit: null, period: '2026-06', state: 'ok', upgradeUrl: 'https://commshq.test/pricing' },
    ])
  })
})

describe('connect', () => {
  test('reads the code from router params and names the three routes', async () => {
    const service = createHqService(createMemoryHqAdapter())
    expect(service.routes.map(route => `${route.method} ${route.path}`)).toEqual([
      'POST /api/cli/connect',
      'GET /api/cli/connect/{code}',
      'GET /api/v1/usage',
    ])
    const started = await service.routes[0]!.handler({ url: '/api/cli/connect', headers: new Headers(), json: async () => ({ app: 'Cursio <script>' }) })
    const { code } = await started.json() as { code: string }
    expect(await service.describeConnect(code)).toMatchObject({ app: 'Cursio script' })
    const polled = await service.routes[1]!.handler({ url: '/ignored', headers: new Headers(), params: { code } })
    expect(await polled.json()).toEqual({ status: 'pending' })
  })

  test('ships the code table schema', () => {
    expect(connectCodesMigrationSql()[0]).toContain('CREATE TABLE IF NOT EXISTS hq_connect_codes')
  })
})

describe('a licence-only service', () => {
  // A service whose product runs inside the app takes no data and has no keys:
  // an approved connect hands over a licence, and there is no usage to read.
  function licensing() {
    return createHqService<{ id: string }>({
      service: 'reportshq',
      approveUrl: code => `https://reportshq.test/cli/connect?code=${code}`,
      upgradeUrl: 'https://reportshq.test/pricing',
      codes: createMemoryConnectCodeStore(),
      provision: async (user, { app }) => ({
        project: { id: `${user.id}-${app}`, name: app },
        licenseKey: `rhq_lic_${'ab'.repeat(16)}`,
        dashboardUrl: 'https://reportshq.test/account',
      }),
    })
  }
  const request = (url: string, method = 'GET', body?: unknown): Request =>
    new Request(`http://hq.test${url}`, { method, body: body === undefined ? undefined : JSON.stringify(body) })

  test('an approved connect answers the licence, exactly once', async () => {
    const service = licensing()
    const started = await service.handle(request('/api/cli/connect', 'POST', { app: 'my-app' }))
    const { code } = await started!.json() as { code: string }

    expect(await service.approveConnect(code, { id: 'user_1' })).toEqual({ ok: true, project: { id: 'user_1-my-app', name: 'my-app' } })

    const approved = await (await service.handle(request(`/api/cli/connect/${code}`)))!.json() as Record<string, unknown>
    expect(approved).toEqual({
      status: 'approved',
      project: { id: 'user_1-my-app', name: 'my-app' },
      licenseKey: `rhq_lic_${'ab'.repeat(16)}`,
      dashboardUrl: 'https://reportshq.test/account',
    })
    expect(isLicenseGrant(approved as never)).toBe(true)
    expect((await service.handle(request(`/api/cli/connect/${code}`)))!.status).toBe(404)
  })

  test('it has no usage route to mount, and the handler answers 404', async () => {
    const service = licensing()
    expect(service.routes.map(route => `${route.method} ${route.path}`)).toEqual(['POST /api/cli/connect', 'GET /api/cli/connect/{code}'])
    // Left to the service's own router, like any path outside the contract.
    expect(await service.handle(request('/api/v1/usage'))).toBeNull()
    expect((await service.usage(request('/api/v1/usage'))).status).toBe(404)
  })

  test('a keyed grant is not mistaken for a licence', () => {
    expect(isLicenseGrant({ project: { id: '1', name: 'a' }, ingestKey: 'i', readKey: 'r', dashboardUrl: 'https://x.test' })).toBe(false)
  })
})
